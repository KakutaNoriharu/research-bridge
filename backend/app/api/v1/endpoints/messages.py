from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.match import Match
from app.models.message import Message
from app.models.notification import Notification, NotificationType
from app.models.user import User
from app.schemas.message import (
    MessageCreate,
    MessageResponse,
    ReadCountResponse,
    ThreadSummary,
)

router = APIRouter()


# --------------------------------------------------------------------------- #
# Internal helper                                                              #
# --------------------------------------------------------------------------- #

async def _require_participant(match_id: str, user: User, db: AsyncSession) -> Match:
    """
    match_id が存在し、かつ user がその参加者であることを確認して Match を返す。

    - 存在しない match_id → 404
    - 参加者でない（マッチング未成立を含む）→ 403
    """
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalar_one_or_none()

    if match is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="マッチングが見つかりません",
        )

    if user.id not in (match.researcher_id, match.company_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="このスレッドへのアクセス権がありません。マッチングが成立していない相手へのメッセージは送信できません",
        )

    return match


# --------------------------------------------------------------------------- #
# Endpoints                                                                    #
# --------------------------------------------------------------------------- #

@router.get(
    "",
    response_model=list[ThreadSummary],
    summary="会話スレッド一覧",
)
async def list_threads(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ThreadSummary]:
    """
    ログインユーザーが参加しているマッチングを一覧で返す（SCR-09 サイドバー用）。

    各スレッドに「最終メッセージ」「未読件数（相手から届いた未読のみ）」を付与し、
    最終メッセージの新しい順にソートして返す。
    """
    matches_result = await db.execute(
        select(Match).where(
            or_(
                Match.researcher_id == current_user.id,
                Match.company_id == current_user.id,
            )
        )
    )
    matches = matches_result.scalars().all()

    threads: list[ThreadSummary] = []

    for match in matches:
        # 最新メッセージ 1 件
        last_msg_result = await db.execute(
            select(Message)
            .where(Message.match_id == match.id)
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        last_msg = last_msg_result.scalar_one_or_none()

        # 未読件数（自分以外が送ったメッセージのうち is_read=False のもの）
        unread_result = await db.execute(
            select(func.count())
            .select_from(Message)
            .where(
                Message.match_id == match.id,
                Message.sender_id != current_user.id,
                Message.is_read == False,  # noqa: E712
            )
        )
        unread_count: int = unread_result.scalar() or 0

        partner_id = (
            match.company_id
            if match.researcher_id == current_user.id
            else match.researcher_id
        )

        threads.append(
            ThreadSummary(
                match_id=match.id,
                matched_at=match.matched_at,
                partner_user_id=partner_id,
                last_message=MessageResponse.model_validate(last_msg) if last_msg else None,
                unread_count=unread_count,
            )
        )

    # 最終メッセージが新しい順、メッセージなしのスレッドはマッチング日時順
    threads.sort(
        key=lambda t: t.last_message.created_at if t.last_message else t.matched_at,
        reverse=True,
    )
    return threads


@router.get(
    "/{match_id}",
    response_model=list[MessageResponse],
    summary="メッセージ履歴取得",
    responses={
        403: {"description": "マッチング未成立、または参加者でない"},
        404: {"description": "マッチングが存在しない"},
    },
)
async def get_thread(
    match_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Message]:
    """
    指定スレッドのメッセージ履歴を古い順で返す（SCR-09 チャット本文エリア用）。
    参加者でない場合は 403 を返す。
    """
    await _require_participant(match_id, current_user, db)

    result = await db.execute(
        select(Message)
        .where(Message.match_id == match_id)
        .order_by(Message.created_at.asc())
    )
    return list(result.scalars().all())


@router.post(
    "/{match_id}",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="メッセージ送信",
    responses={
        403: {"description": "マッチングが成立していない相手へのメッセージは送信不可"},
        404: {"description": "マッチングが存在しない"},
    },
)
async def send_message(
    match_id: str,
    body: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Message:
    """
    マッチング済みの相手にテキストメッセージを送信する（MSG-01）。

    - マッチング未成立の相手 → 403
    - body は 1〜5000 文字
    """
    match = await _require_participant(match_id, current_user, db)

    msg = Message(
        match_id=match_id,
        sender_id=current_user.id,
        body=body.body,
    )
    db.add(msg)

    # 相手へ message 通知
    partner_id = (
        match.company_id if current_user.id == match.researcher_id else match.researcher_id
    )
    db.add(Notification(
        user_id=partner_id,
        type=NotificationType.message,
        actor_user_id=current_user.id,
        related_id=match_id,
    ))

    await db.commit()
    await db.refresh(msg)
    return msg


@router.put(
    "/{match_id}/read",
    response_model=ReadCountResponse,
    summary="既読処理",
    responses={
        403: {"description": "参加者でない"},
        404: {"description": "マッチングが存在しない"},
    },
)
async def mark_as_read(
    match_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReadCountResponse:
    """
    スレッド内で相手が送ったメッセージを一括既読にする（MSG-03 未読バッジ更新）。

    - 自分が送ったメッセージは対象外。
    - 既読済みのメッセージは無視される。
    - updated に実際に更新した件数を返す。
    """
    await _require_participant(match_id, current_user, db)

    result = await db.execute(
        update(Message)
        .where(
            Message.match_id == match_id,
            Message.sender_id != current_user.id,
            Message.is_read == False,  # noqa: E712
        )
        .values(is_read=True)
        .execution_options(synchronize_session=False)
    )
    await db.commit()
    return ReadCountResponse(updated=result.rowcount)
