"""StoreService — docs/plan/01_be.md 서비스별 주요 메서드."""
from __future__ import annotations

import re

import phonenumbers
from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core import errors, storage
from app.integrations import nts
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
        """사업자 검증 게이트 — NTS 통과 + 등록증 업로드 → PENDING.

        형식·미등록·휴폐업 분기는 nts.assert_business_active가 담당하며 실패 시
        DomainError를 raise한다(계정·상태 유지). 마스터 코드는 NTS 호출·파일 없이
        곧바로 VERIFIED (실 번호 아님 → business_no None, unique 충돌 방지, 12_security.md §2.4).
        그 외에는 등록증 파일이 필수이며, 저장 후 PENDING(관리자 심사 대기)으로 둔다.
        """
        store = await self.get_store(user_id)
        await nts.assert_business_active(business_no)

        s = get_settings()
        is_master = bool(s.NTS_MASTER_BYPASS_CODE) and business_no == s.NTS_MASTER_BYPASS_CODE
        if is_master:
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
            store.business_no = _normalize_business_no(business_no)
            store.business_status = BusinessStatus.PENDING
        store.business_reject_reason = None  # 재검증 시 이전 반려 사유 초기화
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            if "uq_stores_business_no" in str(exc.orig).lower():
                raise errors.DomainError(
                    status_code=409, error_code="AUTH_BUSINESS_NO_DUPLICATE",
                    message="이미 등록된 사업자등록번호입니다.",
                ) from exc
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
        if address is not None:
            store.address = address
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
