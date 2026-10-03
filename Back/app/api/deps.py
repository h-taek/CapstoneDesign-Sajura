"""공용 의존성."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Header
from jose import ExpiredSignatureError, JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import errors, security
from app.db import get_session
from app.models.store import BusinessStatus, Store
from app.models.user import User, UserRole


@dataclass(slots=True)
class CurrentUser:
    user_id: str
    store_id: str | None


SessionDep = Annotated[AsyncSession, Depends(get_session)]


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
) -> CurrentUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise errors.unauthorized()
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = security.decode_access_token(token)
    except ExpiredSignatureError as exc:
        raise errors.auth_token_expired() from exc
    except JWTError as exc:
        raise errors.auth_invalid_token() from exc
    sub = payload.get("sub")
    if not isinstance(sub, str):
        raise errors.auth_invalid_token()
    store_id = payload.get("store_id")
    return CurrentUser(user_id=sub, store_id=store_id if isinstance(store_id, str) else None)


CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]


async def get_admin_user(
    current: CurrentUserDep,
    session: SessionDep,
) -> CurrentUser:
    """관리자 가드 — role을 JWT가 아닌 DB에서 조회·확인 (12_security.md §5.1)."""
    user = await session.get(User, current.user_id)
    if user is None or user.role != UserRole.ADMIN:
        raise errors.forbidden("관리자 권한이 필요합니다.")
    return current


AdminUserDep = Annotated[CurrentUser, Depends(get_admin_user)]


async def require_business_access(current: CurrentUserDep, session: SessionDep) -> None:
    """사업자 검증 게이트 — PENDING·VERIFIED이고 탈퇴 유예 중이 아니면 통과 (12_security.md §5.1).

    관리자 반려가 발급된 토큰에도 즉시 반영되도록 상태를 DB에서 조회한다.
    """
    status = await session.scalar(
        select(Store.business_status)
        .join(User, User.user_id == Store.user_id)
        .where(Store.user_id == current.user_id, User.withdrawn_at.is_(None))
    )
    if status not in (BusinessStatus.PENDING, BusinessStatus.VERIFIED):
        raise errors.DomainError(
            status_code=403, error_code="BUSINESS_NOT_VERIFIED", message="사업자 검증이 필요합니다."
        )
