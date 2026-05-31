from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.interest import Interest, InterestStatus
from app.models.match import Match
from app.models.notification import Notification, NotificationType
from app.models.user import User, UserRole
from app.schemas.matching import InterestCreate, InterestListResponse, InterestResponse

router = APIRouter()


@router.post(
    "",
    response_model=InterestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="インタレスト送信",
    responses={
        400: {"description": "自分自身 / 同一ロール への送信、または取り消し済み"},
        404: {"description": "送信先ユーザーが存在しない"},
        409: {"description": "既に pending / matched のインタレストが存在する"},
    },
)
async def send_interest(
    body: InterestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Interest:
    """
    相手プロフィールへ「興味あり」を送信する。

    双方向チェック:
    - 既に相手が自分に pending インタレストを送っていれば
      両方を matched に更新し、matches テーブルに登録してマッチング成立とする。
    """
    # ── 1. 自分自身チェック ───────────────────────────────────────────────
    if current_user.id == body.receiver_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="自分自身にインタレストを送ることはできません",
        )

    # ── 2. 受信者の存在確認 ───────────────────────────────────────────────
    receiver_result = await db.execute(select(User).where(User.id == body.receiver_id))
    receiver = receiver_result.scalar_one_or_none()
    if receiver is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="送信先ユーザーが見つかりません")

    # ── 3. 異なるロールのみ許可（研究者↔企業） ───────────────────────────
    if current_user.role == receiver.role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="同じロール（研究者同士・企業同士）へのインタレストは送信できません",
        )

    # ── 4. 重複チェック（pending / matched） ──────────────────────────────
    dup = await db.execute(
        select(Interest).where(
            Interest.sender_id == current_user.id,
            Interest.receiver_id == body.receiver_id,
            Interest.status.in_([InterestStatus.pending, InterestStatus.matched]),
        )
    )
    if dup.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="既にインタレストを送信済みです")

    # ── 5. インタレスト作成 ───────────────────────────────────────────────
    interest = Interest(sender_id=current_user.id, receiver_id=body.receiver_id)
    db.add(interest)

    # 受信者へ interest 通知
    db.add(Notification(
        user_id=body.receiver_id,
        type=NotificationType.interest,
        actor_user_id=current_user.id,
    ))

    # ── 6. 相互インタレスト確認 → マッチング成立 ─────────────────────────
    mutual_result = await db.execute(
        select(Interest).where(
            Interest.sender_id == body.receiver_id,
            Interest.receiver_id == current_user.id,
            Interest.status == InterestStatus.pending,
        )
    )
    mutual = mutual_result.scalar_one_or_none()

    if mutual is not None:
        # 双方を matched へ更新
        interest.status = InterestStatus.matched
        mutual.status = InterestStatus.matched

        # matches テーブルへ登録（researcher_id / company_id を正規化）
        if current_user.role == UserRole.researcher:
            researcher_id, company_id = current_user.id, body.receiver_id
        else:
            researcher_id, company_id = body.receiver_id, current_user.id

        new_match = Match(researcher_id=researcher_id, company_id=company_id)
        db.add(new_match)

        # 双方へ match 通知（id は Python-side default で即時利用可能）
        db.add(Notification(
            user_id=current_user.id,
            type=NotificationType.match,
            actor_user_id=body.receiver_id,
            related_id=new_match.id,
        ))
        db.add(Notification(
            user_id=body.receiver_id,
            type=NotificationType.match,
            actor_user_id=current_user.id,
            related_id=new_match.id,
        ))

    await db.commit()
    await db.refresh(interest)
    return interest


@router.get(
    "",
    response_model=InterestListResponse,
    summary="インタレスト一覧取得（送受信）",
)
async def list_interests(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InterestListResponse:
    """
    ログインユーザーの送信済み・受信済みインタレストを分けて返す（SCR-10）。
    各リストは作成日時の降順。
    """
    sent_result = await db.execute(
        select(Interest)
        .where(Interest.sender_id == current_user.id)
        .order_by(Interest.created_at.desc())
    )
    received_result = await db.execute(
        select(Interest)
        .where(Interest.receiver_id == current_user.id)
        .order_by(Interest.created_at.desc())
    )
    return InterestListResponse(
        sent=list(sent_result.scalars().all()),
        received=list(received_result.scalars().all()),
    )


@router.delete(
    "/{interest_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="インタレスト取り消し",
    responses={
        400: {"description": "pending 以外のインタレストは取り消し不可"},
        404: {"description": "インタレストが存在しない、または自分が送信したものではない"},
    },
)
async def withdraw_interest(
    interest_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    """
    送信済みインタレストを取り消す。

    - 自分が送ったインタレストのみ取り消し可能。
    - status が `pending` の場合のみ取り消せる（matched は取り消し不可）。
    - 物理削除は行わず status を `withdrawn` に変更する（監査証跡保持）。
    """
    result = await db.execute(
        select(Interest).where(
            Interest.id == interest_id,
            Interest.sender_id == current_user.id,  # 他人のインタレストは操作不可
        )
    )
    interest = result.scalar_one_or_none()

    if interest is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="インタレストが見つかりません",
        )

    if interest.status != InterestStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"ステータスが '{interest.status}' のため取り消せません。取り消しは pending のみ可能です",
        )

    interest.status = InterestStatus.withdrawn
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
