from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # postgresql+asyncpg://user:pass@host:port/db
    DATABASE_URL: str

    SECRET_KEY: str
    OPENAI_API_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 時間
    ALGORITHM: str = "HS256"
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000"]

    @property
    def sync_database_url(self) -> str:
        """Alembic offline モード（SQL生成）用の同期URL。"""
        return self.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")


settings = Settings()  # type: ignore[call-arg]
