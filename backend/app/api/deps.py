from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User

# tokenUrl は Swagger UI の Authorize ボタン用。
# ログインエンドポイントは JSON 受付のため、Swagger UI の OAuth2 フローは動作しない点に注意。
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
_optional_oauth2 = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

_UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="認証情報が無効です",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Authorization: Bearer <token> ヘッダーを検証して User を返す。必須認証用。"""
    user_id = decode_access_token(token)
    if user_id is None:
        raise _UNAUTHORIZED

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise _UNAUTHORIZED

    return user


async def get_optional_user(
    token: str | None = Depends(_optional_oauth2),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """トークンがあれば User を返し、なければ None を返す。公開エンドポイントの任意認証用。"""
    if not token:
        return None
    user_id = decode_access_token(token)
    if user_id is None:
        return None
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()
