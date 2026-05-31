"""
Test configuration.

Execution order (all module-level code runs before pytest collects tests):
  1. Set env vars  → prevents pydantic-settings from raising at import time
  2. Stub pgvector → replaces Vector with a SQLite-friendly Text-backed type
  3. Stub ARRAY    → replaces ARRAY with JSON-backed type
  4. Import app    → models pick up the stubbed types
  5. Build SQLite test engine
  6. Define fixtures
"""

import json
import os
import sys
import types as _builtin_types

# ─────────────────────────────────────────────────────────────────────────────
# 1. Environment variables (must precede app import)
# ─────────────────────────────────────────────────────────────────────────────
# Use a fake PostgreSQL URL so app.core.database.create_async_engine succeeds
# at import time without a running server.  The engine is never used because
# we override get_db in every test.
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-chars!!")
os.environ.setdefault("OPENAI_API_KEY", "sk-test-key")

# ─────────────────────────────────────────────────────────────────────────────
# 2. pgvector stub
# ─────────────────────────────────────────────────────────────────────────────
from sqlalchemy.types import JSON, Text, TypeDecorator  # noqa: E402


class _Vector(TypeDecorator):
    """SQLite-compatible stand-in for pgvector.sqlalchemy.Vector."""

    impl = Text
    cache_ok = True

    def __init__(self, dim: int = 1536):
        super().__init__()
        self.dim = dim

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return json.dumps(list(value))

    def result_processor(self, dialect, coltype):
        def process(value):
            return json.loads(value) if value is not None else None

        return process


_pgvector_pkg = _builtin_types.ModuleType("pgvector")
_pgvector_sa = _builtin_types.ModuleType("pgvector.sqlalchemy")
_pgvector_sa.Vector = _Vector
sys.modules.setdefault("pgvector", _pgvector_pkg)
sys.modules["pgvector.sqlalchemy"] = _pgvector_sa

# ─────────────────────────────────────────────────────────────────────────────
# 3. ARRAY stub
# ─────────────────────────────────────────────────────────────────────────────
import sqlalchemy as _sa  # noqa: E402


class _ArrayAsJSON(TypeDecorator):
    """SQLite-compatible stand-in for sqlalchemy.ARRAY."""

    impl = JSON
    cache_ok = True

    def __init__(self, item_type=None, *args, **kwargs):
        super().__init__()

    def process_bind_param(self, value, dialect):
        return value

    def result_processor(self, dialect, coltype):
        def process(value):
            return value

        return process


_sa.ARRAY = _ArrayAsJSON

# ─────────────────────────────────────────────────────────────────────────────
# 4. App import (models now use stubbed types)
# ─────────────────────────────────────────────────────────────────────────────
from app.core.database import Base, get_db  # noqa: E402
from app.main import app as fastapi_app  # noqa: E402

# ─────────────────────────────────────────────────────────────────────────────
# 5. Test engine (SQLite in-memory)
# ─────────────────────────────────────────────────────────────────────────────
import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402

_TEST_DB_URL = "sqlite+aiosqlite:///:memory:"
_engine = create_async_engine(_TEST_DB_URL, echo=False)
_TestSession = async_sessionmaker(_engine, expire_on_commit=False)


# ─────────────────────────────────────────────────────────────────────────────
# 6. Fixtures
# ─────────────────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture()
async def db():
    """Create schema before each test, drop after."""
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    try:
        yield _TestSession
    finally:
        async with _engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture()
async def client(db):
    """ASGI test client with DB overridden to SQLite session."""

    async def _override_get_db():
        async with _TestSession() as session:
            yield session

    fastapi_app.dependency_overrides[get_db] = _override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=fastapi_app),
        base_url="http://test",
    ) as ac:
        yield ac

    fastapi_app.dependency_overrides.clear()
