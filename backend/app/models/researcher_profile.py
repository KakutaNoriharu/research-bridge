import uuid
from datetime import datetime, timezone

from pgvector.sqlalchemy import Vector
from sqlalchemy import ARRAY, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ResearcherProfile(Base):
    __tablename__ = "researcher_profiles"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    university: Mapped[str] = mapped_column(String(200), nullable=False)
    lab: Mapped[str | None] = mapped_column(String(200))
    position: Mapped[str | None] = mapped_column(String(100))
    research_summary: Mapped[str | None] = mapped_column(Text)
    keywords: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    tech_stack: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    publication_links: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    collaboration_types: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    is_public: Mapped[bool] = mapped_column(default=True)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(1536))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
