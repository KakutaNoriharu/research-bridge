import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings

# --------------------------------------------------------------------------- #
# Password hashing (bcrypt)                                                    #
# --------------------------------------------------------------------------- #
# bcrypt は入力の先頭 72 バイトのみ処理する。
# Pydantic スキーマ側でバイト長を 72 以内に制限しておくこと。

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# --------------------------------------------------------------------------- #
# JWT                                                                          #
# --------------------------------------------------------------------------- #

def create_access_token(subject: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "iat": now,
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "jti": str(uuid.uuid4()),  # 将来の Redis ブラックリスト実装用
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> str | None:
    """JWT をデコードして subject (user_id) を返す。期限切れ・不正な場合は None。"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None
