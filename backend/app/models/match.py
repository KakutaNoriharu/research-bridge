import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    researcher_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    company_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    matched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
