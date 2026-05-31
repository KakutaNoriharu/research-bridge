from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationResponse

router = APIRouter()


@router.get(
    "",
    response_model=list[NotificationResponse],
    summary="通知一覧取得（最新50件）",
)
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Notification]:
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    return list(result.scalars().all())


@router.put(
    "/read-all",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="全通知既読処理",
)
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    await db.execute(
        update(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,  # noqa: E712
        )
        .values(is_read=True)
        .execution_options(synchronize_session=False)
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
