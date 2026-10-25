"""재고 로트·FIFO — 01_basic_design.md §3.3, 02_implementation_design.md §3.5·§3.6 업로드 응답."""

from __future__ import annotations

import io
from datetime import datetime
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import update

import app.db as app_db
from app.models.inventory_item import InventoryItem
from tests.sales_test import _csv_bytes, _register_verified_user

BASE = datetime(2026, 1, 1)  # 테스트 품목의 차감 기준 시각


async def _item(client: AsyncClient, auth: dict, name: str = "원두", **body) -> str:
    payload = {"name": name, "unit": "g", "quantity": 0, **body}
    r = await client.post("/api/inventory", json=payload, headers=auth)
    assert r.status_code == 201, r.text
    item_id = r.json()["item_id"]
    async with app_db.SessionLocal() as s:
        await s.execute(
            update(InventoryItem)
            .where(InventoryItem.item_id == item_id)
            .values(deducted_until=BASE)
        )
        await s.commit()
    return item_id


async def _lot(
    client: AsyncClient,
    auth: dict,
    item_id: str,
    qty: float,
    expiry: str | None,
    received: str = "2026-01-01",
) -> str:
    r = await client.post(
        f"/api/inventory/{item_id}/lots",
        json={
            "quantity": qty,
            "received_at": received,
            "expiry_date": expiry,
            "purchase_price": 1000,
        },
        headers=auth,
    )
    assert r.status_code == 201, r.text
    return r.json()["lot_id"]


async def _menu(
    client: AsyncClient, auth: dict, name: str, recipe: dict[str, float], deduct: bool = True
) -> str:
    r = await client.post(
        "/api/menus",
        json={
            "name": name,
            "category": "음료",
            "price": 4500,
            "is_active": True,
            "use_inventory_deduction": deduct,
        },
        headers=auth,
    )
    assert r.status_code in (200, 201), r.text
    menu_id = r.json()["menu_id"]
    r = await client.put(
        f"/api/menus/{menu_id}/recipe",
        json={
            "ingredients": [{"item_id": i, "quantity": q, "unit": "g"} for i, q in recipe.items()]
        },
        headers=auth,
    )
    assert r.status_code == 200, r.text
    return menu_id


async def _upload(client: AsyncClient, auth: dict, rows: list[str]) -> dict:
    r = await client.post(
        "/api/sales/upload",
        files={"file": ("sales.csv", io.BytesIO(_csv_bytes(rows)), "text/csv")},
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
    return r.json()


async def _remaining(client: AsyncClient, auth: dict, item_id: str) -> dict[str, Decimal]:
    r = await client.get(f"/api/inventory/{item_id}/lots", headers=auth)
    assert r.status_code == 200, r.text
    return {x["lot_id"]: Decimal(str(x["remaining_quantity"])) for x in r.json()["lots"]}


async def _detail(client: AsyncClient, auth: dict, item_id: str) -> dict:
    r = await client.get(f"/api/inventory/{item_id}", headers=auth)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.mark.asyncio
async def test_fifo_order_expiry_then_no_expiry_by_received(client: AsyncClient) -> None:
    _, auth = await _register_verified_user(client)
    bean = await _item(client, auth)
    late = await _lot(client, auth, bean, 100, "2026-03-01")
    early = await _lot(client, auth, bean, 100, "2026-02-01")
    no_exp_new = await _lot(client, auth, bean, 100, None, received="2026-01-10")
    no_exp_old = await _lot(client, auth, bean, 100, None, received="2026-01-05")
    await _menu(client, auth, "아메리카노", {bean: 10})

    # 25잔 × 10g = 250g → 소비기한 빠른 로트 100 → 늦은 로트 100 → 기한 없는 로트 중 입고 빠른 것 50
    body = await _upload(client, auth, ["2026-01-15 10:00:00,아메리카노,25,112500,r-1"])

    rem = await _remaining(client, auth, bean)
    assert rem[early] == 0
    assert rem[late] == 0
    assert rem[no_exp_old] == 50
    assert rem[no_exp_new] == 100
    assert body["inventory_deduction"] == {"deducted_sales": 1, "needs_check_items": []}


@pytest.mark.asyncio
async def test_shortage_stops_at_zero_and_marks_needs_check(client: AsyncClient) -> None:
    _, auth = await _register_verified_user(client)
    bean = await _item(client, auth)
    lot = await _lot(client, auth, bean, 30, "2026-02-01")
    await _menu(client, auth, "아메리카노", {bean: 10})

    body = await _upload(client, auth, ["2026-01-15 10:00:00,아메리카노,5,22500,r-1"])

    assert (await _remaining(client, auth, bean))[lot] == 0
    detail = await _detail(client, auth, bean)
    assert detail["alert_status"] == "NEEDS_CHECK"
    assert Decimal(str(detail["total_quantity"])) == 0
    assert body["inventory_deduction"]["needs_check_items"] == [{"item_id": bean, "name": "원두"}]

    # 이미 확인 필요인 품목은 다시 목록에 올리지 않는다
    body = await _upload(client, auth, ["2026-01-16 10:00:00,아메리카노,1,4500,r-2"])
    assert body["inventory_deduction"]["needs_check_items"] == []


@pytest.mark.asyncio
async def test_only_sales_after_deducted_until_are_deducted(client: AsyncClient) -> None:
    _, auth = await _register_verified_user(client)
    bean = await _item(client, auth)
    lot = await _lot(client, auth, bean, 1000, None)
    await _menu(client, auth, "아메리카노", {bean: 10})

    # 기준 시각(01-01) 이전 판매는 저장만. 파일 안 순서가 섞여도 기준은 업로드 시작 시점 값
    body = await _upload(
        client,
        auth,
        [
            "2026-01-20 10:00:00,아메리카노,1,4500,r-3",
            "2025-12-31 10:00:00,아메리카노,1,4500,r-1",
            "2026-01-10 10:00:00,아메리카노,1,4500,r-2",
        ],
    )
    assert body["imported"] == 3
    assert body["inventory_deduction"]["deducted_sales"] == 2
    assert (await _remaining(client, auth, bean))[lot] == 980

    # 기준 시각이 01-20으로 옮겨졌다 — 그보다 앞선 판매를 뒤늦게 올리면 차감하지 않는다
    body = await _upload(client, auth, ["2026-01-15 10:00:00,아메리카노,1,4500,r-4"])
    assert body["imported"] == 1
    assert body["inventory_deduction"]["deducted_sales"] == 0

    # 중복으로 건너뛴 행은 다시 차감하지 않는다
    body = await _upload(
        client,
        auth,
        [
            "2026-01-20 10:00:00,아메리카노,1,4500,r-3",
            "2026-01-21 10:00:00,아메리카노,1,4500,r-5",
        ],
    )
    assert body["imported"] == 1
    assert body["inventory_deduction"]["deducted_sales"] == 1
    assert (await _remaining(client, auth, bean))[lot] == 970


@pytest.mark.asyncio
async def test_menu_without_deduction_is_not_deducted(client: AsyncClient) -> None:
    _, auth = await _register_verified_user(client)
    bean = await _item(client, auth)
    lot = await _lot(client, auth, bean, 100, None)
    await _menu(client, auth, "디카페인", {bean: 10}, deduct=False)

    body = await _upload(client, auth, ["2026-01-15 10:00:00,디카페인,3,13500,r-1"])

    assert body["inventory_deduction"]["deducted_sales"] == 0
    assert (await _remaining(client, auth, bean))[lot] == 100


@pytest.mark.asyncio
async def test_needs_check_cleared_by_new_lot_or_stocktake_only(client: AsyncClient) -> None:
    _, auth = await _register_verified_user(client)
    bean = await _item(client, auth)
    lot = await _lot(client, auth, bean, 10, "2026-02-01")
    await _menu(client, auth, "아메리카노", {bean: 10})

    await _upload(client, auth, ["2026-01-15 10:00:00,아메리카노,2,9000,r-1"])
    assert (await _detail(client, auth, bean))["alert_status"] == "NEEDS_CHECK"

    # 소비기한 정정은 해제하지 않는다
    r = await client.patch(
        f"/api/inventory/{bean}/lots/{lot}",
        json={"expiry_date": "2026-02-05", "reason": "EXPIRY_CORRECTION"},
        headers=auth,
    )
    assert r.status_code == 200, r.text
    assert (await _detail(client, auth, bean))["alert_status"] == "NEEDS_CHECK"

    # 실사 조정은 해제한다
    r = await client.patch(
        f"/api/inventory/{bean}/lots/{lot}",
        json={"remaining_quantity": 5, "reason": "STOCKTAKE", "memo": "실사"},
        headers=auth,
    )
    assert r.status_code == 200, r.text
    log = r.json()
    assert Decimal(str(log["before_quantity"])) == 0
    assert Decimal(str(log["delta_quantity"])) == 5
    assert log["before_expiry_date"] == "2026-02-05"
    assert (await _detail(client, auth, bean))["alert_status"] != "NEEDS_CHECK"

    # 다시 부족 → 입고 등록으로 해제
    await _upload(client, auth, ["2026-01-16 10:00:00,아메리카노,1,4500,r-2"])
    assert (await _detail(client, auth, bean))["alert_status"] == "NEEDS_CHECK"
    await _lot(client, auth, bean, 500, None)
    assert (await _detail(client, auth, bean))["alert_status"] != "NEEDS_CHECK"


@pytest.mark.asyncio
async def test_create_item_with_quantity_makes_first_lot(client: AsyncClient) -> None:
    _, auth = await _register_verified_user(client)

    r = await client.post(
        "/api/inventory", json={"name": "원두", "unit": "g", "quantity": 100}, headers=auth
    )
    assert r.status_code == 400  # 수량이 있으면 구매 금액 필수
    assert r.json()["error"] == "VALIDATION_ERROR"

    r = await client.post(
        "/api/inventory",
        json={
            "name": "원두",
            "unit": "g",
            "quantity": 2000,
            "purchase_price": 11200,
            "expiry_date": "2099-01-01",
            "low_stock_threshold": 500,
        },
        headers=auth,
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert Decimal(str(body["total_quantity"])) == 2000
    assert body["alert_status"] == "NORMAL"

    r = await client.get(f"/api/inventory/{body['item_id']}/lots", headers=auth)
    lots = r.json()["lots"]
    assert len(lots) == 1
    assert lots[0]["purchase_price"] == 11200
    assert lots[0]["expiry_date"] == "2099-01-01"

    r = await client.post(
        "/api/inventory", json={"name": "설탕", "unit": "g", "quantity": 0}, headers=auth
    )
    assert r.status_code == 201, r.text
    assert r.json()["alert_status"] == "EMPTY"
    assert (await client.get(f"/api/inventory/{r.json()['item_id']}/lots", headers=auth)).json()[
        "lots"
    ] == []


@pytest.mark.asyncio
async def test_update_item_lead_time_and_safety_stock(client: AsyncClient) -> None:
    _, auth = await _register_verified_user(client)
    item_id = await _item(client, auth)

    r = await client.patch(
        f"/api/inventory/{item_id}", json={"lead_time_days": 2, "safety_stock": 1000}, headers=auth
    )
    assert r.status_code == 200, r.text
    body = await _detail(client, auth, item_id)
    assert (body["lead_time_days"], Decimal(str(body["safety_stock"]))) == (2, 1000)


@pytest.mark.asyncio
async def test_summary_and_alerts(client: AsyncClient) -> None:
    _, auth = await _register_verified_user(client)
    await _item(client, auth, "설탕")  # EMPTY
    low = await _item(client, auth, "우유", low_stock_threshold=500)
    await _lot(client, auth, low, 100, None)  # LOW
    soon = await _item(client, auth, "양상추")
    await _lot(client, auth, soon, 100, "2026-01-02")  # 이미 지난 소비기한 → EXPIRED_SOON
    ok = await _item(client, auth, "소금")
    await _lot(client, auth, ok, 100, None)

    r = await client.get("/api/inventory/summary", headers=auth)
    assert r.json() == {
        "total_items": 4,
        "low_stock_count": 1,
        "expired_soon_count": 1,
        "empty_count": 1,
        "needs_check_count": 0,
    }

    r = await client.get("/api/inventory/alerts", headers=auth)
    alerts = {x["name"]: x for x in r.json()["items"]}
    assert set(alerts) == {"설탕", "우유", "양상추"}
    assert alerts["양상추"]["expiry_date"] == "2026-01-02"
    assert alerts["양상추"]["alert_message"].startswith("소비기한 초과")
    assert alerts["우유"]["expiry_date"] is None


@pytest.mark.asyncio
async def test_dispose_lot(client: AsyncClient) -> None:
    _, auth = await _register_verified_user(client)
    bean = await _item(client, auth)
    lot = await _lot(client, auth, bean, 100, "2026-01-02")

    r = await client.post(
        f"/api/inventory/{bean}/dispose", json={"lot_id": lot, "quantity": 150}, headers=auth
    )
    assert r.status_code == 422
    assert r.json()["error"] == "INVENTORY_DISPOSE_EXCEEDS"

    other = await _item(client, auth, "우유")
    other_lot = await _lot(client, auth, other, 10, None)
    r = await client.post(
        f"/api/inventory/{bean}/dispose", json={"lot_id": other_lot, "quantity": 1}, headers=auth
    )
    assert r.status_code == 404
    assert r.json()["error"] == "INVENTORY_LOT_NOT_FOUND"

    r = await client.post(
        f"/api/inventory/{bean}/dispose",
        json={"lot_id": lot, "quantity": 40, "reason": "소비기한 만료"},
        headers=auth,
    )
    assert r.status_code == 200, r.text
    assert Decimal(str(r.json()["disposed_quantity"])) == 40
    assert Decimal(str(r.json()["remaining_quantity"])) == 60

    # 조정·폐기 이력이 있어도 품목 삭제가 된다
    await client.patch(
        f"/api/inventory/{bean}/lots/{lot}",
        json={"remaining_quantity": 50, "reason": "OTHER"},
        headers=auth,
    )
    r = await client.delete(f"/api/inventory/{bean}", headers=auth)
    assert r.status_code == 204, r.text
