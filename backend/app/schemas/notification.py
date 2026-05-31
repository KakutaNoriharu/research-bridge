from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: str
    user_id: str
    type: Literal["interest", "match", "message"]
    actor_user_id: str
    related_id: str | None
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}
