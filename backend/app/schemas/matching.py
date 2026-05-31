from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.profile import CompanyProfileResponse, ResearcherProfileResponse


# =========================================================================== #
# レコメンド                                                                    #
# =========================================================================== #

class RecommendationItem(BaseModel):
    """AI マッチングスコア付きプロフィール 1 件。"""

    user_id: str
    match_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="コサイン類似度スコア (0.0〜1.0、高いほど類似度が高い)",
    )
    # researcher がログイン中 → CompanyProfileResponse
    # company   がログイン中 → ResearcherProfileResponse
    profile: ResearcherProfileResponse | CompanyProfileResponse


# =========================================================================== #
# インタレスト                                                                  #
# =========================================================================== #

class InterestCreate(BaseModel):
    receiver_id: str


class InterestResponse(BaseModel):
    id: str
    sender_id: str
    receiver_id: str
    status: str  # "pending" | "matched" | "withdrawn"
    created_at: datetime

    model_config = {"from_attributes": True}


class InterestListResponse(BaseModel):
    """送受信インタレストを分けて返す（SCR-10 インタレスト管理画面用）。"""

    sent: list[InterestResponse]
    received: list[InterestResponse]


# =========================================================================== #
# マッチング                                                                    #
# =========================================================================== #

class MatchResponse(BaseModel):
    id: str
    researcher_id: str
    company_id: str
    matched_at: datetime

    model_config = {"from_attributes": True}
