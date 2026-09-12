"""bcrypt + JWT + SHA-256 refresh hash — 12_security.md §2."""
from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import get_settings

_settings = get_settings()
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


def create_access_token(*, user_id: str, store_id: str | None) -> tuple[str, int]:
    ttl = _settings.JWT_ACCESS_TOKEN_TTL_SECONDS
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": user_id, "store_id": store_id,
        "exp": int((now + timedelta(seconds=ttl)).timestamp()),
        "iat": int(now.timestamp()),
    }
    token = jwt.encode(payload, _settings.JWT_SECRET, algorithm=_settings.JWT_ALGORITHM)
    return token, ttl


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, _settings.JWT_SECRET, algorithms=[_settings.JWT_ALGORITHM])
    except JWTError:
        raise


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_refresh_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def refresh_token_expiry() -> datetime:
    return datetime.now(UTC) + timedelta(seconds=_settings.JWT_REFRESH_TOKEN_TTL_SECONDS)
