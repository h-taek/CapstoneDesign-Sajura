"""재고 로트·FIFO — 01_basic_design.md §3.3, 02_implementation_design.md §3.5·§3.6 업로드 응답."""

from __future__ import annotations

import io
from datetime import date, datetime, time, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import select, update

import app.db as app_db
from app.models.coupang import CoupangPriceHistory, CoupangProduct, InventoryCoupangLink
from app.models.inventory_item import InventoryItem, InventoryLot
from app.models.notification import Notification
from app.services.anomaly_detector import AnomalyDetector, AnomalyFlag
from app.services.automation_service import utcnow
from app.services.inventory_service import KST, InventoryService
from tests.automation_test import coupang_id
from tests.notifications_test import _store_id
from tests.sales_test import _create_menu, _csv_bytes, _register_verified_user

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
    if deduct:  # 재고 차감은 레시피 저장 뒤에만 켤 수 있다
        r = await client.patch(
            f"/api/menus/{menu_id}", json={"use_inventory_deduction": True}, headers=auth
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
    assert detail["needs_check"] is True
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
    assert (await _detail(client, auth, bean))["needs_check"] is True

    # 소비기한 정정은 해제하지 않는다
    r = await client.patch(
        f"/api/inventory/{bean}/lots/{lot}",
        json={"expiry_date": "2026-02-05", "reason": "EXPIRY_CORRECTION"},
        headers=auth,
    )
    assert r.status_code == 200, r.text
    assert (await _detail(client, auth, bean))["needs_check"] is True

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
    assert (await _detail(client, auth, bean))["needs_check"] is False

    # 다시 부족 → 입고 등록으로 해제
    await _upload(client, auth, ["2026-01-16 10:00:00,아메리카노,1,4500,r-2"])
    assert (await _detail(client, auth, bean))["needs_check"] is True
    await _lot(client, auth, bean, 500, None)
    assert (await _detail(client, auth, bean))["needs_check"] is False


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
    assert (body["nearest_expiry_date"], body["needs_check"]) == ("2099-01-01", False)

    r = await client.get(f"/api/inventory/{body['item_id']}/lots", headers=auth)
    lots = r.json()["lots"]
    assert len(lots) == 1
    assert lots[0]["purchase_price"] == 11200
    assert lots[0]["expiry_date"] == "2099-01-01"

    r = await client.post(
        "/api/inventory", json={"name": "설탕", "unit": "g", "quantity": 0}, headers=auth
    )
    assert r.status_code == 201, r.text
    assert (r.json()["total_quantity"], r.json()["nearest_expiry_date"]) == (0, None)
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
async def test_list_returns_raw_values_for_fe_judgement(client: AsyncClient) -> None:
    """경고·정렬은 FE 몫 — 목록은 판정값 없이 원본값만 준다 (03_be.md §2)."""
    _, auth = await _register_verified_user(client)
    await _item(client, auth, "설탕")
    milk = await _item(client, auth, "우유", low_stock_threshold=500)
    await _lot(client, auth, milk, 100, None)
    lettuce = await _item(client, auth, "양상추")
    await _lot(client, auth, lettuce, 100, "2026-03-01")
    used_up = await _lot(client, auth, lettuce, 10, "2026-01-02")
    r = await client.post(
        f"/api/inventory/{lettuce}/dispose", json={"lot_id": used_up, "quantity": 10}, headers=auth
    )
    assert r.status_code == 200, r.text

    r = await client.get("/api/inventory", headers=auth)
    assert r.status_code == 200, r.text
    items = {x["name"]: x for x in r.json()["items"]}
    assert "alert_status" not in items["설탕"]
    assert (items["설탕"]["total_quantity"], items["설탕"]["nearest_expiry_date"]) == (0, None)
    assert (items["우유"]["total_quantity"], items["우유"]["low_stock_threshold"]) == (100, 500)
    # 잔여가 없는 로트(2026-01-02)는 제외하고 가장 이른 소비기한
    assert items["양상추"]["nearest_expiry_date"] == "2026-03-01"
    assert not any(x["needs_check"] for x in items.values())
    for path in ("/api/inventory/summary", "/api/inventory/alerts"):
        assert (await client.get(path, headers=auth)).status_code == 404


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


# ----------------------------------------------------------------------
# 소비기한 배치 — 01_basic_design.md §3.3.6
# ----------------------------------------------------------------------

TODAY = date(2026, 1, 10)


async def _expiry_notifications(store_id: str) -> list[tuple[str, str, str]]:
    async with app_db.SessionLocal() as s:
        rows = (
            await s.execute(
                select(Notification.type, Notification.related_resource_id, Notification.body)
                .where(Notification.store_id == store_id)
                .order_by(Notification.type, Notification.body)
            )
        ).all()
    return [(t.value, rid, body) for t, rid, body in rows]


async def _run_expiry_batch(today: date = TODAY) -> None:
    async with app_db.SessionLocal() as s:
        await InventoryService(s).check_expiry_batch(today=today)


@pytest.mark.asyncio
async def test_expiry_batch_notifies_d3_d1_and_first_overdue_day(client: AsyncClient) -> None:
    email, auth = await _register_verified_user(client)
    store_id = await _store_id(email)
    lettuce = await _item(client, auth, "양상추")
    milk = await _item(client, auth, "우유")
    egg = await _item(client, auth, "계란")
    cream = await _item(client, auth, "생크림")
    await _lot(client, auth, lettuce, 1, "2026-01-13")  # D-3
    await _lot(client, auth, lettuce, 2, "2026-01-13")  # 같은 품목·조건 → 한 건
    await _lot(client, auth, milk, 1, "2026-01-11")  # D-1
    await _lot(client, auth, egg, 1, "2026-01-09")  # 초과 첫날
    await _lot(client, auth, cream, 1, "2026-01-12")  # D-2 — 대상 아님
    await _lot(client, auth, cream, 1, "2026-01-08")  # 초과 둘째 날 — 대상 아님
    used_up = await _lot(client, auth, cream, 1, "2026-01-13")
    async with app_db.SessionLocal() as s:
        await s.execute(
            update(InventoryLot)
            .where(InventoryLot.lot_id == used_up)
            .values(remaining_quantity=0)
        )
        await s.commit()

    await _run_expiry_batch()

    assert await _expiry_notifications(store_id) == [
        ("EXPIRY_D3", lettuce, "양상추 로트 2개가 3일 뒤 만료됩니다."),
        ("EXPIRY_D1", milk, "우유 로트 1개가 내일 만료됩니다."),
        ("EXPIRY_OVER", egg, "계란 로트 1개가 소비기한을 넘겼습니다. 폐기 처리해 주세요."),
    ]


@pytest.mark.asyncio
async def test_expiry_batch_rerun_same_day_creates_nothing_new(client: AsyncClient) -> None:
    email, auth = await _register_verified_user(client)
    store_id = await _store_id(email)
    lettuce = await _item(client, auth, "양상추")
    await _lot(client, auth, lettuce, 1, "2026-01-13")

    await _run_expiry_batch()
    await _run_expiry_batch()

    assert len(await _expiry_notifications(store_id)) == 1


# ----------------------------------------------------------------------
# 업로드 알림 — 01_basic_design.md §3.12
# ----------------------------------------------------------------------


@pytest.mark.asyncio
async def test_upload_notifies_each_new_needs_check_item(client: AsyncClient) -> None:
    email, auth = await _register_verified_user(client)
    store_id = await _store_id(email)
    bean = await _item(client, auth)
    milk = await _item(client, auth, "우유")
    await _lot(client, auth, bean, 10, None)
    await _menu(client, auth, "라떼", {bean: 20, milk: 100})

    await _upload(client, auth, ["2026-01-15 10:00:00,라떼,1,5000,r-1"])
    # 이미 확인 필요인 품목은 다시 보내지 않는다
    await _upload(client, auth, ["2026-01-15 11:00:00,라떼,1,5000,r-2"])

    async with app_db.SessionLocal() as s:
        rows = (
            await s.execute(
                select(Notification.type, Notification.related_resource_id, Notification.title)
                .where(Notification.store_id == store_id)
            )
        ).all()
    assert sorted((t.value, rid, title) for t, rid, title in rows) == sorted([
        ("STOCK_LOW", bean, "원두 재고 확인 필요"),
        ("STOCK_LOW", milk, "우유 재고 확인 필요"),
    ])


@pytest.mark.asyncio
async def test_upload_with_anomalies_notifies_once(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    email, auth = await _register_verified_user(client)
    store_id = await _store_id(email)
    await _create_menu(client, auth, "아메리카노")
    monkeypatch.setattr(
        AnomalyDetector,
        "detect",
        lambda self, sales: [AnomalyFlag(row_index=1, reason="급증")] * len(sales),
    )

    await _upload(client, auth, [
        "2026-01-15 10:00:00,아메리카노,1,4500,a-1",
        "2026-01-15 11:00:00,아메리카노,1,4500,a-2",
    ])

    async with app_db.SessionLocal() as s:
        rows = (
            await s.execute(
                select(Notification.type, Notification.body).where(
                    Notification.store_id == store_id
                )
            )
        ).all()
    assert [(t.value, body) for t, body in rows] == [
        ("ANOMALY_HIGH", "방금 올린 판매 데이터에서 이상치 2건이 감지됐습니다."),
    ]


@pytest.mark.asyncio
async def test_price_trends_join_links_and_carry_forward(client: AsyncClient) -> None:
    """단가 추세 — 날짜마다 그날 연결 상품의 그날 공용 단가, 빈 날은 직전 값,
    연결이 바뀌어도 이어진다. 기간에 값이 없는 품목은 빠진다 (01_basic_design.md §3.3.1)."""
    _, auth = await _register_verified_user(client)
    cheese = await _item(client, auth, "모짜렐라", unit="kg")
    await _item(client, auth, "설탕")  # 연결이 없어 빠진다
    today = datetime.now(KST).date()
    old, new = coupang_id(), coupang_id()
    async with app_db.SessionLocal() as s:
        for cid in (old, new):
            s.add(
                CoupangProduct(
                    item_id=cid, product_id=cid, product_name="치즈", option_name=None,
                    sale_price=10000, content_quantity=Decimal(1000), content_unit="g",
                    unit_price=None, updated_at=utcnow(),
                )
            )
        await s.flush()
        s.add_all([
            # 기간(30일) 앞 마지막 값이 첫날부터 이어진다
            CoupangPriceHistory(
                item_id=old, price_date=today - timedelta(days=40),
                unit_price=Decimal("15"), updated_at=utcnow(),
            ),
            CoupangPriceHistory(
                item_id=new, price_date=today - timedelta(days=12),
                unit_price=Decimal("12"), updated_at=utcnow(),
            ),
            # 시각은 UTC — 03시는 한국 12시라 같은 날짜
            InventoryCoupangLink(
                item_id=cheese, coupang_item_id=old,
                linked_at=datetime.combine(today - timedelta(days=60), time(3)),
            ),
            InventoryCoupangLink(
                item_id=cheese, coupang_item_id=new,
                linked_at=datetime.combine(today - timedelta(days=10), time(3)),
            ),
        ])
        await s.commit()

    r = await client.get("/api/inventory/price-trends?days=30", headers=auth)
    assert r.status_code == 200, r.text
    body = r.json()
    assert (body["start_date"], body["end_date"]) == (
        str(today - timedelta(days=30)), str(today),
    )
    [item] = body["items"]
    assert (item["name"], item["unit"]) == ("모짜렐라", "kg")
    prices = [p["unit_price"] for p in item["points"]]
    # 연결이 바뀐 날(앞에서 21번째 날)부터 새 상품 단가, 그 앞은 옛 상품 단가 — 재료 단위 kg
    assert prices == [15000.0] * 20 + [12000.0] * 11
