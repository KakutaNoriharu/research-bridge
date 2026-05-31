from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company_profile import CompanyProfile
from app.models.researcher_profile import ResearcherProfile
from app.models.user import User, UserRole


async def get_recommendations(
    current_user: User,
    db: AsyncSession,
    top_k: int = 10,
) -> list[tuple[ResearcherProfile | CompanyProfile, float]]:
    """
    current_user の embedding と反対ロールプロフィールの
    pgvector コサイン距離を計算し、スコア上位 top_k 件を返す。

    - researcher → 企業プロフィールを対象に検索
    - company   → 公開中の研究者プロフィールを対象に検索

    Returns:
        [(profile, match_score), ...]  match_score ∈ [0.0, 1.0]

    Notes:
        <=> 演算子はコサイン距離 (0 = 同一方向, 2 = 逆方向) を返す。
        OpenAI embeddings は正規化済みベクトルなので:
          match_score = 1 - cosine_distance  ∈ [0.0, 1.0]
    """
    if current_user.role == UserRole.researcher:
        own_emb = await _fetch_embedding(
            db, select(ResearcherProfile.embedding).where(
                ResearcherProfile.user_id == current_user.id
            )
        )
        if own_emb is None:
            return []

        distance_expr = CompanyProfile.embedding.cosine_distance(own_emb)
        stmt = (
            select(CompanyProfile, distance_expr.label("distance"))
            .where(
                CompanyProfile.user_id != current_user.id,
                CompanyProfile.embedding.is_not(None),
            )
            .order_by(distance_expr)
            .limit(top_k)
        )
    else:
        own_emb = await _fetch_embedding(
            db, select(CompanyProfile.embedding).where(
                CompanyProfile.user_id == current_user.id
            )
        )
        if own_emb is None:
            return []

        distance_expr = ResearcherProfile.embedding.cosine_distance(own_emb)
        stmt = (
            select(ResearcherProfile, distance_expr.label("distance"))
            .where(
                ResearcherProfile.is_public == True,  # noqa: E712
                ResearcherProfile.user_id != current_user.id,
                ResearcherProfile.embedding.is_not(None),
            )
            .order_by(distance_expr)
            .limit(top_k)
        )

    rows = (await db.execute(stmt)).fetchall()
    return [
        (profile, _to_score(distance))
        for profile, distance in rows
    ]


# --------------------------------------------------------------------------- #
# Helpers                                                                      #
# --------------------------------------------------------------------------- #

async def _fetch_embedding(db: AsyncSession, stmt) -> list[float] | None:
    """embedding カラムのみ取得する。プロフィール未作成 / embedding 未生成なら None。"""
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


def _to_score(distance: float) -> float:
    """コサイン距離 [0, 2] → 類似度スコア [0.0, 1.0] へ変換。小数点第4位に丸める。"""
    return round(max(0.0, 1.0 - float(distance)), 4)
