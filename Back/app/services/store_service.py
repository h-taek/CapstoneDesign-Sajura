"""StoreService — docs/plan/01_be.md 서비스별 주요 메서드."""
from __future__ import annotations

import re
from decimal import Decimal

import phonenumbers
from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core import errors, storage
from app.core.weather_location import kma_grid, nearest_asos
from app.integrations import geocoding, nts
from app.models.store import BusinessStatus, OperationType, Store, StoreSize

_BIZ_NO_RE = re.compile(r"^\d{3}-?\d{2}-?\d{5}$")


def _normalize_business_no(raw: str) -> str:
    d = raw.replace("-", "")
    return f"{d[0:3]}-{d[3:5]}-{d[5:10]}"


def _normalize_phone_kr(raw: str | None) -> str | None:
    if not raw:
        return raw
    try:
        parsed = phonenumbers.parse(raw, "KR")
    except phonenumbers.NumberParseException as exc:
        raise errors.DomainError(
            status_code=400, error_code="VALIDATION_ERROR", message="전화번호 형식이 올바르지 않습니다."
        ) from exc
    if not phonenumbers.is_valid_number(parsed):
        raise errors.DomainError(
            status_code=400, error_code="VALIDATION_ERROR", message="유효하지 않은 전화번호입니다."
        )
    return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.NATIONAL)


async def set_location(store: Store) -> None:
    """주소로 위치 5칸을 다시 채운다. 주소가 없거나 좌표 변환에 실패하면 모두 비운다 (02 §4.3.3)."""
    coords = await geocoding.geocode(store.address) if store.address else None
    if coords is None:
        store.latitude = store.longitude = store.kma_nx = store.kma_ny = store.asos_stn_id = None
        return
    lat, lng = coords
    store.latitude, store.longitude = Decimal(f"{lat:.6f}"), Decimal(f"{lng:.6f}")
    store.kma_nx, store.kma_ny = kma_grid(lat, lng)
    store.asos_stn_id = nearest_asos(lat, lng)


async def check_business_no(
    session: AsyncSession, business_no: str, *, store_id: str | None = None
) -> str | None:
    """사업자 검증 ①② — 국세청 조회 + 다른 매장 사용 여부 (01_basic_design.md §3.1.4).

    형식·미등록·휴폐업은 nts.assert_business_active가 DomainError로 막는다.
    마스터 코드면 None, 아니면 정규화한 번호를 돌려준다.
    """
    await nts.assert_business_active(business_no)
    s = get_settings()
    if s.NTS_MASTER_BYPASS_CODE and business_no == s.NTS_MASTER_BYPASS_CODE:
        return None
    normalized = _normalize_business_no(business_no)
    taken = select(Store.store_id).where(Store.business_no == normalized)
    if store_id is not None:
        taken = taken.where(Store.store_id != store_id)
    if await session.scalar(taken) is not None:
        raise errors.auth_business_no_duplicate()
    return normalized


async def apply_business(store: Store, business_no: str | None, cert: UploadFile | None) -> None:
    """사업자 검증 ③ — 검증을 통과한 번호를 매장에 넣는다. 커밋은 부르는 쪽이 한다.

    마스터 코드(None)는 등록증 없이 곧바로 VERIFIED (실 번호 아님 → business_no None,
    unique 충돌 방지, 03_be.md §7.4). 그 외에는 등록증 파일이 필수이며, 저장 후
    PENDING(관리자 심사 대기)으로 둔다.
    """
    if business_no is None:
        store.business_no = None
        store.business_cert_path = None
        store.business_status = BusinessStatus.VERIFIED
    else:
        if cert is None:
            raise errors.DomainError(
                status_code=400, error_code="VALIDATION_ERROR",
                message="사업자등록증 파일을 첨부하세요.",
            )
        store.business_cert_path = await storage.save_business_cert(cert, store.store_id)
        store.business_no = business_no
        store.business_status = BusinessStatus.PENDING
    store.business_reject_reason = None  # 재검증 시 이전 반려 사유 초기화


class StoreService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_store(self, user_id: str) -> Store:
        store = await self.session.scalar(select(Store).where(Store.user_id == user_id))
        if store is None:
            raise errors.DomainError(
                status_code=404, error_code="NOT_FOUND", message="매장 정보가 없습니다."
            )
        return store

    async def verify_business(
        self, *, user_id: str, business_no: str, cert: UploadFile | None
    ) -> Store:
        """반려 재제출·기존 미인증 계정의 사업자 검증 — 실패 시 계정·상태 유지.

        회원가입은 AuthService.register·register_social이 같은 규칙을 쓴다.
        """
        store = await self.get_store(user_id)
        normalized = await check_business_no(self.session, business_no, store_id=store.store_id)
        await apply_business(store, normalized, cert)
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            if "uq_stores_business_no" in str(exc.orig).lower():
                raise errors.auth_business_no_duplicate() from exc
            raise
        await self.session.refresh(store)
        return store

    async def update_store(
        self, *, user_id: str,
        store_name: str | None = None, business_type: str | None = None,
        store_size: str | None = None, operation_type: str | None = None,
        address: str | None = None, phone: str | None = None,
    ) -> Store:
        store = await self.get_store(user_id)
        if store_name is not None:
            store.store_name = store_name
        if business_type is not None:
            store.business_type = business_type
        if store_size is not None:
            store.store_size = StoreSize(store_size)
        if operation_type is not None:
            store.operation_type = OperationType(operation_type)
        if address is not None and address != store.address:
            store.address = address
            await set_location(store)
        if phone is not None:
            store.phone = _normalize_phone_kr(phone)
        await self.session.commit()
        await self.session.refresh(store)
        return store

    async def complete_onboarding(self, *, user_id: str) -> Store:
        store = await self.get_store(user_id)
        if not store.onboarding_completed:
            store.onboarding_completed = True
            await self.session.commit()
            await self.session.refresh(store)
        return store
