import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class InterestStatus(str, enum.Enum):
    pending = "pending"
    matched = "matched"
    withdrawn = "withdrawn"


class Interest(Base):
    __tablename__ = "interests"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    sender_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    receiver_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    status: Mapped[InterestStatus] = mapped_column(
        Enum(InterestStatus), default=InterestStatus.pending
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
