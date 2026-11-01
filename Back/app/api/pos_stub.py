"""/api/store/pos/* — 연동 정보 저장, 동기화는 TOSSPLACE만 구현(키움페이·OKPOS는 stub).

api_key는 AES-256-GCM 암호화 저장 (03_be.md §10.1).
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select

from app.api.deps import CurrentUserDep, SessionDep, require_business_access
from app.core import crypto, errors
from app.models.pos_connection import PosConnection, PosStatus
from app.schemas.types import UtcDatetime
from app.services.pos_sync_service import PosSyncService, enqueue_sync
from app.services.store_service import StoreService

router = APIRouter(
    prefix="/api/store/pos", tags=["pos"], dependencies=[Depends(require_business_access)]
)


# 지원 POS사 3곳 (01_basic_design.md §3.4.3). 응답은 저장된 값을 그대로 돌려준다
PosType = Literal["TOSSPLACE", "KIWOOM", "OKPOS"]


# api_key 150자 = 암호문 base64가 VARCHAR(255)에 들어가는 상한 (03_be.md §10.1)
class PosCreateRequest(BaseModel):
    pos_type: PosType
    # TOSSPLACE는 사주라 앱 키로 조회해 점주 키를 받지 않는다 — 빈 값으로 저장
    # (01_basic_design.md §3.4.3)
    api_key: str | None = Field(default=None, min_length=1, max_length=150)
    store_code: str = Field(min_length=1, max_length=50)

    @model_validator(mode="after")
    def _api_key_unless_tossplace(self) -> PosCreateRequest:
        if self.pos_type != "TOSSPLACE" and not self.api_key:
            raise ValueError("API 키를 입력하세요.")
        return self


class PosUpdateRequest(BaseModel):
    pos_type: PosType | None = None
    api_key: str | None = Field(default=None, min_length=1, max_length=150)
    store_code: str | None = Field(default=None, min_length=1, max_length=50)


class PosResponse(BaseModel):
    pos_type: str
    api_key: str
    store_code: str
    connected_at: UtcDatetime


class PosStatusResponse(BaseModel):
    status: Literal["CONNECTED", "ERROR", "CSV_MODE", "DISCONNECTED"]
    last_synced_at: UtcDatetime | None
    error_message: str | None


class PosSyncResponse(BaseModel):
    synced_at: UtcDatetime
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
        api_key=crypto.encrypt(payload.api_key or "", aad=store.store_id),
        store_code=payload.store_code, status=PosStatus.CONNECTED,
    )
    session.add(pos)
    await session.commit()
    await session.refresh(pos)
    if pos.pos_type == "TOSSPLACE":
        await enqueue_sync(store.store_id)
    return _to_dto(pos)


@router.patch("", response_model=PosResponse)
async def update_pos(
    payload: PosUpdateRequest, session: SessionDep, current: CurrentUserDep
) -> PosResponse:
    store = await StoreService(session).get_store(current.user_id)
    pos = await session.scalar(select(PosConnection).where(PosConnection.store_id == store.store_id))
    if pos is None:
        raise errors.DomainError(status_code=404, error_code="NOT_FOUND", message="POS 연동 정보가 없습니다.")
    # 다른 POS·매장을 가리키게 되면 전체 이력을 다시 받는다 (01_basic_design.md §3.4.3)
    resync = (payload.pos_type not in (None, pos.pos_type)
              or payload.store_code not in (None, pos.store_code))
    if payload.pos_type is not None:
        pos.pos_type = payload.pos_type
    if payload.api_key is not None:
        pos.api_key = crypto.encrypt(payload.api_key, aad=store.store_id)
    if payload.store_code is not None:
        pos.store_code = payload.store_code
    if resync:
        pos.last_synced_at = None
        pos.status = PosStatus.CONNECTED
        pos.error_message = None
    await session.commit()
    await session.refresh(pos)
    if resync and pos.pos_type == "TOSSPLACE":
        await enqueue_sync(store.store_id)
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
    if pos.pos_type == "TOSSPLACE":
        # 토스플레이스: store_code = 매장 ID(MerchantId), 인증은 사주라 앱 키 (pos_sync_service)
        result = await PosSyncService(session).sync(pos)
        return PosSyncResponse(synced_at=result.synced_at, records_synced=result.records_synced)
    # 키움페이·OKPOS 어댑터 전까지 stub — 동기화 시각만 기록
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
