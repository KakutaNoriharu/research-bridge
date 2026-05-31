from fastapi import APIRouter, Depends, HTTPException, status
from openai import OpenAIError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_optional_user
from app.core.database import get_db
from app.models.company_profile import CompanyProfile
from app.models.researcher_profile import ResearcherProfile
from app.models.user import User, UserRole
from app.schemas.profile import (
    CompanyProfileResponse,
    CompanyProfileUpsert,
    ResearcherProfileResponse,
    ResearcherProfileUpsert,
)
from app.services.embedding import (
    build_company_text,
    build_researcher_text,
    generate_embedding,
)

router = APIRouter()


# --------------------------------------------------------------------------- #
# Internal helpers                                                             #
# --------------------------------------------------------------------------- #

async def _embed(text: str) -> list[float] | None:
    """Embedding 生成。OpenAI エラーを 503 に変換する。"""
    try:
        return await generate_embedding(text)
    except OpenAIError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Embedding 生成サービスが一時的に利用できません。しばらく待ってから再試行してください",
        ) from exc


def _require_role(user: User, role: UserRole, label: str) -> None:
    if user.role != role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{label}アカウントのみ操作できます",
        )


# =========================================================================== #
# Researcher プロフィール                                                       #
# =========================================================================== #

@router.post(
    "/researcher",
    response_model=ResearcherProfileResponse,
    status_code=status.HTTP_201_CREATED,
    summary="研究者プロフィール作成",
    responses={
        403: {"description": "研究者アカウント以外はアクセス不可"},
        409: {"description": "プロフィールが既に存在する"},
    },
)
async def create_researcher_profile(
    body: ResearcherProfileUpsert,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ResearcherProfile:
    _require_role(current_user, UserRole.researcher, "研究者")

    existing = await db.execute(
        select(ResearcherProfile).where(ResearcherProfile.user_id == current_user.id)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="プロフィールは既に作成されています。更新は PUT /profiles/researcher を使用してください",
        )

    # Embedding 生成（research_summary + keywords）
    embed_text = build_researcher_text(body.research_summary, body.keywords)
    embedding = await _embed(embed_text)

    profile = ResearcherProfile(
        user_id=current_user.id,
        embedding=embedding,
        **body.model_dump(),
    )
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return profile


@router.put(
    "/researcher",
    response_model=ResearcherProfileResponse,
    summary="研究者プロフィール更新",
    responses={
        403: {"description": "研究者アカウント以外はアクセス不可"},
        404: {"description": "プロフィールが未作成"},
    },
)
async def update_researcher_profile(
    body: ResearcherProfileUpsert,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ResearcherProfile:
    _require_role(current_user, UserRole.researcher, "研究者")

    result = await db.execute(
        select(ResearcherProfile).where(ResearcherProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="プロフィールが見つかりません。先に POST /profiles/researcher で作成してください",
        )

    # Embedding 再生成は対象フィールドが変化したときのみ（OpenAI コスト節約）
    new_text = build_researcher_text(body.research_summary, body.keywords)
    old_text = build_researcher_text(profile.research_summary, profile.keywords or [])
    new_embedding = profile.embedding  # デフォルトは既存値を維持
    if new_text != old_text:
        new_embedding = await _embed(new_text)

    # フィールド一括更新（Embedding 再生成が完了してから変更を適用）
    for field, value in body.model_dump().items():
        setattr(profile, field, value)
    profile.embedding = new_embedding

    await db.commit()
    await db.refresh(profile)
    return profile


@router.get(
    "/researcher/{user_id}",
    response_model=ResearcherProfileResponse,
    summary="研究者プロフィール取得",
    responses={
        404: {"description": "プロフィールが存在しない、または非公開"},
    },
)
async def get_researcher_profile(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
) -> ResearcherProfile:
    result = await db.execute(
        select(ResearcherProfile).where(ResearcherProfile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()

    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="プロフィールが見つかりません")

    # 非公開プロフィールは本人のみ閲覧可。存在有無を漏らさないため 404 を返す
    if not profile.is_public and (current_user is None or current_user.id != user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="プロフィールが見つかりません")

    return profile


# =========================================================================== #
# Company プロフィール                                                          #
# =========================================================================== #

@router.post(
    "/company",
    response_model=CompanyProfileResponse,
    status_code=status.HTTP_201_CREATED,
    summary="企業プロフィール作成",
    responses={
        403: {"description": "企業アカウント以外はアクセス不可"},
        409: {"description": "プロフィールが既に存在する"},
    },
)
async def create_company_profile(
    body: CompanyProfileUpsert,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CompanyProfile:
    _require_role(current_user, UserRole.company, "企業")

    existing = await db.execute(
        select(CompanyProfile).where(CompanyProfile.user_id == current_user.id)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="プロフィールは既に作成されています。更新は PUT /profiles/company を使用してください",
        )

    # Embedding 生成（tech_needs + desired_fields）
    embed_text = build_company_text(body.tech_needs, body.desired_fields)
    embedding = await _embed(embed_text)

    profile = CompanyProfile(
        user_id=current_user.id,
        embedding=embedding,
        **body.model_dump(),
    )
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return profile


@router.put(
    "/company",
    response_model=CompanyProfileResponse,
    summary="企業プロフィール更新",
    responses={
        403: {"description": "企業アカウント以外はアクセス不可"},
        404: {"description": "プロフィールが未作成"},
    },
)
async def update_company_profile(
    body: CompanyProfileUpsert,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CompanyProfile:
    _require_role(current_user, UserRole.company, "企業")

    result = await db.execute(
        select(CompanyProfile).where(CompanyProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="プロフィールが見つかりません。先に POST /profiles/company で作成してください",
        )

    # Embedding 再生成は対象フィールドが変化したときのみ
    new_text = build_company_text(body.tech_needs, body.desired_fields)
    old_text = build_company_text(profile.tech_needs, profile.desired_fields or [])
    new_embedding = profile.embedding
    if new_text != old_text:
        new_embedding = await _embed(new_text)

    for field, value in body.model_dump().items():
        setattr(profile, field, value)
    profile.embedding = new_embedding

    await db.commit()
    await db.refresh(profile)
    return profile


@router.get(
    "/company/{user_id}",
    response_model=CompanyProfileResponse,
    summary="企業プロフィール取得",
    responses={
        404: {"description": "プロフィールが存在しない、または非公開"},
    },
)
async def get_company_profile(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
) -> CompanyProfile:
    result = await db.execute(
        select(CompanyProfile).where(CompanyProfile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()

    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="プロフィールが見つかりません")

    if not profile.is_public and (current_user is None or current_user.id != user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="プロフィールが見つかりません")

    return profile
