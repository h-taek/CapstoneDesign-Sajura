"""TossPlaceAdapter — 토스플레이스 주문 JSON → 공통 판매 스키마 (01_basic_design.md §3.4.2·§3.4.5).

주문 모양은 실제 Open API 응답(GET /merchants/{id}/order/orders)에서 필요한 필드만 남겼다.
"""
from __future__ import annotations

from datetime import datetime

import httpx
import pytest

from app.adapters.pos.tossplace_adapter import (
    TossPlaceAdapter,
    TossPlaceClient,
    TossPlaceError,
    external_id,
    order_prefix,
)


def _order(
    order_id: str, state: str, lines: list[dict], completed_at: str = "2026-11-01T08:58:45Z"
) -> dict:
    return {"id": order_id, "orderState": state, "createdAt": completed_at,
            "completedAt": completed_at, "lineItems": lines}


def _line(title: str, price: int, qty: int, options: list[tuple[int, int]] | None = None,
          discounts: list[int] | None = None) -> dict:
    return {
        "item": {"title": title, "code": "1"},
        "itemPrice": {"priceValue": price},
        "optionChoices": [{"priceValue": p, "quantity": q} for p, q in (options or [])],
        "appliedDiscounts": [{"amount": a} for a in (discounts or [])],
        "quantity": qty,
    }


def test_completed_order_lines_become_sales_with_kst_time_and_options() -> None:
    order = _order("772", "COMPLETED", [
        _line(" 안동 간장찜닭 ", 23900, 1, options=[(9000, 1), (2000, 1), (1000, 1)]),
        _line("코카콜라 355ml", 2000, 2),
    ])
    out = TossPlaceAdapter().normalize_orders([order])
    assert out.cancelled_order_ids == [] and out.skipped == []
    first, second = out.sales
    assert first.menu_name == "안동 간장찜닭"            # 앞뒤 공백 제거
    assert first.unit_price == 23900 + 9000 + 2000 + 1000  # 옵션가 포함
    assert first.total_price == 35900
    assert first.sold_at == datetime(2026, 11, 1, 17, 58, 45)  # UTC 08:58 → KST 17:58
    assert first.external_sale_id == external_id("772", 0)
    assert (second.quantity, second.unit_price, second.total_price) == (2, 2000, 4000)
    assert second.external_sale_id == "TP:772:1"


def test_discount_reduces_total_but_not_below_zero() -> None:
    out = TossPlaceAdapter().normalize_orders([
        _order("1", "COMPLETED", [
            _line("소주", 5000, 2, discounts=[1000]),
            _line("서비스", 3000, 1, discounts=[9999]),
        ]),
    ])
    assert [s.total_price for s in out.sales] == [9000, 0]


def test_cancelled_orders_are_returned_for_deletion_not_as_sales() -> None:
    out = TossPlaceAdapter().normalize_orders([
        _order("9", "CANCELLED", [_line("맥주", 5000, 1)]),
        _order("10", "OPENED", [_line("맥주", 5000, 1)]),
    ])
    assert out.sales == []
    assert out.cancelled_order_ids == ["9"]
    assert order_prefix("9") == "TP:9:"


def test_bad_lines_are_skipped_with_reason() -> None:
    out = TossPlaceAdapter().normalize_orders([
        _order("5", "COMPLETED", [
            _line("", 1000, 1), _line("x" * 101, 1000, 1), _line("콜라", 2000, 0),
        ]),
    ])
    assert out.sales == []
    assert len(out.skipped) == 3


@pytest.mark.asyncio
async def test_client_pages_until_short_page_and_sends_keys() -> None:
    calls: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        page = int(request.url.params["page"])
        rows = [{"id": str(i)} for i in range(100 if page == 1 else 3)]
        return httpx.Response(200, json={"resultType": "SUCCESS", "success": rows, "error": None})

    async with TossPlaceClient(access_key="ak", access_secret="sk", base_url="https://toss.test",
                               transport=httpx.MockTransport(handler)) as c:
        orders = await c.list_orders("154663", start=datetime(2026, 1, 1), end=datetime(2026, 1, 2))
    assert len(orders) == 103 and len(calls) == 2
    assert calls[0].headers["x-access-key"] == "ak" and calls[0].headers["x-secret-key"] == "sk"
    assert calls[0].url.path == "/merchants/154663/order/orders"


@pytest.mark.asyncio
async def test_client_raises_readable_error_on_failure() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        body = {"resultType": "FAIL", "success": None, "error": {"reason": "인증 실패"}}
        return httpx.Response(401, json=body)

    async with TossPlaceClient(access_key="ak", access_secret="sk", base_url="https://toss.test",
                               transport=httpx.MockTransport(handler)) as c:
        with pytest.raises(TossPlaceError, match="인증 실패"):
            await c.get_merchant("1")


def test_client_requires_keys() -> None:
    with pytest.raises(TossPlaceError):
        TossPlaceClient(access_key="", access_secret="")
