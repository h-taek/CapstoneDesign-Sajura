"""bcrypt + JWT + SHA-256 refresh hash — 03_be.md §7."""
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


SIGNUP_TOKEN_TTL_SECONDS = 30 * 60
_SIGNUP_PURPOSE = "social_signup"


def create_signup_token(*, provider: str, social_id: str, email: str, name: str) -> str:
    """소셜 가입 대기 토큰 — 처음 보는 소셜 계정의 콜백에서 발급 (03_be.md §7.1).

    `sub`가 없어 Access Token으로 쓸 수 없다.
    """
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "purpose": _SIGNUP_PURPOSE, "provider": provider, "social_id": social_id,
        "email": email, "name": name,
        "exp": int((now + timedelta(seconds=SIGNUP_TOKEN_TTL_SECONDS)).timestamp()),
        "iat": int(now.timestamp()),
    }
    return jwt.encode(payload, _settings.JWT_SECRET, algorithm=_settings.JWT_ALGORITHM)


def decode_signup_token(token: str) -> dict[str, Any]:
    """만료·위조·다른 용도의 토큰이면 JWTError."""
    payload = jwt.decode(token, _settings.JWT_SECRET, algorithms=[_settings.JWT_ALGORITHM])
    if payload.get("purpose") != _SIGNUP_PURPOSE:
        raise JWTError("not a signup token")
    return payload


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_refresh_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def refresh_token_expiry() -> datetime:
    return datetime.now(UTC) + timedelta(seconds=_settings.JWT_REFRESH_TOKEN_TTL_SECONDS)
