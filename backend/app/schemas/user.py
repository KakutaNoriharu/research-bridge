from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator

from app.models.user import UserRole


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    role: UserRole

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("パスワードは8文字以上で入力してください")
        # bcrypt は先頭 72 バイトしか処理しないため上限を設ける
        if len(v.encode("utf-8")) > 72:
            raise ValueError("パスワードは72バイト（半角72文字・全角24文字）以内で入力してください")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    role: UserRole
    created_at: datetime

    model_config = {"from_attributes": True}
