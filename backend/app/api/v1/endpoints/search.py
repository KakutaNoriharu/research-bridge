from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.company_profile import CompanyProfile as CompanyProfileModel
from app.models.researcher_profile import ResearcherProfile as ResearcherProfileModel
from app.models.user import User, UserRole
from app.schemas.matching import RecommendationItem
from app.schemas.profile import CompanyProfileResponse, ResearcherProfileResponse

router = APIRouter()

PAGE_SIZE = 20


class SearchResult(BaseModel):
    items: list[RecommendationItem]
    total: int
    page: int
    pages: int


@router.get("", response_model=SearchResult, summary="ユーザー検索")
async def search_users(
    q: Annotated[str | None, Query(description="フリーワード")] = None,
    fields: Annotated[str | None, Query(description="カンマ区切りキーワード")] = None,
    types: Annotated[str | None, Query(description="カンマ区切り連携形態")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SearchResult:
    field_list = [f.strip() for f in fields.split(",")] if fields else []
    type_list = [t.strip() for t in types.split(",")] if types else []

    if current_user.role == UserRole.researcher:
        stmt = select(CompanyProfileModel)

        if q:
            q_like = f"%{q.lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(CompanyProfileModel.company_name).like(q_like),
                    func.lower(CompanyProfileModel.tech_needs).like(q_like),
                    func.lower(CompanyProfileModel.industry).like(q_like),
                )
            )
        for field in field_list:
            stmt = stmt.where(CompanyProfileModel.desired_fields.any(field))
        for collab_type in type_list:
            stmt = stmt.where(CompanyProfileModel.collaboration_types.any(collab_type))

        total: int = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
        rows_q = stmt.offset((page - 1) * PAGE_SIZE).limit(PAGE_SIZE)
        rows = list((await db.execute(rows_q)).scalars().all())

        items = [
            RecommendationItem(
                user_id=row.user_id,
                match_score=0.0,
                profile=CompanyProfileResponse.model_validate(row),
            )
            for row in rows
        ]
    else:
        stmt = select(ResearcherProfileModel).where(
            ResearcherProfileModel.is_public.is_(True)
        )

        if q:
            q_like = f"%{q.lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(ResearcherProfileModel.name).like(q_like),
                    func.lower(ResearcherProfileModel.research_summary).like(q_like),
                    func.lower(ResearcherProfileModel.university).like(q_like),
                )
            )
        for field in field_list:
            stmt = stmt.where(ResearcherProfileModel.keywords.any(field))
        for collab_type in type_list:
            stmt = stmt.where(ResearcherProfileModel.collaboration_types.any(collab_type))

        total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
        rows_q = stmt.offset((page - 1) * PAGE_SIZE).limit(PAGE_SIZE)
        rows = list((await db.execute(rows_q)).scalars().all())

        items = [
            RecommendationItem(
                user_id=row.user_id,
                match_score=0.0,
                profile=ResearcherProfileResponse.model_validate(row),
            )
            for row in rows
        ]

    pages = max(1, (total + PAGE_SIZE - 1) // PAGE_SIZE)
    return SearchResult(items=items, total=total, page=page, pages=pages)
