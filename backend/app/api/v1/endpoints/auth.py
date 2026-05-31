from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.user import TokenResponse, UserLogin, UserRegister, UserResponse

router = APIRouter()


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="新規ユーザー登録",
    responses={
        409: {"description": "メールアドレスが既に登録済み"},
    },
)
async def register(body: UserRegister, db: AsyncSession = Depends(get_db)) -> User:
    """
    ロール（researcher / company）、メールアドレス、パスワードでユーザーを作成する。

    - パスワードは bcrypt でハッシュ化して保存する。
    - 登録後は `/auth/login` でトークンを取得すること。
    """
    # メールアドレスの重複チェック
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="このメールアドレスはすでに登録されています",
        )

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        role=body.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="ログイン・JWT 発行",
    responses={
        401: {"description": "メールアドレスまたはパスワードが不正"},
    },
)
async def login(body: UserLogin, db: AsyncSession = Depends(get_db)) -> dict:
    """
    メールアドレスとパスワードで認証し、JWT アクセストークンを返す。

    - トークンの有効期限は 24 時間。
    - 以降のリクエストは `Authorization: Bearer <token>` ヘッダーで認証する。
    """
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    # ユーザー不在とパスワード不一致を同一エラーにすることでユーザー列挙攻撃を防ぐ
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="メールアドレスまたはパスワードが正しくありません",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {"access_token": create_access_token(user.id), "token_type": "bearer"}


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="ログアウト",
    dependencies=[Depends(get_current_user)],
)
async def logout() -> Response:
    """
    現在のアクセストークンを無効化してログアウトする。

    **実装メモ:** JWT はステートレスなため、サーバー側でのトークン保持は行わない。
    クライアントはレスポンス受信後にトークンを破棄すること。
    本番環境でサーバー側失効が必要な場合は `jti` を Redis ブラックリストに登録する方式を推奨。
    """
    return Response(status_code=status.HTTP_204_NO_CONTENT)
