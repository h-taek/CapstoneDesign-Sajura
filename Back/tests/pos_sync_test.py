"""POS 연동 동기화 — 등록·변경 직후 동기화 작업, CSV·POS API 판매가 겹치는 날
(01_basic_design.md §3.4.3·§3.4.7).

토스플레이스 조회는 _FakeToss로 바꿔 끼운다. 주문 모양은 tossplace_adapter_test와 같다.
"""
from __future__ import annotations

import io
from datetime import datetime

import pytest
from httpx import AsyncClient
from sqlalchemy import select, update

import app.db as app_db
from app.core.redis import get_redis
from app.models.pos_connection import PosConnection, PosStatus
from app.models.sale_record import SaleRecord
from app.services import pos_sync_service
from app.services.pos_sync_service import PosSyncService
from app.services.sale_service import SaleService
from tests.sales_test import _create_menu, _csv_bytes, _register_verified_user

UPLOAD_FORM = {
    "date_column": "날짜", "menu_column": "메뉴명",
    "quantity_column": "수량", "price_column": "금액",
    "external_sale_id_column": "영수증번호",
}


class _FakeToss:
    orders: list[dict] = []

    def __init__(self, **kwargs: object) -> None:
        pass

    async def __aenter__(self) -> _FakeToss:
        return self

    async def __aexit__(self, *exc: object) -> None:
        return None

    async def list_orders(self, merchant_id: str, *, start: datetime, end: datetime) -> list[dict]:
        return list(self.orders)


@pytest.fixture
def fake_toss(monkeypatch: pytest.MonkeyPatch) -> type[_FakeToss]:
    _FakeToss.orders = []
    monkeypatch.setattr(pos_sync_service, "TossPlaceClient", _FakeToss)
    return _FakeToss


def _toss_order(order_id: str, completed_at: str, title: str, price: int) -> dict:
    return {
        "id": order_id, "orderState": "COMPLETED", "completedAt": completed_at,
        "lineItems": [{"item": {"title": title}, "itemPrice": {"priceValue": price},
                       "quantity": 1}],
    }


async def _queued_jobs() -> int:
    return await get_redis().zcard("arq:queue")


async def _connect_toss(client: AsyncClient, auth: dict, merchant_id: str = "M1") -> str:
    r = await client.post(
        "/api/store/pos", json={"pos_type": "TOSSPLACE", "store_code": merchant_id}, headers=auth
    )
    assert r.status_code == 201, r.text
    return (await client.get("/api/store", headers=auth)).json()["store_id"]


async def _upload(client: AsyncClient, auth: dict, rows: list[str]) -> dict:
    r = await client.post(
        "/api/sales/upload",
        files={"file": ("sales.csv", io.BytesIO(_csv_bytes(rows)), "text/csv")},
        data=UPLOAD_FORM, headers=auth,
    )
    assert r.status_code == 201, r.text
    return r.json()


async def _sales_by_day(store_id: str) -> list[tuple[str, str]]:
    async with app_db.SessionLocal() as session:
        rows = (
            await session.execute(
                select(SaleRecord.source, SaleRecord.sold_at).where(SaleRecord.store_id == store_id)
            )
        ).all()
    return sorted((source.value, sold_at.date().isoformat()) for source, sold_at in rows)


async def _sync(store_id: str) -> int:
    async with app_db.SessionLocal() as session:
        return await PosSyncService(session).sync_store(store_id)


@pytest.mark.asyncio
async def test_tossplace_connects_with_merchant_id_only_and_queues_first_sync(
    client: AsyncClient,
) -> None:
    _, auth = await _register_verified_user(client)
    before = await _queued_jobs()
    r = await client.post(
        "/api/store/pos", json={"pos_type": "TOSSPLACE", "store_code": "M1"}, headers=auth
    )
    assert r.status_code == 201, r.text
    assert (r.json()["api_key"], r.json()["store_code"]) == ("", "M1")
    assert await _queued_jobs() == before + 1


@pytest.mark.asyncio
async def test_other_pos_still_requires_api_key(client: AsyncClient) -> None:
    _, auth = await _register_verified_user(client)
    r = await client.post(
        "/api/store/pos", json={"pos_type": "KIWOOM", "store_code": "K1"}, headers=auth
    )
    assert r.status_code == 400, r.text
    assert r.json()["error"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_changing_merchant_id_clears_last_sync_and_queues_again(client: AsyncClient) -> None:
    _, auth = await _register_verified_user(client)
    store_id = await _connect_toss(client, auth)
    async with app_db.SessionLocal() as session:
        await session.execute(
            update(PosConnection).where(PosConnection.store_id == store_id).values(
                last_synced_at=datetime(2026, 10, 1), status=PosStatus.ERROR, error_message="x",
            )
        )
        await session.commit()
    before = await _queued_jobs()

    r = await client.patch("/api/store/pos", json={"store_code": "M1"}, headers=auth)
    assert r.status_code == 200, r.text
    assert await _queued_jobs() == before  # 같은 가맹점이면 다시 받지 않는다

    r = await client.patch("/api/store/pos", json={"store_code": "M2"}, headers=auth)
    assert r.status_code == 200, r.text
    assert await _queued_jobs() == before + 1
    status = (await client.get("/api/store/pos/status", headers=auth)).json()
    assert status == {"status": "CONNECTED", "last_synced_at": None, "error_message": None}


@pytest.mark.asyncio
async def test_pos_sync_replaces_csv_sales_only_on_days_with_pos_sales(
    client: AsyncClient, fake_toss: type[_FakeToss],
) -> None:
    _, auth = await _register_verified_user(client)
    await _create_menu(client, auth, "소주", price=5000)
    store_id = await _connect_toss(client, auth)
    await _upload(client, auth, [
        "2026-10-01 20:00:00,소주,2,10000,csv-1",
        "2026-10-02 21:00:00,소주,3,15000,csv-2",
    ])
    # UTC 2026-10-02 12:30 = KST 21:30 — CSV 2일 판매와 같은 날
    fake_toss.orders = [_toss_order("o1", "2026-10-02T12:30:00Z", "소주", 5000)]

    assert await _sync(store_id) == 1
    assert await _sales_by_day(store_id) == [("CSV", "2026-10-01"), ("POS", "2026-10-02")]


@pytest.mark.asyncio
async def test_csv_upload_skips_rows_on_days_with_pos_sales(
    client: AsyncClient, fake_toss: type[_FakeToss],
) -> None:
    _, auth = await _register_verified_user(client)
    await _create_menu(client, auth, "소주", price=5000)
    store_id = await _connect_toss(client, auth)
    fake_toss.orders = [_toss_order("o1", "2026-10-02T12:30:00Z", "소주", 5000)]
    assert await _sync(store_id) == 1

    body = await _upload(client, auth, [
        "2026-10-02 21:00:00,소주,3,15000,csv-2",
        "2026-10-03 21:00:00,소주,1,5000,csv-3",
    ])
    assert (body["imported"], body["skipped"]) == (1, 1)
    assert "POS 연동 판매가 있는 날: 1건" in body["skipped_reasons"]
    assert await _sales_by_day(store_id) == [("CSV", "2026-10-03"), ("POS", "2026-10-02")]


@pytest.mark.asyncio
async def test_unexpected_failure_marks_error_and_does_not_raise(
    client: AsyncClient, fake_toss: type[_FakeToss], monkeypatch: pytest.MonkeyPatch,
) -> None:
    _, auth = await _register_verified_user(client)
    store_id = await _connect_toss(client, auth)
    fake_toss.orders = [_toss_order("o1", "2026-10-02T12:30:00Z", "소주", 5000)]

    async def _boom(self: SaleService, **kwargs: object) -> None:
        raise RuntimeError("db down")

    monkeypatch.setattr(SaleService, "ingest_pos_sales", _boom)
    assert await _sync(store_id) == 0
    status = (await client.get("/api/store/pos/status", headers=auth)).json()
    assert status["status"] == "ERROR"
    assert status["error_message"] == "판매 데이터를 저장하지 못했습니다."
