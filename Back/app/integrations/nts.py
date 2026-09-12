"""국세청 사업자등록 상태조회 어댑터 (M3.B3).

키 미설정 또는 NTS_API_STUB_MODE=true 시 항상 ACTIVE.
"""
from __future__ import annotations

from enum import Enum

import httpx
from aiobreaker import CircuitBreaker
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.config import get_settings
from app.core import errors


class BusinessStatus(str, Enum):
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    CLOSED = "CLOSED"
    UNREGISTERED = "UNREGISTERED"


_STATUS_MAP = {"01": BusinessStatus.ACTIVE, "02": BusinessStatus.SUSPENDED, "03": BusinessStatus.CLOSED}
_breaker = CircuitBreaker(fail_max=5, timeout_duration=30)


@_breaker
@retry(
    retry=retry_if_exception_type((httpx.HTTPError,)),
    wait=wait_exponential(multiplier=0.5, max=5),
    stop=stop_after_attempt(3),
    reraise=True,
)
async def _call_nts(b_no_digits: str) -> dict:
    s = get_settings()
    url = f"{s.NTS_API_BASE_URL}/status"
    params = {"serviceKey": s.NTS_API_SERVICE_KEY, "returnType": "JSON"}
    body = {"b_no": [b_no_digits]}
    async with httpx.AsyncClient(timeout=5.0) as client:
        r = await client.post(url, params=params, json=body)
    r.raise_for_status()
    return r.json()


async def check_business_status(business_no: str) -> BusinessStatus:
    s = get_settings()
    # 시연/테스트용 마스터 코드 — 국세청 호출 없이 통과 (12_security.md §2.4).
    # 빈 값이면 비활성. 형식 검증보다 먼저 평가해 비숫자 코드도 허용.
    if s.NTS_MASTER_BYPASS_CODE and business_no == s.NTS_MASTER_BYPASS_CODE:
        return BusinessStatus.ACTIVE
    digits = business_no.replace("-", "")
    if len(digits) != 10 or not digits.isdigit():
        raise errors.DomainError(
            status_code=400, error_code="AUTH_BUSINESS_NO_INVALID",
            message="사업자등록번호 형식이 올바르지 않습니다.",
        )
    if s.NTS_API_STUB_MODE or not s.NTS_API_SERVICE_KEY:
        return BusinessStatus.ACTIVE
    try:
        payload = await _call_nts(digits)
    except httpx.HTTPError as exc:
        raise errors.DomainError(
            status_code=503, error_code="SERVICE_UNAVAILABLE",
            message="국세청 서비스 호출에 실패했습니다.",
        ) from exc
    data = payload.get("data") or []
    if not data:
        return BusinessStatus.UNREGISTERED
    code = (data[0] or {}).get("b_stt_cd") or ""
    return _STATUS_MAP.get(code, BusinessStatus.UNREGISTERED)


async def assert_business_active(business_no: str) -> None:
    s = await check_business_status(business_no)
    if s is BusinessStatus.ACTIVE:
        return
    if s is BusinessStatus.UNREGISTERED:
        raise errors.DomainError(
            status_code=400, error_code="AUTH_BUSINESS_NO_INVALID",
            message="등록된 사업자가 아닙니다.",
        )
    raise errors.DomainError(
        status_code=422, error_code="AUTH_BUSINESS_NO_NOT_ACTIVE",
        message=f"휴업/폐업 사업자입니다 ({s.value}).",
    )
