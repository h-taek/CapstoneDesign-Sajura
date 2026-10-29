"""추천발주 계산·저장·예상 단가 + 발주 내역·입고 — 02_implementation_design.md §3.7.

추천발주는 BE가 저장된 예측(n8n 산출)과 그 시점 재고로 계산한다 (01_basic_design.md §3.7.2).
발주 확정(쿠팡 담기)은 automation_test.
"""

from __future__ import annotations

import json
import uuid
from datetime import timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select, text, update

import app.db as app_db
from app.core.redis import get_redis
from app.integrations import agent
from app.models.coupang import CoupangProduct
from app.models.inventory_item import InventoryItem
from app.models.order import Order, OrderRecommendation
from app.services.automation_service import utcnow
from tests.automation_test import coupang_id, place_order
from tests.conftest import FakeAgent
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


async def _order(client: AsyncClient, auth: dict, items: dict[str, float]) -> str:
    return (await place_order(client, auth, items))["order_id"]


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
async def test_recommend_sends_incoming_of_pending_items(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """입고 예정량 = 입고 대기 상태인 발주 품목의 확정 수량 합계 (01_basic_design.md §3.7.2)."""
    auth, menu_id, (bean, milk, syrup) = await _setup_store(client)
    await _order(client, auth, {bean: 300, syrup: 5})
    skipped = await _order(client, auth, {bean: 200})
    received = await _order(client, auth, {milk: 40})
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
async def test_list_and_detail(client: AsyncClient) -> None:
    auth, _menu_id, (bean, milk, _syrup) = await _setup_store(client)
    for qty in (1, 2, 3):  # 원두는 1kg 10,000원 상품 → 10원/g, 우유는 용량 없는 상품
        order = await place_order(client, auth, {bean: qty, milk: 1}, prices={bean: 10000})
    last_id = order["order_id"]

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
    await place_order(client, auth, {bean: 1})

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
    first = await _order(client, auth, {bean: 300, milk: 50})
    second = await _order(client, auth, {bean: 200})
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


async def _public_product(
    product_name: str, option_name: str | None, unit_price: str | None, content_unit: str = "g"
) -> str:
    """공용 쿠팡 상품 한 행을 직접 넣는다. unit_price는 용량 단위 1당 원."""
    cid = coupang_id()
    async with app_db.SessionLocal() as session:
        session.add(
            CoupangProduct(
                item_id=cid, product_id=cid, vendor_item_id=cid, product_name=product_name,
                option_name=option_name, sale_price=1000,
                unit_price=Decimal(unit_price) if unit_price else None,
                content_quantity=Decimal(1000), content_unit=content_unit, updated_at=utcnow(),
            )
        )
        await session.commit()
    return cid


async def _rename(client: AsyncClient, auth: dict, item_id: str, name: str) -> None:
    r = await client.patch(f"/api/inventory/{item_id}", json={"name": name}, headers=auth)
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_recommend_unit_price_linked_and_expected(
    client: AsyncClient, fake_agent: FakeAgent
) -> None:
    """연결 상품이면 재고 품목 단가, 없으면 에이전트 서버가 거른 공용 상품 최저 (§3.7.1)."""
    auth, _, (bean, milk, syrup) = await _setup_store(client)
    tag = uuid.uuid4().hex[:8]
    linked = await _public_product(f"연결 원두 {tag}", "1kg", "28")
    async with app_db.SessionLocal() as session:
        await session.execute(
            update(InventoryItem)
            .where(InventoryItem.item_id == bean)
            .values(coupang_item_id=linked, coupang_linked_at=utcnow())
        )
        await session.commit()
    milk_name = f"우유{tag}"
    await _rename(client, auth, milk, milk_name)
    candy = await _public_product(f"{milk_name} 맛 사탕", "100g", "1.0")  # LLM이 거른다
    sterile = await _public_product(f"매일 {milk_name} 멸균", "1kg", "2.5")
    option = await _public_product("덴마크", f"{milk_name} 1kg", "3")  # 옵션 이름에 재료명
    await _public_product(f"서울 {milk_name}", "1L", "0.9", content_unit="ml")  # 단위 못 바꿈
    await _public_product(f"{milk_name} 단가 없음", "1kg", None)
    fake_agent.filter_answer = ["2", "3"]

    async def prices() -> dict[str, float | None]:
        r = await client.get("/api/orders/recommend", headers=auth)
        assert r.status_code == 200, r.text
        return {x["item_id"]: x["unit_price"] for x in r.json()["recommendations"]}

    got = await prices()
    assert (got[bean], got[milk], got[syrup]) == (28.0, 2.5, None)
    # 연결 재료·후보 없는 재료는 부르지 않는다
    assert [c["name"] for c in fake_agent.filters] == [milk_name]
    candidates = fake_agent.filters[0]["candidates"]
    assert [c["ref"] for c in candidates] == ["1", "2", "3"]  # 공용 단가 낮은 순
    assert [c["option_name"] for c in candidates] == ["100g", "1kg", f"{milk_name} 1kg"]
    kept = json.loads(await get_redis().get(f"price_filter:{milk_name}:g"))
    assert kept == [sterile, option] and candy not in kept

    # 보관한 목록이 있으면 다시 부르지 않고, 단가는 공용 상품에서 다시 읽는다
    async with app_db.SessionLocal() as session:
        await session.execute(
            update(CoupangProduct)
            .where(CoupangProduct.item_id == option)
            .values(unit_price=Decimal("2"))
        )
        await session.commit()
    fake_agent.filters.clear()
    assert (await prices())[milk] == 2.0
    assert fake_agent.filters == []


@pytest.mark.asyncio
async def test_recommend_unit_price_converts_to_item_unit(
    client: AsyncClient, fake_agent: FakeAgent
) -> None:
    auth, _, _ = await _setup_store(client)
    tag = uuid.uuid4().hex[:8]
    r = await client.post(
        "/api/inventory", json={"name": f"밀가루{tag}", "unit": "kg", "quantity": 0}, headers=auth
    )
    flour = r.json()["item_id"]
    await _public_product(f"밀가루{tag} 중력분", "1kg", "1.5")
    r = await client.get("/api/orders/recommend", headers=auth)
    got = {x["item_id"]: x["unit_price"] for x in r.json()["recommendations"]}
    assert got[flour] == 1500.0  # 1.5원/g → 1,500원/kg


@pytest.mark.asyncio
async def test_recommend_unit_price_agent_error_is_null(
    client: AsyncClient, fake_agent: FakeAgent
) -> None:
    auth, _, (_bean, milk, _syrup) = await _setup_store(client)
    milk_name = f"우유{uuid.uuid4().hex[:8]}"
    await _rename(client, auth, milk, milk_name)
    await _public_product(f"매일 {milk_name}", "1kg", "2.5")
    fake_agent.filter_answer = agent.AgentError(503, agent.UNAVAILABLE)
    r = await client.get("/api/orders/recommend", headers=auth)
    assert r.status_code == 200, r.text
    got = {x["item_id"]: x["unit_price"] for x in r.json()["recommendations"]}
    assert got[milk] is None
    assert await get_redis().get(f"price_filter:{milk_name}:g") is None
