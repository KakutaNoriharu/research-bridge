from datetime import datetime

from pydantic import BaseModel, Field


class MessageCreate(BaseModel):
    """POST /messages/{match_id} のリクエストボディ。match_id はパスパラメータで受け取る。"""

    body: str = Field(..., min_length=1, max_length=5000)


class MessageResponse(BaseModel):
    id: str
    match_id: str
    sender_id: str
    body: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ThreadSummary(BaseModel):
    """会話スレッド 1 件の概要（SCR-09 スレッド選択サイドバー用）。"""

    match_id: str
    matched_at: datetime
    partner_user_id: str
    last_message: MessageResponse | None = None
    unread_count: int = 0


class ReadCountResponse(BaseModel):
    """PUT /messages/{match_id}/read のレスポンス。"""

    updated: int
