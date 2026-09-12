"""KAMIS(한국농수산식품유통공사) 농산물 가격정보 오픈API 어댑터.

홈 화면 "실시간 최저가 추천" — 식당에서 자주 쓰는 식자재 소매가 조회.
키 미설정 또는 KAMIS_API_STUB_MODE=true 시 샘플 데이터 반환 (nts.py와 동일 패턴).

실 연동은 action=dailySalesList (일별 주요 농축산물 소매가격정보) 사용
— https://www.kamis.or.kr Open-API #6. 이 액션은 품목코드 파라미터를 받지 않고
그날의 주요 품목(쌀·배추·양파·대파·돼지고기·계란 등 약 20~30개) 전체를 한 번에
반환하는 "일일 요약" API라서, item_code로 개별 조회하는 대신 응답 리스트를
품목명으로 매칭한다 (참고: github.com/spoqa/kamispy 비공식 클라이언트 모델).
응답 최상위 "price" 필드는 문서상 배열이며, 데이터가 없으면 문자열(에러 메시지)로
온다.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

import httpx
from aiobreaker import CircuitBreaker
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.config import get_settings


class PriceDirection(str, Enum):
    UP = "UP"
    DOWN = "DOWN"
    SAME = "SAME"


@dataclass
class IngredientPrice:
    item_name: str
    price: int
    unit: str
    direction: PriceDirection
    change_percent: float


# 식당에서 자주 쓰는 식자재 위주. dailySalesList 응답의 item_name과 매칭할
# 검색어(부분 일치)를 함께 둔다 — KAMIS 쪽 표기가 우리 표시명과 다를 수 있어서
# (예: "돼지고기(삼겹살)" 대신 "돼지고기"만 올 수 있음) 부분 일치로 찾는다.
_STUB_ITEMS = [
    IngredientPrice("양파", 1980, "1kg", PriceDirection.DOWN, -3.2),
    IngredientPrice("대파", 2450, "1kg", PriceDirection.UP, 5.1),
    IngredientPrice("배추", 3200, "1포기", PriceDirection.SAME, 0.0),
    IngredientPrice("돼지고기(삼겹살)", 21500, "1kg", PriceDirection.DOWN, -1.8),
    IngredientPrice("계란", 6980, "30구", PriceDirection.UP, 2.4),
]
_MATCH_KEYWORDS = {
    "양파": "양파",
    "대파": "대파",
    "배추": "배추",
    "돼지고기(삼겹살)": "돼지고기",
    "계란": "계란",
}

_breaker = CircuitBreaker(fail_max=5, timeout_duration=30)


@_breaker
@retry(
    retry=retry_if_exception_type((httpx.HTTPError,)),
    wait=wait_exponential(multiplier=0.5, max=5),
    stop=stop_after_attempt(3),
    reraise=True,
)
async def _call_kamis() -> dict:
    s = get_settings()
    params = {
        "action": "dailySalesList",
        "p_cert_key": s.KAMIS_API_CERT_KEY,
        "p_cert_id": s.KAMIS_API_CERT_ID,
        "p_returntype": "json",
    }
    async with httpx.AsyncClient(timeout=5.0) as client:
        r = await client.get(s.KAMIS_API_BASE_URL, params=params)
    r.raise_for_status()
    return r.json()


def _parse_direction(raw: str) -> PriceDirection:
    return {"0": PriceDirection.DOWN, "1": PriceDirection.UP, "2": PriceDirection.SAME}.get(
        raw, PriceDirection.SAME
    )


async def get_ingredient_prices() -> list[IngredientPrice]:
    s = get_settings()
    if s.KAMIS_API_STUB_MODE or not s.KAMIS_API_CERT_KEY:
        return _STUB_ITEMS

    try:
        payload = await _call_kamis()
    except httpx.HTTPError:
        return _STUB_ITEMS  # 전체 호출 실패 시 샘플 값으로 대체

    rows = payload.get("price")
    if not isinstance(rows, list):
        return _STUB_ITEMS  # 데이터 없음/에러 시 "price"가 문자열로 옴

    results: list[IngredientPrice] = []
    for stub in _STUB_ITEMS:
        keyword = _MATCH_KEYWORDS[stub.item_name]
        row = next((r for r in rows if keyword in (r.get("item_name") or "")), None)
        if row is None:
            results.append(stub)
            continue
        try:
            price = int(str(row.get("dpr1", "0")).replace(",", ""))
        except ValueError:
            results.append(stub)
            continue
        results.append(
            IngredientPrice(
                item_name=stub.item_name,
                price=price,
                unit=row.get("unit") or stub.unit,
                direction=_parse_direction(str(row.get("direction", "2"))),
                change_percent=float(row.get("value") or 0.0),
            )
        )
    return results
