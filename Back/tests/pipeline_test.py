"""파이프라인 상태·이력·예측 완료 알림 — 02_implementation_design.md §3.9."""

from __future__ import annotations

from datetime import datetime

import pytest
from httpx import AsyncClient
from sqlalchemy import select

import app.db as app_db
from app.config import get_settings
from app.models.forecast import PipelineJob, PipelineStatus, PipelineTrigger, PipelineType
from app.models.notification import Notification
from tests.forecast_test import _store


async def _job(
    store_id: str, status: PipelineStatus, started_at: datetime, error: str | None = None
) -> None:
    async with app_db.SessionLocal() as s:
        s.add(PipelineJob(
            store_id=store_id, type=PipelineType.FORECAST, status=status,
            triggered_by=PipelineTrigger.N8N, started_at=started_at,
            finished_at=started_at, error_message=error,
        ))
        await s.commit()


@pytest.mark.asyncio
async def test_status_shows_latest_forecast_job(client: AsyncClient) -> None:
    auth, store_id, _ = await _store(client)
    r = await client.get("/api/pipeline/status", headers=auth)
    assert r.status_code == 200, r.text
    assert r.json() == {"forecast_job": None, "train_job": None}

    await _job(store_id, PipelineStatus.DONE, datetime(2026, 1, 1, 17, 0))
    await _job(store_id, PipelineStatus.FAILED, datetime(2026, 1, 2, 17, 0), error="AI 500")
    r = await client.get("/api/pipeline/status", headers=auth)
    assert r.json()["forecast_job"] == {
        "last_run_at": "2026-01-02T17:00:00Z", "status": "FAILED", "error_message": "AI 500",
    }


@pytest.mark.asyncio
async def test_history_pages_newest_first_for_own_store(client: AsyncClient) -> None:
    auth, store_id, _ = await _store(client)
    _, other_store, _ = await _store(client)
    for day in (1, 2, 3):
        await _job(store_id, PipelineStatus.DONE, datetime(2026, 1, day, 17, 0))
    await _job(other_store, PipelineStatus.DONE, datetime(2026, 1, 9, 17, 0))

    r = await client.get("/api/pipeline/history", params={"size": 2}, headers=auth)
    assert r.status_code == 200, r.text
    body = r.json()
    assert (body["total"], body["page"], body["size"], body["total_pages"]) == (3, 1, 2, 2)
    assert [i["started_at"] for i in body["items"]] == [
        "2026-01-03T17:00:00Z", "2026-01-02T17:00:00Z",
    ]
    first = body["items"][0]
    assert (first["type"], first["status"], first["triggered_by"]) == ("FORECAST", "DONE", "N8N")


@pytest.mark.asyncio
async def test_forecast_done_notifies_store_with_internal_token(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(get_settings(), "INTERNAL_API_TOKEN", "secret-token")
    _, store_id, _ = await _store(client)

    r = await client.post(
        "/api/pipeline/forecast-done", json={"store_id": store_id},
        headers={"X-Internal-Token": "secret-token"},
    )
    assert r.status_code == 204, r.text
    async with app_db.SessionLocal() as s:
        rows = (await s.execute(
            select(Notification.type, Notification.priority).where(
                Notification.store_id == store_id
            )
        )).all()
    assert [(t.value, p.value) for t, p in rows] == [("FORECAST_DONE", "INFO")]

    r = await client.post(
        "/api/pipeline/forecast-done", json={"store_id": "00000000-0000-0000-0000-000000000000"},
        headers={"X-Internal-Token": "secret-token"},
    )
    assert r.status_code == 404, r.text


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("configured", "sent"),
    [("secret-token", None), ("secret-token", "wrong"), ("", "")],
)
async def test_forecast_done_rejects_bad_token(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch, configured: str, sent: str | None
) -> None:
    monkeypatch.setattr(get_settings(), "INTERNAL_API_TOKEN", configured)
    headers = {} if sent is None else {"X-Internal-Token": sent}
    r = await client.post(
        "/api/pipeline/forecast-done",
        json={"store_id": "00000000-0000-0000-0000-000000000000"},
        headers=headers,
    )
    assert r.status_code == 401, r.text
