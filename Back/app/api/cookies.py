"""인증 Cookie — Refresh Token(03_be.md §7.3)·소셜 가입 대기 토큰(§7.1)."""
from __future__ import annotations

from fastapi import Response

from app.config import get_settings
from app.core import security

REFRESH_COOKIE_NAME = "refresh_token"
SIGNUP_COOKIE_NAME = "signup_token"
_SIGNUP_COOKIE_PATH = "/api/auth"


def set_refresh_cookie(response: Response, refresh_token: str | None) -> None:
    """Refresh Token이 없으면(사업자 검증 전 계정) 남은 Cookie를 지운다."""
    if refresh_token is None:
        clear_refresh_cookie(response)
        return
    s = get_settings()
    response.set_cookie(
        key=REFRESH_COOKIE_NAME, value=refresh_token,
        max_age=s.JWT_REFRESH_TOKEN_TTL_SECONDS, httponly=True,
        secure=s.APP_ENV != "development", samesite="lax", path="/",
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(key=REFRESH_COOKIE_NAME, path="/")


def set_signup_cookie(response: Response, signup_token: str) -> None:
    s = get_settings()
    response.set_cookie(
        key=SIGNUP_COOKIE_NAME, value=signup_token,
        max_age=security.SIGNUP_TOKEN_TTL_SECONDS, httponly=True,
        secure=s.APP_ENV != "development", samesite="lax", path=_SIGNUP_COOKIE_PATH,
    )


def clear_signup_cookie(response: Response) -> None:
    response.delete_cookie(key=SIGNUP_COOKIE_NAME, path=_SIGNUP_COOKIE_PATH)
