"""추천발주 저장 + 발주 확정(approve) + 발주 내역 — 07_api_spec.md §7."""

from __future__ import annotations

import io
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

import app.db as app_db
from app.integrations import ai_client
from app.models.order import OrderApprovalLog, OrderRecommendation
from tests.sales_test import _create_menu, _csv_bytes, _register_verified_user


async def _create_item(client: AsyncClient, auth: dict, name: str, **extra) -> str:
    r = await client.post(
        "/api/inventory",
        json={"name": name, "unit": "g", "current_quantity": 100, **extra},
        headers=auth,
    )
    assert r.status_code == 201, r.text
    return r.json()["item_id"]


async def _setup_store(client: AsyncClient) -> tuple[dict, str, list[str]]:
    """판매 1건(대상일 산출용) + 메뉴 + 재료 3종. 첫 재료만 리드타임·안전재고 모두 설정."""
    _, auth = await _register_verified_user(client)
    menu_id = await _create_menu(client, auth, "아메리카노")
    r = await client.post(
        "/api/sales/upload",
        files={
            "file": (
                "s.csv",
                io.BytesIO(_csv_bytes(["2026-01-15,아메리카노,1,4500,r1"])),
                "text/csv",
            )
        },
        data={
            "date_column": "날짜",
            "menu_column": "메뉴명",
            "quantity_column": "수량",
            "price_column": "금액",
            "external_sale_id_column": "영수증번호",
        },
        headers=auth,
    )
    assert r.status_code == 201, r.text
    items = [
        await _create_item(client, auth, "원두", lead_time_days=2, safety_stock=50),
        await _create_item(client, auth, "우유", lead_time_days=1),
        await _create_item(client, auth, "시럽"),
    ]
    return auth, menu_id, items


def _fake_recommend(menu_id: str, quantities: dict[str, float]):
    async def fake(payload: dict) -> dict:
        return {
            "store_id": payload["store_id"],
            "target_dates": payload["target_dates"],
            "is_low_confidence": False,
            "low_confidence_reason": None,
            "menu_forecast": [{"menu_id": menu_id, "expected_quantity": 30.0}],
            "recommendations": [
                {
                    "item_id": inv["item_id"],
                    "recommended_quantity": quantities.get(inv["item_id"], 0.0),
                    "expected_stockout_date": None,
                    "lead_time_days": inv["lead_time_days"],
                    "safety_stock": inv["safety_stock"],
                    "config_status": "OK",
                    "defaults_used": None,
                    "recommendation_reason": "테스트",
                }
                for inv in payload["inventory"]
            ],
        }

    return fake


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
    monkeypatch.setattr(ai_client, "recommend", _fake_recommend(menu_id, {bean: 500.0}))

    r = await client.get("/api/orders/recommend", headers=auth)
    assert r.status_code == 200, r.text
    body = r.json()
    first_id = body["recommendation_id"]
    status_by_item = {x["item_id"]: x["config_status"] for x in body["recommendations"]}
    assert status_by_item == {bean: "USER_CONFIGURED", milk: "DEFAULT_USED", syrup: "DEFAULT_USED"}

    r = await client.get("/api/orders/recommend", headers=auth)
    assert r.status_code == 200, r.text
    second_id = r.json()["recommendation_id"]
    assert second_id != first_id
    assert await _count_recommendations(second_id) == 1  # 미확정 당일분은 대체


@pytest.mark.asyncio
async def test_approve_with_recommendation_records_logs(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    auth, menu_id, (bean, milk, syrup) = await _setup_store(client)
    monkeypatch.setattr(
        ai_client, "recommend", _fake_recommend(menu_id, {bean: 500.0, milk: 200.0})
    )
    rec_id = (await client.get("/api/orders/recommend", headers=auth)).json()["recommendation_id"]

    # 원두 수정(500→300), 우유 제외, 시럽 추가(추천 0)
    r = await client.post(
        "/api/orders/approve",
        json={
            "recommendation_id": rec_id,
            "items": [
                {"item_id": bean, "final_quantity": 300, "unit_price": 28},
                {"item_id": syrup, "final_quantity": 10.5, "unit_price": 3},
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
    assert Decimal(str(logs[bean]["recommended_quantity"])) == 500
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
async def test_approve_unmodified_item_is_not_marked(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    auth, menu_id, (bean, _milk, _syrup) = await _setup_store(client)
    monkeypatch.setattr(ai_client, "recommend", _fake_recommend(menu_id, {bean: 500.0}))
    rec_id = (await client.get("/api/orders/recommend", headers=auth)).json()["recommendation_id"]

    r = await client.post(
        "/api/orders/approve",
        json={"recommendation_id": rec_id, "items": [{"item_id": bean, "final_quantity": 500}]},
        headers=auth,
    )
    assert r.status_code == 201, r.text
    assert r.json()["total_estimated_cost"] == 0  # unit_price 생략 = 0

    async with app_db.SessionLocal() as session:
        logs = (
            await session.scalars(
                select(OrderApprovalLog).where(OrderApprovalLog.order_id == r.json()["order_id"])
            )
        ).all()
    by_item = {log.item_id: log for log in logs}
    assert by_item[bean].was_modified is False
    # 추천 0 + 미포함 품목은 수정 아님
    assert all(not log.was_modified for item, log in by_item.items() if item != bean)


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
    monkeypatch.setattr(ai_client, "recommend", _fake_recommend(other_menu, {}))
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
async def test_list_and_detail(client: AsyncClient) -> None:
    auth, _menu_id, (bean, milk, _syrup) = await _setup_store(client)
    for qty in (1, 2, 3):
        r = await client.post(
            "/api/orders/approve",
            json={
                "items": [
                    {"item_id": bean, "final_quantity": qty, "unit_price": 10},
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
    sub = {i["item_name"]: i["subtotal"] for i in detail["items"]}
    assert sub == {"원두": 30, "우유": 0}

    other_auth, _, _ = await _setup_store(client)
    r = await client.get(f"/api/orders/{last_id}", headers=other_auth)
    assert r.status_code == 404, r.text


@pytest.mark.asyncio
async def test_inventory_delete_guards_ordered_items(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    auth, menu_id, (bean, milk, _syrup) = await _setup_store(client)
    monkeypatch.setattr(ai_client, "recommend", _fake_recommend(menu_id, {bean: 1.0, milk: 1.0}))
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

    # 추천 스냅샷에만 있는 재료는 삭제된다
    r = await client.delete(f"/api/inventory/{milk}", headers=auth)
    assert r.status_code == 204, r.text
