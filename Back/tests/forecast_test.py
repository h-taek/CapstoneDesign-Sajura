"""수요예측 조회·수동 실행 — 01_basic_design.md §3.6.2, 02_implementation_design.md §3.7."""

from __future__ import annotations

import io
from datetime import UTC, date, datetime, timedelta

import httpx
import pytest
from httpx import AsyncClient

import app.db as app_db
import app.integrations.n8n as n8n
from app.models.forecast import (
    ForecastMenuItem,
    ForecastResult,
    PipelineJob,
    PipelineStatus,
    PipelineTrigger,
    PipelineType,
)
from tests.notifications_test import _store_id
from tests.sales_test import _create_menu, _csv_bytes, _register_verified_user

LAST_SALE = date(2026, 1, 15)  # 테스트 매장의 판매 이력 마지막 날
TARGETS = [LAST_SALE + timedelta(days=i) for i in (1, 2, 3)]


async def upload_one_sale(client: AsyncClient, auth: dict) -> None:
    r = await client.post(
        "/api/sales/upload",
        files={"file": ("s.csv", io.BytesIO(_csv_bytes([f"{LAST_SALE},아메리카노,1,4500,r1"])),
                        "text/csv")},
        data={
            "date_column": "날짜", "menu_column": "메뉴명",
            "quantity_column": "수량", "price_column": "금액",
            "external_sale_id_column": "영수증번호",
        },
        headers=auth,
    )
    assert r.status_code == 201, r.text


async def store_forecast(
    store_id: str,
    menu_qty: dict[str, float],
    *,
    dates: list[date] = TARGETS,
    low: dict[date, str] | None = None,
) -> None:
    """n8n이 저장하는 것과 같은 예측 행을 넣는다 — 대상일마다 메뉴 수량은 menu_qty."""
    low = low or {}
    async with app_db.SessionLocal() as s:
        for i, d in enumerate(dates):
            f = ForecastResult(
                store_id=store_id,
                target_date=d,
                horizon_days=i + 1,
                predicted_sales=100_000 * (i + 1),
                interval_p10=80_000 * (i + 1),
                interval_p90=120_000 * (i + 1),
                is_low_confidence=d in low,
                low_confidence_reason=low.get(d),
                explanation={
                    "baseline": "직전 7영업일 평균",
                    "deviation_vs_baseline": 0.1,
                    "top_factors": [{"feature": "dow_4", "label": "금요일 효과", "pct": 0.1}],
                    "sentence": "평소보다 약 10% 높을 것으로 예상됩니다",
                },
            )
            s.add(f)
            await s.flush()
            for menu_id, qty in menu_qty.items():
                s.add(ForecastMenuItem(
                    forecast_id=f.forecast_id, menu_id=menu_id, expected_quantity=qty
                ))
        await s.commit()


async def _store(client: AsyncClient) -> tuple[dict, str, str]:
    email, auth = await _register_verified_user(client)
    menu_id = await _create_menu(client, auth, "아메리카노")
    await upload_one_sale(client, auth)
    return auth, await _store_id(email), menu_id


async def _add_job(store_id: str, status: PipelineStatus, started_at: datetime) -> None:
    async with app_db.SessionLocal() as s:
        s.add(PipelineJob(
            store_id=store_id, type=PipelineType.FORECAST, status=status,
            triggered_by=PipelineTrigger.USER, started_at=started_at,
        ))
        await s.commit()


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


# ----------------------------------------------------------------------
# GET /api/forecast
# ----------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_forecast_returns_stored_predictions_with_menu_names(client: AsyncClient) -> None:
    auth, store_id, menu_id = await _store(client)
    await store_forecast(store_id, {menu_id: 10})

    r = await client.get("/api/forecast", headers=auth)
    assert r.status_code == 200, r.text
    preds = r.json()["predictions"]
    assert [p["target_date"] for p in preds] == [d.isoformat() for d in TARGETS]
    first = preds[0]
    assert (first["horizon_days"], first["predicted_sales"]) == (1, 100_000)
    assert (first["interval_p10"], first["interval_p90"]) == (80_000, 120_000)
    assert first["explanation"]["top_factors"][0]["label"] == "금요일 효과"
    assert first["menu_forecast"] == [
        {"menu_id": menu_id, "menu_name": "아메리카노", "expected_quantity": 10.0}
    ]

    r = await client.get(
        "/api/forecast", params={"target_date": TARGETS[1].isoformat()}, headers=auth
    )
    assert r.status_code == 200, r.text
    assert [p["horizon_days"] for p in r.json()["predictions"]] == [2]


@pytest.mark.asyncio
async def test_get_forecast_without_stored_targets_is_404(client: AsyncClient) -> None:
    auth, store_id, menu_id = await _store(client)
    # 판매 이력 마지막 날 기준 D+1~D+3이 아닌 지난 예측은 쓰지 않는다
    await store_forecast(store_id, {menu_id: 10}, dates=[date(2026, 1, 1)])

    r = await client.get("/api/forecast", headers=auth)
    assert r.status_code == 404, r.text
    assert r.json()["error"] == "FORECAST_NOT_FOUND"


# ----------------------------------------------------------------------
# POST /api/forecast/run
# ----------------------------------------------------------------------


@pytest.mark.asyncio
async def test_run_triggers_n8n_and_returns_saved_forecast(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    auth, store_id, menu_id = await _store(client)
    calls: list[str] = []

    async def fake_run(sid: str) -> dict:
        calls.append(sid)
        await store_forecast(sid, {menu_id: 7})
        return {"status": "DONE", "insufficient_history": False, "error": None}

    monkeypatch.setattr(n8n, "run_forecast", fake_run)
    r = await client.post("/api/forecast/run", headers=auth)
    assert r.status_code == 200, r.text
    assert calls == [store_id]
    assert len(r.json()["predictions"]) == 3


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("outcome", "status", "error"),
    [
        ({"status": "FAILED", "insufficient_history": True, "error": "영업일 이력 3일"}, 422,
         "AI_INSUFFICIENT_HISTORY"),
        ({"status": "FAILED", "insufficient_history": False, "error": "AI 500"}, 503,
         "PIPELINE_AI_SERVER_UNAVAILABLE"),
    ],
)
async def test_run_maps_failed_outcome(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch, outcome: dict, status: int, error: str
) -> None:
    auth, _, _ = await _store(client)

    async def fake_run(sid: str) -> dict:
        return outcome

    monkeypatch.setattr(n8n, "run_forecast", fake_run)
    r = await client.post("/api/forecast/run", headers=auth)
    assert r.status_code == status, r.text
    assert r.json()["error"] == error


@pytest.mark.asyncio
async def test_run_when_n8n_unreachable_is_503(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    auth, _, _ = await _store(client)

    async def fake_run(sid: str) -> dict:
        raise httpx.ConnectError("n8n down")

    monkeypatch.setattr(n8n, "run_forecast", fake_run)
    r = await client.post("/api/forecast/run", headers=auth)
    assert r.status_code == 503, r.text
    assert r.json()["error"] == "PIPELINE_AI_SERVER_UNAVAILABLE"


@pytest.mark.asyncio
async def test_run_rejects_while_recent_job_running(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    auth, store_id, menu_id = await _store(client)
    calls: list[str] = []

    async def fake_run(sid: str) -> dict:
        calls.append(sid)
        await store_forecast(sid, {menu_id: 7})
        return {"status": "DONE", "insufficient_history": False, "error": None}

    monkeypatch.setattr(n8n, "run_forecast", fake_run)
    await _add_job(store_id, PipelineStatus.RUNNING, _now() - timedelta(minutes=2))
    r = await client.post("/api/forecast/run", headers=auth)
    assert r.status_code == 429, r.text
    assert r.json()["error"] == "PIPELINE_ALREADY_RUNNING"
    assert calls == []


@pytest.mark.asyncio
async def test_run_ignores_stale_running_job(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    auth, store_id, menu_id = await _store(client)

    async def fake_run(sid: str) -> dict:
        await store_forecast(sid, {menu_id: 7})
        return {"status": "DONE", "insufficient_history": False, "error": None}

    monkeypatch.setattr(n8n, "run_forecast", fake_run)
    await _add_job(store_id, PipelineStatus.RUNNING, _now() - timedelta(minutes=11))
    r = await client.post("/api/forecast/run", headers=auth)
    assert r.status_code == 200, r.text
