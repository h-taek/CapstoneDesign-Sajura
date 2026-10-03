"""/api/store/pos/* — M3.B6 stub. api_key는 AES-256-GCM 암호화 저장 (12_security.md §4.1)."""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.api.deps import CurrentUserDep, SessionDep, require_business_access
from app.core import crypto, errors
from app.models.pos_connection import PosConnection, PosStatus
from app.services.store_service import StoreService

router = APIRouter(
    prefix="/api/store/pos", tags=["pos"], dependencies=[Depends(require_business_access)]
)


# api_key 150자 = 암호문 base64가 VARCHAR(255)에 들어가는 상한 (12_security.md §4.1)
class PosCreateRequest(BaseModel):
    pos_type: str
    api_key: str = Field(min_length=1, max_length=150)
    store_code: str


class PosUpdateRequest(BaseModel):
    pos_type: str | None = None
    api_key: str | None = Field(default=None, min_length=1, max_length=150)
    store_code: str | None = None


class PosResponse(BaseModel):
    pos_type: str
    api_key: str
    store_code: str
    connected_at: datetime


class PosStatusResponse(BaseModel):
    status: Literal["CONNECTED", "ERROR", "CSV_MODE", "DISCONNECTED"]
    last_synced_at: datetime | None
    error_message: str | None


class PosSyncResponse(BaseModel):
    synced_at: datetime
    records_synced: int


def _mask(k: str) -> str:
    if not k:
        return k
    if len(k) <= 4:
        return "*" * len(k)
    return f"{k[:2]}{'*' * (len(k) - 4)}{k[-2:]}"


def _to_dto(p: PosConnection) -> PosResponse:
    return PosResponse(
        pos_type=p.pos_type, api_key=_mask(crypto.decrypt(p.api_key, aad=p.store_id)),
        store_code=p.store_code, connected_at=p.connected_at,
    )


@router.get("", response_model=PosResponse)
async def get_pos(session: SessionDep, current: CurrentUserDep) -> PosResponse:
    store = await StoreService(session).get_store(current.user_id)
    pos = await session.scalar(select(PosConnection).where(PosConnection.store_id == store.store_id))
    if pos is None:
        raise errors.DomainError(status_code=404, error_code="NOT_FOUND", message="POS 연동 정보가 없습니다.")
    return _to_dto(pos)


@router.post("", response_model=PosResponse, status_code=status.HTTP_201_CREATED)
async def create_pos(
    payload: PosCreateRequest, session: SessionDep, current: CurrentUserDep
) -> PosResponse:
    store = await StoreService(session).get_store(current.user_id)
    existing = await session.scalar(
        select(PosConnection).where(PosConnection.store_id == store.store_id)
    )
    if existing is not None:
        raise errors.DomainError(
            status_code=409, error_code="CONFLICT", message="이미 POS 연동이 등록되어 있습니다."
        )
    pos = PosConnection(
        store_id=store.store_id, pos_type=payload.pos_type,
        api_key=crypto.encrypt(payload.api_key, aad=store.store_id), store_code=payload.store_code,
        status=PosStatus.CONNECTED,
    )
    session.add(pos)
    await session.commit()
    await session.refresh(pos)
    return _to_dto(pos)


@router.patch("", response_model=PosResponse)
async def update_pos(
    payload: PosUpdateRequest, session: SessionDep, current: CurrentUserDep
) -> PosResponse:
    store = await StoreService(session).get_store(current.user_id)
    pos = await session.scalar(select(PosConnection).where(PosConnection.store_id == store.store_id))
    if pos is None:
        raise errors.DomainError(status_code=404, error_code="NOT_FOUND", message="POS 연동 정보가 없습니다.")
    if payload.pos_type is not None:
        pos.pos_type = payload.pos_type
    if payload.api_key is not None:
        pos.api_key = crypto.encrypt(payload.api_key, aad=store.store_id)
    if payload.store_code is not None:
        pos.store_code = payload.store_code
    await session.commit()
    await session.refresh(pos)
    return _to_dto(pos)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT, response_class=Response, response_model=None)
async def delete_pos(session: SessionDep, current: CurrentUserDep) -> None:
    store = await StoreService(session).get_store(current.user_id)
    pos = await session.scalar(select(PosConnection).where(PosConnection.store_id == store.store_id))
    if pos is not None:
        await session.delete(pos)
        await session.commit()


@router.post("/sync", response_model=PosSyncResponse)
async def sync_pos(session: SessionDep, current: CurrentUserDep) -> PosSyncResponse:
    store = await StoreService(session).get_store(current.user_id)
    pos = await session.scalar(select(PosConnection).where(PosConnection.store_id == store.store_id))
    if pos is None:
        raise errors.DomainError(status_code=404, error_code="NOT_FOUND", message="POS 연동 정보가 없습니다.")
    pos.last_synced_at = datetime.now(UTC).replace(tzinfo=None)
    await session.commit()
    return PosSyncResponse(synced_at=pos.last_synced_at, records_synced=0)


@router.get("/status", response_model=PosStatusResponse)
async def get_pos_status(session: SessionDep, current: CurrentUserDep) -> PosStatusResponse:
    store = await StoreService(session).get_store(current.user_id)
    pos = await session.scalar(select(PosConnection).where(PosConnection.store_id == store.store_id))
    if pos is None:
        return PosStatusResponse(status="CSV_MODE", last_synced_at=None, error_message=None)
    return PosStatusResponse(
        status=pos.status.value, last_synced_at=pos.last_synced_at, error_message=pos.error_message
    )
