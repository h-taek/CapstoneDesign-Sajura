"""/api/auth/* — 02_implementation_design.md §3.2."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Cookie, File, Form, Response, UploadFile, status
from jose import JWTError
from pydantic import EmailStr

from app.api.cookies import clear_refresh_cookie, clear_signup_cookie, set_refresh_cookie
from app.api.deps import CurrentUserDep, SessionDep
from app.core import errors, security
from app.core.rate_limit import CREDENTIAL_LIMIT, REFRESH_LIMIT
from app.models.store import Store
from app.schemas.auth import (
    ChangePasswordRequest,
    DeleteAccountRequest,
    LoginRequest,
    SocialSignupResponse,
    TokenResponse,
    UpdateMeRequest,
    UserMeResponse,
)
from app.services.auth_service import AuthService, IssuedTokens

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _token_response(tokens: IssuedTokens, store: Store | None) -> TokenResponse:
    return TokenResponse(
        access_token=tokens.access_token, expires_in=tokens.expires_in,
        business_status=store.business_status.value if store else "UNVERIFIED",
        onboarding_completed=bool(store.onboarding_completed) if store else False,
    )


def _signup_claims(signup_token: str | None) -> dict:
    if not signup_token:
        raise errors.auth_signup_token_invalid()
    try:
        return security.decode_signup_token(signup_token)
    except JWTError as exc:
        raise errors.auth_signup_token_invalid() from exc


@router.post(
    "/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED,
    dependencies=[CREDENTIAL_LIMIT],
)
async def register(
    response: Response, session: SessionDep,
    email: Annotated[EmailStr, Form()],
    password: Annotated[str, Form(min_length=8, max_length=128)],
    name: Annotated[str, Form(min_length=1, max_length=50)],
    business_no: Annotated[str, Form()],
    cert: Annotated[UploadFile | None, File()] = None,
) -> TokenResponse:
    tokens, store = await AuthService(session).register(
        email=email, password=password, name=name, business_no=business_no, cert=cert,
    )
    set_refresh_cookie(response, tokens.refresh_token)
    return _token_response(tokens, store)


@router.get("/register/social", response_model=SocialSignupResponse)
async def social_signup_info(
    signup_token: Annotated[str | None, Cookie()] = None,
) -> SocialSignupResponse:
    claims = _signup_claims(signup_token)
    return SocialSignupResponse(
        provider=claims["provider"].upper(), email=claims["email"], name=claims["name"]
    )


@router.post(
    "/register/social", response_model=TokenResponse, status_code=status.HTTP_201_CREATED,
    dependencies=[CREDENTIAL_LIMIT],
)
async def register_social(
    response: Response, session: SessionDep,
    business_no: Annotated[str, Form()],
    cert: Annotated[UploadFile | None, File()] = None,
    signup_token: Annotated[str | None, Cookie()] = None,
) -> TokenResponse:
    claims = _signup_claims(signup_token)
    tokens, store = await AuthService(session).register_social(
        provider=claims["provider"], social_id=claims["social_id"],
        email=claims["email"], name=claims["name"], business_no=business_no, cert=cert,
    )
    set_refresh_cookie(response, tokens.refresh_token)
    clear_signup_cookie(response)
    return _token_response(tokens, store)


@router.post("/login", response_model=TokenResponse, dependencies=[CREDENTIAL_LIMIT])
async def login(payload: LoginRequest, response: Response, session: SessionDep) -> TokenResponse:
    tokens, store = await AuthService(session).login_with_email(
        email=payload.email, password=payload.password
    )
    set_refresh_cookie(response, tokens.refresh_token)
    clear_signup_cookie(response)
    return _token_response(tokens, store)


@router.post("/refresh", response_model=TokenResponse, dependencies=[REFRESH_LIMIT])
async def refresh(
    response: Response, session: SessionDep,
    refresh_token: Annotated[str | None, Cookie()] = None,
) -> TokenResponse:
    if not refresh_token:
        raise errors.auth_refresh_token_invalid()
    tokens = await AuthService(session).refresh(raw_refresh=refresh_token)
    set_refresh_cookie(response, tokens.refresh_token)
    return TokenResponse(access_token=tokens.access_token, expires_in=tokens.expires_in)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, response_class=Response, response_model=None)
async def logout(
    response: Response, session: SessionDep, current: CurrentUserDep,
    refresh_token: Annotated[str | None, Cookie()] = None,
) -> Response:
    await AuthService(session).logout(raw_refresh=refresh_token)
    clear_refresh_cookie(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT, response_class=Response, response_model=None)
async def logout_all(
    response: Response, session: SessionDep, current: CurrentUserDep
) -> Response:
    await AuthService(session).logout_all(user_id=current.user_id)
    clear_refresh_cookie(response)
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
    clear_refresh_cookie(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT, response_class=Response, response_model=None)
async def delete_me(
    payload: DeleteAccountRequest, response: Response,
    session: SessionDep, current: CurrentUserDep,
) -> Response:
    await AuthService(session).delete_account(user_id=current.user_id, password=payload.password)
    clear_refresh_cookie(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response
