from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.match import Match
from app.models.researcher_profile import ResearcherProfile as ResearcherProfileModel
from app.models.user import User
from app.schemas.matching import MatchResponse, RecommendationItem
from app.schemas.profile import CompanyProfileResponse, ResearcherProfileResponse
from app.services.matching import get_recommendations

router = APIRouter()


@router.get(
    "/recommendations",
    response_model=list[RecommendationItem],
    summary="AIレコメンド一覧（上位10件）",
)
async def recommendations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[RecommendationItem]:
    """
    ログインユーザーの embedding と反対ロールのプロフィールを
    pgvector コサイン類似度でスコアリングし、上位10件を返す。

    - researcher → 企業プロフィールのレコメンド
    - company   → 公開中の研究者プロフィールのレコメンド

    プロフィール未作成・embedding 未生成の場合は空リストを返す。
    """
    pairs = await get_recommendations(current_user=current_user, db=db)

    items: list[RecommendationItem] = []
    for profile, score in pairs:
        if isinstance(profile, ResearcherProfileModel):
            profile_resp: ResearcherProfileResponse | CompanyProfileResponse = (
                ResearcherProfileResponse.model_validate(profile)
            )
        else:
            profile_resp = CompanyProfileResponse.model_validate(profile)

        # profile 内の match_score にも同じ値を入れることで
        # SCR-06（詳細画面）でのスコア表示に流用できる
        profile_resp.match_score = score

        items.append(
            RecommendationItem(
                user_id=profile.user_id,
                match_score=score,
                profile=profile_resp,
            )
        )

    return items


@router.get(
    "/matches",
    response_model=list[MatchResponse],
    summary="成立済みマッチング一覧",
)
async def list_matches(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Match]:
    """
    ログインユーザーが関係する成立済みマッチング一覧を返す（SCR-08）。

    - researcher: researcher_id が自分のマッチング
    - company:   company_id   が自分のマッチング
    """
    from app.models.user import UserRole

    if current_user.role == UserRole.researcher:
        condition = Match.researcher_id == current_user.id
    else:
        condition = Match.company_id == current_user.id

    result = await db.execute(
        select(Match).where(condition).order_by(Match.matched_at.desc())
    )
    return list(result.scalars().all())
