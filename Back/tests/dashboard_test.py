"""대시보드 예측 vs 실제 — 02_implementation_design.md §3.9."""

from __future__ import annotations

import io
from datetime import date

import pytest
from httpx import AsyncClient

from tests.forecast_test import _store, store_forecast
from tests.sales_test import _csv_bytes

URL = "/api/dashboard/forecast-vs-actual"


async def _upload(client: AsyncClient, auth: dict, rows: list[str]) -> None:
    r = await client.post(
        "/api/sales/upload",
        files={"file": ("s.csv", io.BytesIO(_csv_bytes(rows)), "text/csv")},
        data={
            "date_column": "날짜", "menu_column": "메뉴명",
            "quantity_column": "수량", "price_column": "금액",
            "external_sale_id_column": "영수증번호",
        },
        headers=auth,
    )
    assert r.status_code == 201, r.text


@pytest.mark.asyncio
async def test_forecast_vs_actual_fills_every_date(client: AsyncClient) -> None:
    # 판매: 1/13 두 건(합산), 1/15 한 건(_store가 올림). 1/14는 판매 없음. 마지막 판매일 1/15
    auth, store_id, menu_id = await _store(client)
    await _upload(client, auth, [
        "2026-01-13 10:00:00,아메리카노,1,4500,d1",
        "2026-01-13 15:00:00,아메리카노,2,9000,d2",
    ])
    # 예측: 1/13(지난 날짜), 1/16(마지막 판매일 다음 날)
    await store_forecast(store_id, {menu_id: 10}, dates=[date(2026, 1, 13), date(2026, 1, 16)])

    r = await client.get(
        URL, params={"start_date": "2026-01-12", "end_date": "2026-01-16"}, headers=auth
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert (body["start_date"], body["end_date"]) == ("2026-01-12", "2026-01-16")
    rows = {p["date"]: p for p in body["data"]}
    assert list(rows) == [
        "2026-01-12", "2026-01-13", "2026-01-14", "2026-01-15", "2026-01-16"
    ]
    assert [p["actual_sales"] for p in body["data"]] == [0, 13500, 0, 4500, None]
    assert rows["2026-01-13"] == {
        "date": "2026-01-13", "actual_sales": 13500, "predicted_sales": 100_000,
        "interval_p10": 80_000, "interval_p90": 120_000, "horizon_days": 1,
    }
    assert (rows["2026-01-16"]["predicted_sales"], rows["2026-01-16"]["horizon_days"]) == (
        200_000, 2
    )
    for d in ("2026-01-12", "2026-01-14", "2026-01-15"):
        assert rows[d]["predicted_sales"] is None
    assert rows["2026-01-14"]["interval_p10"] is None


@pytest.mark.asyncio
async def test_forecast_vs_actual_rejects_reversed_range(client: AsyncClient) -> None:
    auth, _, _ = await _store(client)
    r = await client.get(
        URL, params={"start_date": "2026-01-16", "end_date": "2026-01-12"}, headers=auth
    )
    assert r.status_code == 400, r.text
    assert r.json()["error"] == "VALIDATION_ERROR"
