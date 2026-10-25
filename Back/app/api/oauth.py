"""OAuth (카카오·구글) — 02_implementation_design.md §3.2, 03_be.md §7.

Authlib이 state(CSRF) 발급·검사와 인가 코드 교환을 맡는다. state는 서명된 세션 쿠키
(main.py SessionMiddleware)에 담긴다. 구글은 OIDC라 id_token 서명·nonce까지 검증한다.
"""
from __future__ import annotations

from typing import Literal

from authlib.integrations.starlette_client import OAuth, OAuthError
from fastapi import APIRouter, Request, Response
from fastapi.responses import RedirectResponse

from app.api.deps import SessionDep
from app.config import get_settings
from app.core import errors
from app.services.auth_service import AuthService

router = APIRouter(prefix="/api/auth", tags=["auth"])

REFRESH_COOKIE_NAME = "refresh_token"

Provider = Literal["kakao", "google"]

_settings = get_settings()
_oauth = OAuth()
_oauth.register(
    name="kakao",
    client_id=_settings.KAKAO_CLIENT_ID,
    client_secret=_settings.KAKAO_CLIENT_SECRET,
    authorize_url="https://kauth.kakao.com/oauth/authorize",
    access_token_url="https://kauth.kakao.com/oauth/token",
    api_base_url="https://kapi.kakao.com/",
    # 카카오는 client_secret을 요청 본문으로 받는다
    client_kwargs={"scope": "profile_nickname", "token_endpoint_auth_method": "client_secret_post"},
)
_oauth.register(
    name="google",
    client_id=_settings.GOOGLE_CLIENT_ID,
    client_secret=_settings.GOOGLE_CLIENT_SECRET,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)


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
async def login_redirect(provider: Provider, request: Request) -> RedirectResponse:
    _ensure_oauth_configured(provider)
    return await _oauth.create_client(provider).authorize_redirect(
        request, _redirect_uri(provider)
    )


@router.get("/callback/{provider}")
async def callback(provider: Provider, request: Request, session: SessionDep) -> Response:
    _ensure_oauth_configured(provider)
    try:
        token = await _authorize(provider, request)
        profile = await _fetch_userinfo(provider, token)
    except OAuthError as exc:
        raise errors.DomainError(
            status_code=400, error_code="AUTH_SOCIAL_LOGIN_FAILED",
            message="소셜 로그인에 실패했습니다.", detail={"reason": exc.error},
        ) from exc
    try:
        tokens, _ = await AuthService(session).login_with_oauth(
            provider=provider, social_id=profile["social_id"],
            email=profile["email"], name=profile["name"],
        )
    except errors.DomainError as exc:
        # 브라우저 이동 중이라 JSON 대신 FE 로그인 화면으로 사유를 넘긴다
        # (02_implementation_design.md §3.2)
        if exc.detail.get("error") != "AUTH_ACCOUNT_WITHDRAWN":
            raise
        return RedirectResponse(url=f"{_fe_landing_url()}/login?error=withdrawn", status_code=302)
    s = get_settings()
    resp = RedirectResponse(url=_fe_landing_url(), status_code=302)
    resp.set_cookie(
        key=REFRESH_COOKIE_NAME, value=tokens.refresh_token,
        max_age=s.JWT_REFRESH_TOKEN_TTL_SECONDS, httponly=True,
        secure=s.APP_ENV != "development", samesite="lax", path="/",
    )
    return resp


async def _authorize(provider: str, request: Request) -> dict:
    """state 검사 + 인가 코드 교환. 구글은 id_token 검증 결과가 token["userinfo"]에 담긴다."""
    return await _oauth.create_client(provider).authorize_access_token(request)


async def _fetch_userinfo(provider: str, token: dict) -> dict[str, str]:
    if provider == "kakao":
        r = await _oauth.kakao.get("v2/user/me", token=token)
        if r.status_code != 200:
            raise OAuthError(error="userinfo_failed", description="사용자 정보 조회 실패")
        data = r.json()
        acc = data.get("kakao_account", {}) or {}
        prof = acc.get("profile", {}) or {}
        return {
            "social_id": str(data.get("id", "")),
            "email": acc.get("email") or f"kakao_{data.get('id')}@social.example.com",
            "name": prof.get("nickname") or "카카오사용자",
        }
    info = token.get("userinfo")
    if not info:
        raise OAuthError(error="missing_id_token", description="구글 id_token이 없습니다")
    return {
        "social_id": str(info.get("sub", "")),
        "email": info.get("email") or f"google_{info.get('sub')}@social.example.com",
        "name": info.get("name") or "Google User",
    }
