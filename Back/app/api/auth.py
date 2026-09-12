"""/api/auth/* — 07_api_spec.md §2."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Cookie, Response, status

from app.api.deps import CurrentUserDep, SessionDep
from app.config import get_settings
from app.core import errors
from app.schemas.auth import (
    ChangePasswordRequest,
    DeleteAccountRequest,
    LoginRequest,
    RegisterRequest,
    RegisterResponse,
    TokenResponse,
    UpdateMeRequest,
    UserMeResponse,
)
from app.services.auth_service import AuthService, IssuedTokens

router = APIRouter(prefix="/api/auth", tags=["auth"])

REFRESH_COOKIE_NAME = "refresh_token"


def _set_refresh_cookie(response: Response, tokens: IssuedTokens) -> None:
    s = get_settings()
    response.set_cookie(
        key=REFRESH_COOKIE_NAME, value=tokens.refresh_token,
        max_age=s.JWT_REFRESH_TOKEN_TTL_SECONDS, httponly=True,
        secure=s.APP_ENV != "development", samesite="lax", path="/",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(key=REFRESH_COOKIE_NAME, path="/")


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, session: SessionDep) -> RegisterResponse:
    user = await AuthService(session).register(
        email=payload.email, password=payload.password, name=payload.name,
    )
    return RegisterResponse(user_id=user.user_id, email=user.email, name=user.name)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, response: Response, session: SessionDep) -> TokenResponse:
    tokens, store = await AuthService(session).login_with_email(
        email=payload.email, password=payload.password
    )
    _set_refresh_cookie(response, tokens)
    return TokenResponse(
        access_token=tokens.access_token, expires_in=tokens.expires_in,
        business_status=store.business_status.value if store else "UNVERIFIED",
        onboarding_completed=bool(store.onboarding_completed) if store else False,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    response: Response, session: SessionDep,
    refresh_token: Annotated[str | None, Cookie()] = None,
) -> TokenResponse:
    if not refresh_token:
        raise errors.auth_refresh_token_invalid()
    tokens = await AuthService(session).refresh(raw_refresh=refresh_token)
    _set_refresh_cookie(response, tokens)
    return TokenResponse(access_token=tokens.access_token, expires_in=tokens.expires_in)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, response_class=Response, response_model=None)
async def logout(
    response: Response, session: SessionDep, current: CurrentUserDep,
    refresh_token: Annotated[str | None, Cookie()] = None,
) -> Response:
    await AuthService(session).logout(raw_refresh=refresh_token)
    _clear_refresh_cookie(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT, response_class=Response, response_model=None)
async def logout_all(
    response: Response, session: SessionDep, current: CurrentUserDep
) -> Response:
    await AuthService(session).logout_all(user_id=current.user_id)
    _clear_refresh_cookie(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/me", response_model=UserMeResponse)
async def get_me(session: SessionDep, current: CurrentUserDep) -> UserMeResponse:
    s = AuthService(session)
    user = await s.get_user(current.user_id)
    store = await s.get_store(current.user_id)
    return UserMeResponse(
        user_id=user.user_id, email=user.email, name=user.name,
        auth_provider=user.auth_provider.value,
        role=user.role.value,
        store_name=store.store_name if store else None,
        business_no=store.business_no if store else None,
        business_status=store.business_status.value if store else "UNVERIFIED",
        onboarding_completed=bool(store.onboarding_completed) if store else False,
        created_at=user.created_at,
    )


@router.patch("/me", response_model=UserMeResponse)
async def update_me(
    payload: UpdateMeRequest, session: SessionDep, current: CurrentUserDep
) -> UserMeResponse:
    await AuthService(session).update_me(
        user_id=current.user_id, name=payload.name, store_name=payload.store_name
    )
    return await get_me(session, current)


@router.patch("/password", status_code=status.HTTP_204_NO_CONTENT, response_class=Response, response_model=None)
async def change_password(
    payload: ChangePasswordRequest, response: Response,
    session: SessionDep, current: CurrentUserDep,
) -> Response:
    await AuthService(session).change_password(
        user_id=current.user_id,
        current_password=payload.current_password,
        new_password=payload.new_password,
    )
    _clear_refresh_cookie(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT, response_class=Response, response_model=None)
async def delete_me(
    payload: DeleteAccountRequest, response: Response,
    session: SessionDep, current: CurrentUserDep,
) -> Response:
    await AuthService(session).delete_account(user_id=current.user_id, password=payload.password)
    _clear_refresh_cookie(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response
