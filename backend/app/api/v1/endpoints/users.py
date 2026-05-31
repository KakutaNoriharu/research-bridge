from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.user import UserResponse

router = APIRouter()


@router.get("/me", response_model=UserResponse, summary="現在のユーザー情報取得")
async def get_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
