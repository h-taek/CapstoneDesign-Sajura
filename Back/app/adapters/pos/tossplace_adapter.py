"""TossPlaceAdapter — 토스플레이스 주문 → 공통 판매 스키마 (01_basic_design.md §3.4.2·§3.4.5).

연동 방식(조사 결과, docs/research/backend/13_pos_adapter.md):
- 인증: 사주라 앱의 Access Key/Secret(헤더 x-access-key·x-secret-key). 점주가 키를 입력하지 않는다.
  점주는 토스 POS 설정 > 서비스 연동에 사주라 서비스 코드를 넣어 매장을 연결하고,
  사주라는 매장 ID(MerchantId)로 조회한다 → pos_connections.store_code 에 MerchantId 저장.
- 수집: GET /merchants/{merchantId}/order/orders?from&to&page&size (주기 조회).
  from/to 는 '결제 내역이 바뀐 시각' 기준이라 취소된 주문도 다시 내려온다.

변환 규칙:
- 완료(COMPLETED) 주문의 품목(lineItem) 한 줄 = 공통 판매 1행.
- external_sale_id = "TP:{orderId}:{품목 순번}" — 재수집해도 같은 값이라 UNIQUE 로 중복 방지.
- 판매 시각 = completedAt(없으면 createdAt). UTC 를 KST 로 바꿔 시간대 없이 저장(CSV 와 같은 기준).
- 단가 = 품목 기본가 + 옵션가 합(옵션 수량 반영). 총액 = 단가 × 수량 − 품목 할인.
- 취소(CANCELLED) 주문은 변환하지 않고 주문 ID 만 돌려준다 → 호출자가 이미 저장된 행을 지운다.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta, timezone
from typing import Any

import httpx

from app.adapters.pos.csv_adapter import MENU_NAME_MAX_LENGTH, CommonSale, SkipReason

KST = timezone(timedelta(hours=9))
DEFAULT_BASE_URL = "https://open-api.tossplace.com/api-public/openapi/v1"
PAGE_SIZE = 100
TIMEOUT_SECONDS = 30
EXTERNAL_PREFIX = "TP"


def external_id(order_id: str, line_index: int) -> str:
    return f"{EXTERNAL_PREFIX}:{order_id}:{line_index}"


def order_prefix(order_id: str) -> str:
    return f"{EXTERNAL_PREFIX}:{order_id}:"


class TossPlaceError(Exception):
    """토스 API 호출 실패 — 메시지는 사용자에게 보여 줄 수 있는 문장."""


@dataclass
class NormalizedOrders:
    sales: list[CommonSale] = field(default_factory=list)
    skipped: list[SkipReason] = field(default_factory=list)
    cancelled_order_ids: list[str] = field(default_factory=list)
    orders_seen: int = 0


class TossPlaceAdapter:
    """주문 JSON → 공통 판매 스키마. 네트워크와 분리해 단위 테스트한다."""

    def normalize_orders(self, orders: list[dict[str, Any]]) -> NormalizedOrders:
        out = NormalizedOrders()
        for order in orders:
            out.orders_seen += 1
            order_id = str(order.get("id") or "")
            state = order.get("orderState")
            if not order_id:
                continue
            if state == "CANCELLED":
                out.cancelled_order_ids.append(order_id)
                continue
            if state != "COMPLETED":
                continue
            sold_at = _to_kst_naive(order.get("completedAt") or order.get("createdAt"))
            if sold_at is None:
                out.skipped.append(SkipReason(out.orders_seen, f"주문 {order_id}: 판매 시각 없음"))
                continue
            for idx, line in enumerate(order.get("lineItems") or []):
                sale = self._normalize_line(order_id, idx, line, sold_at)
                if isinstance(sale, SkipReason):
                    out.skipped.append(sale)
                else:
                    out.sales.append(sale)
        return out

    def _normalize_line(
        self, order_id: str, idx: int, line: dict[str, Any], sold_at: datetime
    ) -> CommonSale | SkipReason:
        item = line.get("item") or {}
        name = str(item.get("title") or "").strip()
        if not name:
            return SkipReason(idx + 1, f"주문 {order_id}: 메뉴명 없음")
        if len(name) > MENU_NAME_MAX_LENGTH:
            return SkipReason(idx + 1, f"주문 {order_id}: 메뉴명이 너무 깁니다")
        quantity = int(line.get("quantity") or 0)
        if quantity <= 0:
            return SkipReason(idx + 1, f"주문 {order_id}: 수량 오류")
        base = int((line.get("itemPrice") or {}).get("priceValue") or 0)
        options = sum(
            int(o.get("priceValue") or 0) * int(o.get("quantity") or 1)
            for o in line.get("optionChoices") or []
        )
        unit_price = max(base + options, 0)
        discount = sum(_discount_amount(d) for d in line.get("appliedDiscounts") or [])
        total_price = max(unit_price * quantity - discount, 0)
        return CommonSale(
            sold_at=sold_at,
            external_sale_id=external_id(order_id, idx),
            menu_name=name,
            quantity=quantity,
            unit_price=unit_price,
            total_price=total_price,
        )


class TossPlaceClient:
    """토스플레이스 Open API 조회 — 매장 확인·주문 목록(페이지 순회)."""

    def __init__(self, *, access_key: str, access_secret: str, base_url: str = DEFAULT_BASE_URL,
                 transport: httpx.AsyncBaseTransport | None = None) -> None:
        if not access_key or not access_secret:
            raise TossPlaceError("토스플레이스 연동 키가 설정되지 않았습니다.")
        self._client = httpx.AsyncClient(
            base_url=base_url, timeout=TIMEOUT_SECONDS, transport=transport,
            headers={"x-access-key": access_key, "x-secret-key": access_secret},
        )

    async def __aenter__(self) -> TossPlaceClient:
        return self

    async def __aexit__(self, *exc: object) -> None:
        await self._client.aclose()

    async def get_merchant(self, merchant_id: str) -> dict[str, Any]:
        return await self._get(f"/merchants/{merchant_id}")

    async def list_orders(
        self, merchant_id: str, *, start: datetime, end: datetime
    ) -> list[dict[str, Any]]:
        orders: list[dict[str, Any]] = []
        page = 1
        while True:
            rows = await self._get(
                f"/merchants/{merchant_id}/order/orders",
                params={"from": _iso(start), "to": _iso(end), "page": page, "size": PAGE_SIZE,
                        "orderStates": ["COMPLETED", "CANCELLED"]},
            )
            batch = rows if isinstance(rows, list) else []
            orders.extend(batch)
            if len(batch) < PAGE_SIZE:
                return orders
            page += 1

    async def _get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        try:
            r = await self._client.get(path, params=params)
        except httpx.HTTPError as exc:
            name = exc.__class__.__name__
            raise TossPlaceError(f"토스플레이스에 연결하지 못했습니다: {name}") from exc
        try:
            body = r.json()
        except ValueError as exc:
            code = r.status_code
            raise TossPlaceError(f"토스플레이스 응답을 읽지 못했습니다 (HTTP {code})") from exc
        if r.status_code >= 400 or body.get("resultType") != "SUCCESS":
            err = body.get("error") or {}
            msg = (err.get("reason") or err.get("message") or err.get("errorCode")
                   or f"HTTP {r.status_code}")
            raise TossPlaceError(f"토스플레이스 오류: {msg}")
        return body.get("success")


def _discount_amount(d: dict[str, Any]) -> int:
    for key in ("amount", "discountAmount", "price"):
        v = d.get(key)
        if isinstance(v, int | float):
            return int(v)
    return 0


def _to_kst_naive(v: Any) -> datetime | None:
    if not v:
        return None
    try:
        dt = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(KST).replace(tzinfo=None)


def _iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=KST)
    return dt.astimezone(KST).isoformat(timespec="seconds")
