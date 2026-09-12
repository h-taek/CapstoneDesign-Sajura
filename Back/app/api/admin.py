"""/api/admin — 사업자 검증 심사 (M3.B9, role=ADMIN 전용, 07_api_spec.md §3)."""
from __future__ import annotations

import math
import mimetypes
from typing import Annotated

from fastapi import APIRouter, Query
from fastapi.responses import FileResponse

from app.api.deps import AdminUserDep, SessionDep
from app.schemas.store import (
    RejectRequest,
    VerificationActionResponse,
    VerificationItem,
    VerificationListResponse,
)
from app.services.admin_verification_service import AdminVerificationService

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/verifications", response_model=VerificationListResponse)
async def list_verifications(
    session: SessionDep,
    _admin: AdminUserDep,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> VerificationListResponse:
    items, total = await AdminVerificationService(session).list_pending(page=page, size=size)
    return VerificationListResponse(
        items=[VerificationItem(**it) for it in items],
        total=total, page=page, size=size,
        total_pages=math.ceil(total / size) if total else 0,
    )


@router.get("/verifications/{store_id}/cert")
async def get_verification_cert(
    store_id: str, session: SessionDep, _admin: AdminUserDep
) -> FileResponse:
    path = await AdminVerificationService(session).get_cert_path(store_id)
    media_type, _ = mimetypes.guess_type(path.name)
    return FileResponse(
        path,
        media_type=media_type or "application/octet-stream",
        filename=f"cert_{store_id}{path.suffix}",
    )


@router.post("/verifications/{store_id}/approve", response_model=VerificationActionResponse)
async def approve_verification(
    store_id: str, session: SessionDep, admin: AdminUserDep
) -> VerificationActionResponse:
    store = await AdminVerificationService(session).approve(
        store_id=store_id, admin_user_id=admin.user_id
    )
    return VerificationActionResponse(
        store_id=store.store_id, business_status=store.business_status.value
    )


@router.post("/verifications/{store_id}/reject", response_model=VerificationActionResponse)
async def reject_verification(
    store_id: str, payload: RejectRequest, session: SessionDep, admin: AdminUserDep
) -> VerificationActionResponse:
    store = await AdminVerificationService(session).reject(
        store_id=store_id, admin_user_id=admin.user_id, reason=payload.reason
    )
    return VerificationActionResponse(
        store_id=store.store_id, business_status=store.business_status.value,
        reason=store.business_reject_reason,
    )
