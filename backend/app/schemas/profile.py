from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# 仕様書 PRF-R-06 / PRF-C-04 で定義された連携形態
CollaborationType = Literal[
    "joint_research",        # 共同研究
    "commissioned_research", # 受託研究
    "consulting",            # 技術相談
    "poc",                   # PoC
]


# =========================================================================== #
# Researcher                                                                   #
# =========================================================================== #

class ResearcherProfileUpsert(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(..., min_length=1, max_length=100)
    university: str = Field(..., min_length=1, max_length=200)
    lab: str | None = Field(None, max_length=200)
    position: str | None = Field(None, max_length=100)
    # Embedding 生成対象 (MATCH-01)
    research_summary: str | None = Field(None, max_length=1000)
    # タグ形式・最大10件 (PRF-R-03)
    keywords: list[str] = Field(default_factory=list, max_length=10)
    tech_stack: list[str] = Field(default_factory=list)
    # DOI / URL 形式・最大5件 (PRF-R-05)
    publication_links: list[str] = Field(default_factory=list, max_length=5)
    collaboration_types: list[CollaborationType] = Field(default_factory=list)
    is_public: bool = True


class ResearcherProfileResponse(ResearcherProfileUpsert):
    id: str
    user_id: str
    match_score: float | None = None  # レコメンド時に動的セット。単体取得時は None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)


# =========================================================================== #
# Company                                                                      #
# =========================================================================== #

class CompanyProfileUpsert(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    company_name: str = Field(..., min_length=1, max_length=200)
    industry: str | None = Field(None, max_length=100)
    employee_count: int | None = Field(None, ge=1)
    contact_name: str = Field(..., min_length=1, max_length=100)
    # Embedding 生成対象 (MATCH-01)
    tech_needs: str | None = Field(None, max_length=1000)
    # タグ形式・最大10件 (PRF-C-03)
    desired_fields: list[str] = Field(default_factory=list, max_length=10)
    collaboration_types: list[CollaborationType] = Field(default_factory=list)
    budget_range: str | None = Field(None, max_length=50)


class CompanyProfileResponse(CompanyProfileUpsert):
    id: str
    user_id: str
    match_score: float | None = None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)
