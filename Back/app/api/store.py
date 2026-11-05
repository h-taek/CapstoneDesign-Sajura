"""/api/store — 02_implementation_design.md §3.3 (MVP)."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Response, UploadFile

from app.api.cookies import set_refresh_cookie
from app.api.deps import CurrentUserDep, SessionDep, require_business_access
from app.schemas.store import (
    BusinessVerifyResponse,
    OnboardingCompleteResponse,
    StoreResponse,
    StoreUpdateRequest,
)
from app.services.auth_service import AuthService
from app.services.store_service import StoreService

router = APIRouter(prefix="/api/store", tags=["store"])


def _to_dto(s) -> StoreResponse:
    return StoreResponse(
        store_id=s.store_id, store_name=s.store_name, business_no=s.business_no,
        business_status=s.business_status.value,
        business_reject_reason=s.business_reject_reason,
        business_type=s.business_type,
        store_size=s.store_size.value if s.store_size else None,
        operation_type=s.operation_type.value if s.operation_type else None,
        address=s.address, phone=s.phone,
        onboarding_completed=bool(s.onboarding_completed), created_at=s.created_at,
    )


@router.post("/business/verify", response_model=BusinessVerifyResponse)
async def verify_business(
    response: Response,
    session: SessionDep,
    current: CurrentUserDep,
    business_no: Annotated[str, Form()],
    cert: Annotated[UploadFile | None, File()] = None,
) -> BusinessVerifyResponse:
    store = await StoreService(session).verify_business(
        user_id=current.user_id, business_no=business_no, cert=cert
    )
    # 사업자 검증 전 계정은 Refresh Token이 없었다 — 통과한 지금 처음 발급한다 (03_be.md §7.3)
    tokens = await AuthService(session).issue_session(
        user_id=current.user_id, store_id=store.store_id
    )
    set_refresh_cookie(response, tokens.refresh_token)
    return BusinessVerifyResponse(
        business_status=store.business_status.value, business_no=store.business_no
    )


@router.get("", response_model=StoreResponse)
async def get_store(session: SessionDep, current: CurrentUserDep) -> StoreResponse:
    return _to_dto(await StoreService(session).get_store(current.user_id))


@router.patch(
    "", response_model=StoreResponse, dependencies=[Depends(require_business_access)]
)
async def update_store(
    payload: StoreUpdateRequest, session: SessionDep, current: CurrentUserDep
) -> StoreResponse:
    store = await StoreService(session).update_store(
        user_id=current.user_id,
        store_name=payload.store_name, business_type=payload.business_type,
        store_size=payload.store_size, operation_type=payload.operation_type,
        address=payload.address, phone=payload.phone,
    )
    return _to_dto(store)


@router.post(
    "/onboarding/complete",
    response_model=OnboardingCompleteResponse,
    dependencies=[Depends(require_business_access)],
)
async def complete_onboarding(
    session: SessionDep, current: CurrentUserDep
) -> OnboardingCompleteResponse:
    store = await StoreService(session).complete_onboarding(user_id=current.user_id)
    return OnboardingCompleteResponse(
        onboarding_completed=bool(store.onboarding_completed), store_id=store.store_id
    )
