"""OAuth (카카오·구글) — 07_api_spec.md §2."""
from __future__ import annotations

import secrets
from typing import Annotated, Literal
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Cookie, Query, Response
from fastapi.responses import RedirectResponse

from app.api.deps import SessionDep
from app.config import get_settings
from app.core import errors
from app.services.auth_service import AuthService

router = APIRouter(prefix="/api/auth", tags=["auth"])

STATE_COOKIE_NAME = "oauth_state"
REFRESH_COOKIE_NAME = "refresh_token"

Provider = Literal["kakao", "google"]

_AUTHORIZE_URLS = {
    "kakao": "https://kauth.kakao.com/oauth/authorize",
    "google": "https://accounts.google.com/o/oauth2/v2/auth",
}
_TOKEN_URLS = {
    "kakao": "https://kauth.kakao.com/oauth/token",
    "google": "https://oauth2.googleapis.com/token",
}
_USERINFO_URLS = {
    "kakao": "https://kapi.kakao.com/v2/user/me",
    "google": "https://www.googleapis.com/oauth2/v3/userinfo",
}
_SCOPES = {"kakao": "profile_nickname", "google": "openid email profile"}


def _client_id(p: str) -> str:
    s = get_settings()
    return s.KAKAO_CLIENT_ID if p == "kakao" else s.GOOGLE_CLIENT_ID


def _client_secret(p: str) -> str:
    s = get_settings()
    return s.KAKAO_CLIENT_SECRET if p == "kakao" else s.GOOGLE_CLIENT_SECRET


def _redirect_uri(p: str) -> str:
    s = get_settings()
    return s.KAKAO_REDIRECT_URI if p == "kakao" else s.GOOGLE_REDIRECT_URI


def _fe_landing_url() -> str:
    origins = get_settings().cors_origins_list
    return origins[0] if origins else "http://localhost:5173"


def _ensure_oauth_configured(p: str) -> None:
    if not _client_id(p) or not _client_secret(p) or not _redirect_uri(p):
        raise errors.DomainError(
            status_code=503, error_code="SERVICE_UNAVAILABLE",
            message=f"{p} OAuth가 구성되지 않았습니다.",
        )


@router.get("/login/{provider}")
async def login_redirect(provider: Provider) -> RedirectResponse:
    _ensure_oauth_configured(provider)
    state = secrets.token_urlsafe(24)
    params = {
        "client_id": _client_id(provider),
        "redirect_uri": _redirect_uri(provider),
        "response_type": "code",
        "scope": _SCOPES[provider],
        "state": state,
    }
    url = f"{_AUTHORIZE_URLS[provider]}?{urlencode(params)}"
    resp = RedirectResponse(url=url, status_code=302)
    s = get_settings()
    resp.set_cookie(
        key=STATE_COOKIE_NAME, value=state, max_age=600, httponly=True,
        secure=s.APP_ENV != "development", samesite="lax", path="/",
    )
    return resp


@router.get("/callback/{provider}")
async def callback(
    provider: Provider, session: SessionDep,
    code: Annotated[str, Query()], state: Annotated[str, Query()],
    oauth_state: Annotated[str | None, Cookie()] = None,
) -> Response:
    _ensure_oauth_configured(provider)
    if not oauth_state or not secrets.compare_digest(state, oauth_state):
        raise errors.DomainError(
            status_code=400, error_code="AUTH_SOCIAL_LOGIN_FAILED",
            message="state가 일치하지 않습니다.",
        )
    token_data = await _exchange_code(provider, code)
    access = token_data.get("access_token")
    if not isinstance(access, str):
        raise errors.DomainError(
            status_code=400, error_code="AUTH_SOCIAL_LOGIN_FAILED",
            message="OAuth 토큰 교환에 실패했습니다.",
        )
    profile = await _fetch_userinfo(provider, access)
    tokens, _ = await AuthService(session).login_with_oauth(
        provider=provider, social_id=profile["social_id"],
        email=profile["email"], name=profile["name"],
    )
    s = get_settings()
    resp = RedirectResponse(url=_fe_landing_url(), status_code=302)
    resp.set_cookie(
        key=REFRESH_COOKIE_NAME, value=tokens.refresh_token,
        max_age=s.JWT_REFRESH_TOKEN_TTL_SECONDS, httponly=True,
        secure=s.APP_ENV != "development", samesite="lax", path="/",
    )
    resp.delete_cookie(STATE_COOKIE_NAME, path="/")
    return resp


async def _exchange_code(provider: str, code: str) -> dict:
    payload = {
        "grant_type": "authorization_code",
        "client_id": _client_id(provider),
        "client_secret": _client_secret(provider),
        "redirect_uri": _redirect_uri(provider),
        "code": code,
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(_TOKEN_URLS[provider], data=payload)
    if r.status_code != 200:
        raise errors.DomainError(
            status_code=400, error_code="AUTH_SOCIAL_LOGIN_FAILED",
            message="OAuth 인가 코드 처리 실패", detail={"status": r.status_code},
        )
    return r.json()


async def _fetch_userinfo(provider: str, access_token: str) -> dict[str, str]:
    headers = {"Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(_USERINFO_URLS[provider], headers=headers)
    if r.status_code != 200:
        raise errors.DomainError(
            status_code=400, error_code="AUTH_SOCIAL_LOGIN_FAILED",
            message="사용자 정보 조회 실패",
        )
    data = r.json()
    if provider == "kakao":
        acc = data.get("kakao_account", {}) or {}
        prof = acc.get("profile", {}) or {}
        return {
            "social_id": str(data.get("id", "")),
            "email": acc.get("email") or f"kakao_{data.get('id')}@social.example.com",
            "name": prof.get("nickname") or "카카오사용자",
        }
    return {
        "social_id": str(data.get("sub", "")),
        "email": data.get("email") or f"google_{data.get('sub')}@social.example.com",
        "name": data.get("name") or "Google User",
    }
