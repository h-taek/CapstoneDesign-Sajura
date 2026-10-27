"""추천발주 계산·저장 + 발주 확정(approve) + 발주 내역 — 02_implementation_design.md §3.7.

추천발주는 BE가 저장된 예측(n8n 산출)과 그 시점 재고로 계산한다 (01_basic_design.md §3.7.2).
"""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select, text, update

import app.db as app_db
from app.models.order import Order, OrderApprovalLog, OrderRecommendation
from app.services.order_service import OrderService
from tests.forecast_test import LAST_SALE, TARGETS, store_forecast, upload_one_sale
from tests.notifications_test import _store_id
from tests.sales_test import _create_menu, _register_verified_user


async def _create_item(client: AsyncClient, auth: dict, name: str, **extra) -> str:
    r = await client.post(
        "/api/inventory",
        json={"name": name, "unit": "g", "quantity": 100, "purchase_price": 2800, **extra},
        headers=auth,
    )
    assert r.status_code == 201, r.text
    return r.json()["item_id"]


async def _setup_store(
    client: AsyncClient, *, forecast: bool = True
) -> tuple[dict, str, list[str]]:
    """판매 1건(대상일 산출용) + 메뉴(레시피 원두 15g·우유 100) + 재료 3종(현재고 각 100).

    첫 재료만 리드타임·안전재고 모두 설정. forecast면 대상일마다 아메리카노 10잔 예측을 저장한다.
    """
    email, auth = await _register_verified_user(client)
    menu_id = await _create_menu(client, auth, "아메리카노")
    await upload_one_sale(client, auth)
    items = [
        await _create_item(client, auth, "원두", lead_time_days=2, safety_stock=50),
        await _create_item(client, auth, "우유", lead_time_days=1),
        await _create_item(client, auth, "시럽"),
    ]
    r = await client.put(
        f"/api/menus/{menu_id}/recipe",
        json={"ingredients": [
            {"item_id": items[0], "quantity": 15, "unit": "g"},
            {"item_id": items[1], "quantity": 100, "unit": "g"},
        ]},
        headers=auth,
    )
    assert r.status_code == 200, r.text
    if forecast:
        await store_forecast(await _store_id(email), {menu_id: 10})
    return auth, menu_id, items


def _fake_prices(prices: dict[str, str]):
    async def fake(self, *, item_ids: list[str]) -> dict[str, Decimal]:
        return {k: Decimal(v) for k, v in prices.items() if k in item_ids}

    return fake


async def _approve(client: AsyncClient, auth: dict, items: dict[str, float]) -> str:
    r = await client.post(
        "/api/orders/approve",
        json={"items": [{"item_id": k, "final_quantity": v} for k, v in items.items()]},
        headers=auth,
    )
    assert r.status_code == 201, r.text
    return r.json()["order_id"]


async def _order_item_ids(client: AsyncClient, auth: dict, order_id: str) -> dict[str, str]:
    r = await client.get(f"/api/orders/{order_id}", headers=auth)
    assert r.status_code == 200, r.text
    return {i["item_id"]: i["order_item_id"] for i in r.json()["items"]}


async def _count_recommendations(store_auth_rec_id: str) -> int:
    async with app_db.SessionLocal() as session:
        store_id = await session.scalar(
            select(OrderRecommendation.store_id).where(
                OrderRecommendation.recommendation_id == store_auth_rec_id
            )
        )
        return await session.scalar(
            select(func.count())
            .select_from(OrderRecommendation)
            .where(OrderRecommendation.store_id == store_id)
        )


@pytest.mark.asyncio
async def test_recommend_saves_snapshot_and_replaces_unapproved(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    auth, menu_id, (bean, milk, syrup) = await _setup_store(client)

    r = await client.get("/api/orders/recommend", headers=auth)
    assert r.status_code == 200, r.text
    body = r.json()
    first_id = body["recommendation_id"]
    status_by_item = {x["item_id"]: x["config_status"] for x in body["recommendations"]}
    assert status_by_item == {bean: "USER_CONFIGURED", milk: "DEFAULT_USED", syrup: "DEFAULT_USED"}
    assert all(x["unit_price"] is None for x in body["recommendations"])  # 단가 출처 없음

    r = await client.get("/api/orders/recommend", headers=auth)
    assert r.status_code == 200, r.text
    second_id = r.json()["recommendation_id"]
    assert second_id != first_id
    assert await _count_recommendations(second_id) == 1  # 미확정 당일분은 대체


@pytest.mark.asyncio
async def test_recommend_calculates_from_stored_forecast(client: AsyncClient) -> None:
    """3일 × 10잔 예측 · 레시피 · 현재고 100으로 §3.7.2 산식을 계산한다."""
    auth, menu_id, (bean, milk, syrup) = await _setup_store(client)
    r = await client.get("/api/orders/recommend", headers=auth)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["target_dates"] == [d.isoformat() for d in TARGETS]
    assert (body["is_low_confidence"], body["low_confidence_reason"]) == (False, None)
    assert body["menu_forecast"] == [
        {"menu_id": menu_id, "menu_name": "아메리카노", "expected_quantity": 30.0}
    ]
    recs = {x["item_id"]: x for x in body["recommendations"]}
    # 원두 하루 150g × (3 + 리드타임 2) + 안전재고 50 − 현재고 100
    assert recs[bean]["recommended_quantity"] == 700.0
    assert recs[bean]["expected_stockout_date"] == (LAST_SALE + timedelta(days=1)).isoformat()
    assert recs[bean]["recommendation_reason"] == (
        "향후 3일+리드타임 2일 예상 소모 750.0g + 안전재고 50 − 현재고 100"
    )
    # 우유 하루 1000 × (3 + 기본 리드타임 1) + 기본 안전재고 0 − 100
    assert (recs[milk]["lead_time_days"], recs[milk]["safety_stock"]) == (1, 0.0)
    assert recs[milk]["recommended_quantity"] == 3900.0
    assert recs[syrup]["recommended_quantity"] == 0.0
    assert recs[syrup]["expected_stockout_date"] is None
    assert recs[syrup]["recommendation_reason"] == (
        "대상 기간 예상 소모 없음 — 레시피 연결 메뉴의 판매 예상 0"
    )


@pytest.mark.asyncio
async def test_recommend_carries_earliest_low_confidence(client: AsyncClient) -> None:
    email, auth = await _register_verified_user(client)
    menu_id = await _create_menu(client, auth, "아메리카노")
    await upload_one_sale(client, auth)
    await store_forecast(
        await _store_id(email), {menu_id: 10},
        low={TARGETS[2]: "LONG_HORIZON", TARGETS[1]: "WIDE_INTERVAL"},
    )
    r = await client.get("/api/orders/recommend", headers=auth)
    assert r.status_code == 200, r.text
    assert (r.json()["is_low_confidence"], r.json()["low_confidence_reason"]) == (
        True, "WIDE_INTERVAL",
    )


@pytest.mark.asyncio
async def test_recommend_without_stored_forecast_is_404(client: AsyncClient) -> None:
    auth, _, _ = await _setup_store(client, forecast=False)
    r = await client.get("/api/orders/recommend", headers=auth)
    assert r.status_code == 404, r.text
    assert r.json()["error"] == "FORECAST_NOT_FOUND"


@pytest.mark.asyncio
async def test_approve_with_recommendation_records_logs(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    auth, menu_id, (bean, milk, syrup) = await _setup_store(client)
    monkeypatch.setattr(OrderService, "_unit_prices", _fake_prices({bean: "28", syrup: "3"}))
    r = await client.get("/api/orders/recommend", headers=auth)
    rec_id = r.json()["recommendation_id"]
    prices = {x["item_id"]: x["unit_price"] for x in r.json()["recommendations"]}
    assert prices == {bean: 28.0, milk: None, syrup: 3.0}

    # 원두 수정(700→300), 우유 제외, 시럽 추가(추천 0). 단가는 서버가 정한다
    r = await client.post(
        "/api/orders/approve",
        json={
            "recommendation_id": rec_id,
            "items": [
                {"item_id": bean, "final_quantity": 300},
                {"item_id": syrup, "final_quantity": 10.5},
            ],
            "note": "행사 주간",
        },
        headers=auth,
    )
    assert r.status_code == 201, r.text
    order = r.json()
    assert order["status"] == "APPROVED"
    assert order["total_estimated_cost"] == 300 * 28 + round(10.5 * 3)

    r = await client.get(f"/api/orders/{order['order_id']}/approval-log", headers=auth)
    assert r.status_code == 200, r.text
    logs = {x["item_id"]: x for x in r.json()["items"]}
    assert set(logs) == {bean, milk, syrup}
    assert Decimal(str(logs[bean]["recommended_quantity"])) == 700
    assert Decimal(str(logs[bean]["final_quantity"])) == 300
    assert logs[bean]["was_modified"] is True
    assert Decimal(str(logs[milk]["final_quantity"])) == 0
    assert logs[milk]["was_modified"] is True
    assert Decimal(str(logs[syrup]["recommended_quantity"])) == 0
    assert logs[syrup]["was_modified"] is True
    assert logs[bean]["item_name"] == "원두"

    # 확정에 연결된 추천안은 다음 조회에서 대체되지 않는다
    new_id = (await client.get("/api/orders/recommend", headers=auth)).json()["recommendation_id"]
    assert await _count_recommendations(new_id) == 2



@pytest.mark.asyncio
async def test_approve_same_recommendation_twice_conflicts(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    auth, menu_id, (bean, _milk, _syrup) = await _setup_store(client)
    rec_id = (await client.get("/api/orders/recommend", headers=auth)).json()["recommendation_id"]
    body = {"recommendation_id": rec_id, "items": [{"item_id": bean, "final_quantity": 500}]}

    r = await client.post("/api/orders/approve", json=body, headers=auth)
    assert r.status_code == 201, r.text
    r = await client.post("/api/orders/approve", json=body, headers=auth)
    assert r.status_code == 409, r.text
    assert r.json()["error"] == "STATE_CONFLICT"

    async with app_db.SessionLocal() as session:
        count = await session.scalar(
            select(func.count()).select_from(Order).where(Order.recommendation_id == rec_id)
        )
    assert count == 1


@pytest.mark.asyncio
async def test_recommend_sends_incoming_of_pending_items(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """입고 예정량 = 입고 대기 상태인 발주 품목의 확정 수량 합계 (01_basic_design.md §3.7.2)."""
    auth, menu_id, (bean, milk, syrup) = await _setup_store(client)
    await _approve(client, auth, {bean: 300, syrup: 5})
    skipped = await _approve(client, auth, {bean: 200})
    received = await _approve(client, auth, {milk: 40})
    r = await client.post(
        f"/api/orders/items/{(await _order_item_ids(client, auth, skipped))[bean]}/skip",
        headers=auth,
    )
    assert r.status_code == 204, r.text
    r = await client.post(
        f"/api/orders/items/{(await _order_item_ids(client, auth, received))[milk]}/receive",
        json={"quantity": 40, "received_at": "2026-10-28", "purchase_price": 4000},
        headers=auth,
    )
    assert r.status_code == 201, r.text

    r = await client.get("/api/orders/recommend", headers=auth)
    assert r.status_code == 200, r.text
    recs = {x["item_id"]: x for x in r.json()["recommendations"]}
    # 입고 대기 원두 300은 발주량에서만 뺀다 — 소진 예상일은 손에 있는 재고 기준
    assert recs[bean]["recommended_quantity"] == 400.0
    assert recs[bean]["expected_stockout_date"] == (LAST_SALE + timedelta(days=1)).isoformat()
    assert recs[bean]["recommendation_reason"].endswith("− 현재고 100 − 입고 예정 300")
    # 우유는 입고 완료 40이 현재고에 들어갔고 입고 예정 없음
    assert recs[milk]["recommended_quantity"] == 3860.0
    assert "입고 예정" not in recs[milk]["recommendation_reason"]


@pytest.mark.asyncio
async def test_approve_unmodified_item_is_not_marked(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    auth, menu_id, (bean, milk, _syrup) = await _setup_store(client)
    rec_id = (await client.get("/api/orders/recommend", headers=auth)).json()["recommendation_id"]

    r = await client.post(
        "/api/orders/approve",
        json={"recommendation_id": rec_id, "items": [
            {"item_id": bean, "final_quantity": 700}, {"item_id": milk, "final_quantity": 3900},
        ]},
        headers=auth,
    )
    assert r.status_code == 201, r.text
    assert r.json()["total_estimated_cost"] == 0  # 단가 미설정

    async with app_db.SessionLocal() as session:
        logs = (
            await session.scalars(
                select(OrderApprovalLog).where(OrderApprovalLog.order_id == r.json()["order_id"])
            )
        ).all()
    by_item = {log.item_id: log for log in logs}
    assert by_item[bean].was_modified is False
    assert by_item[milk].was_modified is False
    # 추천 0 + 미포함 품목은 수정 아님
    assert all(not log.was_modified for log in by_item.values())


@pytest.mark.asyncio
async def test_approve_without_recommendation_has_no_logs(client: AsyncClient) -> None:
    auth, _menu_id, (bean, _milk, _syrup) = await _setup_store(client)
    r = await client.post(
        "/api/orders/approve",
        json={"recommendation_id": None, "items": [{"item_id": bean, "final_quantity": 2}]},
        headers=auth,
    )
    assert r.status_code == 201, r.text
    r = await client.get(f"/api/orders/{r.json()['order_id']}/approval-log", headers=auth)
    assert r.status_code == 200, r.text
    assert r.json()["items"] == []


@pytest.mark.asyncio
async def test_approve_validation(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    auth, menu_id, (bean, _milk, _syrup) = await _setup_store(client)
    other_auth, other_menu, _ = await _setup_store(client)
    other_rec = (await client.get("/api/orders/recommend", headers=other_auth)).json()[
        "recommendation_id"
    ]

    dup = [{"item_id": bean, "final_quantity": 1}, {"item_id": bean, "final_quantity": 2}]
    r = await client.post("/api/orders/approve", json={"items": dup}, headers=auth)
    assert r.status_code == 400, r.text

    r = await client.post(
        "/api/orders/approve",
        json={"items": [{"item_id": bean, "final_quantity": 0}]},
        headers=auth,
    )
    assert r.status_code == 400, r.text

    r = await client.post("/api/orders/approve", json={"items": []}, headers=auth)
    assert r.status_code == 400, r.text

    r = await client.post(
        "/api/orders/approve",
        json={"items": [{"item_id": "00000000-0000-0000-0000-000000000000", "final_quantity": 1}]},
        headers=auth,
    )
    assert r.status_code == 404, r.text

    r = await client.post(
        "/api/orders/approve",
        json={"recommendation_id": other_rec, "items": [{"item_id": bean, "final_quantity": 1}]},
        headers=auth,
    )
    assert r.status_code == 404, r.text


@pytest.mark.asyncio
async def test_list_and_detail(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    auth, _menu_id, (bean, milk, _syrup) = await _setup_store(client)
    monkeypatch.setattr(OrderService, "_unit_prices", _fake_prices({bean: "10"}))
    for qty in (1, 2, 3):
        r = await client.post(
            "/api/orders/approve",
            json={
                "items": [
                    {"item_id": bean, "final_quantity": qty},
                    {"item_id": milk, "final_quantity": 1},
                ]
            },
            headers=auth,
        )
        assert r.status_code == 201, r.text
    last_id = r.json()["order_id"]

    r = await client.get("/api/orders", params={"page": 1, "size": 2}, headers=auth)
    assert r.status_code == 200, r.text
    page = r.json()
    assert page["total"] == 3 and page["total_pages"] == 2 and page["size"] == 2
    assert len(page["items"]) == 2
    assert page["items"][0]["item_count"] == 2

    r = await client.get(f"/api/orders/{last_id}", headers=auth)
    assert r.status_code == 200, r.text
    detail = r.json()
    assert detail["total_estimated_cost"] == 30
    by_name = {i["item_name"]: i for i in detail["items"]}
    assert (by_name["원두"]["unit_price"], by_name["원두"]["subtotal"]) == (10.0, 30)
    assert (by_name["우유"]["unit_price"], by_name["우유"]["subtotal"]) == (None, None)
    assert {i["receipt_status"] for i in detail["items"]} == {"PENDING"}

    other_auth, _, _ = await _setup_store(client)
    r = await client.get(f"/api/orders/{last_id}", headers=other_auth)
    assert r.status_code == 404, r.text


@pytest.mark.asyncio
async def test_inventory_delete_guards_ordered_items(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    auth, menu_id, (bean, _milk, syrup) = await _setup_store(client)
    await client.get("/api/orders/recommend", headers=auth)
    r = await client.post(
        "/api/orders/approve",
        json={"items": [{"item_id": bean, "final_quantity": 1}]},
        headers=auth,
    )
    assert r.status_code == 201, r.text

    r = await client.delete(f"/api/inventory/{bean}", headers=auth)
    assert r.status_code == 409, r.text
    assert r.json()["error"] == "INVENTORY_ITEM_IN_USE"

    # 추천 스냅샷에만 있는 재료(레시피 미연결)는 삭제된다
    r = await client.delete(f"/api/inventory/{syrup}", headers=auth)
    assert r.status_code == 204, r.text


@pytest.mark.asyncio
async def test_receive_and_skip_order_items(client: AsyncClient) -> None:
    """입고 처리 → 로트·입고 완료, 입고 안 함 → 로트 없음. 처리한 품목은 다시 못 한다 (§3.7.5)."""
    auth, _menu_id, (bean, milk, _syrup) = await _setup_store(client)
    first = await _approve(client, auth, {bean: 300, milk: 50})
    second = await _approve(client, auth, {bean: 200})
    first_items = await _order_item_ids(client, auth, first)
    async with app_db.SessionLocal() as session:  # 확정 시각은 초 단위 — 순서를 분명히 한다
        await session.execute(
            update(Order)
            .where(Order.order_id == first)
            .values(approved_at=func.timestampadd(text("MINUTE"), -1, Order.approved_at))
        )
        await session.commit()

    # 로트 조회에 입고 대기 품목이 확정일 순으로 붙는다
    r = await client.get(f"/api/inventory/{bean}/lots", headers=auth)
    assert r.status_code == 200, r.text
    pending = r.json()["pending_orders"]
    assert [p["order_id"] for p in pending] == [first, second]
    assert [p["final_quantity"] for p in pending] == [300.0, 200.0]
    assert pending[0]["subtotal"] is None
    lots_before = len(r.json()["lots"])

    receive = {"quantity": 280, "received_at": "2026-10-28", "purchase_price": 8400}
    r = await client.post(
        f"/api/orders/items/{first_items[bean]}/receive", json=receive, headers=auth
    )
    assert r.status_code == 201, r.text
    lot = r.json()
    assert (lot["quantity"], lot["remaining_quantity"]) == (280.0, 280.0)
    assert lot["purchase_price"] == 8400

    r = await client.get(f"/api/inventory/{bean}/lots", headers=auth)
    assert len(r.json()["lots"]) == lots_before + 1
    assert [p["order_id"] for p in r.json()["pending_orders"]] == [second]

    # 처리한 품목은 다시 처리할 수 없다
    r = await client.post(
        f"/api/orders/items/{first_items[bean]}/receive", json=receive, headers=auth
    )
    assert r.status_code == 409, r.text
    assert r.json()["error"] == "STATE_CONFLICT"
    r = await client.post(f"/api/orders/items/{first_items[bean]}/skip", headers=auth)
    assert r.status_code == 409, r.text

    # 입고 안 함 — 로트 없이 닫힌다
    r = await client.post(f"/api/orders/items/{first_items[milk]}/skip", headers=auth)
    assert r.status_code == 204, r.text
    r = await client.get(f"/api/inventory/{milk}/lots", headers=auth)
    assert r.json()["pending_orders"] == []

    r = await client.get(f"/api/orders/{first}", headers=auth)
    status_by_item = {i["item_id"]: i["receipt_status"] for i in r.json()["items"]}
    assert status_by_item == {bean: "RECEIVED", milk: "SKIPPED"}

    # 다른 매장의 발주 품목
    other_auth, _, _ = await _setup_store(client)
    second_bean = (await _order_item_ids(client, auth, second))[bean]
    r = await client.post(f"/api/orders/items/{second_bean}/skip", headers=other_auth)
    assert r.status_code == 404, r.text
