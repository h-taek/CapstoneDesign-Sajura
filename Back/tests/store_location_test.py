"""매장 위치 — 주소 → 좌표·예보 격자·최근접 ASOS 관측소 (02_implementation_design.md §4.3.3)."""

from __future__ import annotations

from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import select

import app.db as app_db
from app.core.weather_location import kma_grid, nearest_asos
from app.integrations import geocoding
from app.models.store import Store
from tests.notifications_test import _store_id
from tests.sales_test import _register_verified_user

JOCHIWON = "세종특별자치시 조치원읍 세종로 2639"
JOCHIWON_COORDS = (36.6214795, 127.2863404)  # Google 실측 (research/backend/18 §4)


def test_kma_grid() -> None:
    # 기상청 단기예보 실호출로 확인한 조치원 격자 (research/backend/18 §1)
    assert kma_grid(36.6014, 127.2985) == (66, 106)


def test_nearest_asos() -> None:
    assert nearest_asos(*JOCHIWON_COORDS) == 181  # 서청주 9.0km
    assert nearest_asos(37.5009393, 127.036584) == 108  # 서울


async def _location(email: str) -> tuple:
    async with app_db.SessionLocal() as s:
        st = await s.scalar(select(Store).where(Store.store_id == await _store_id(email)))
        return st.latitude, st.longitude, st.kma_nx, st.kma_ny, st.asos_stn_id


@pytest.mark.asyncio
async def test_address_change_sets_location(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    email, auth = await _register_verified_user(client)
    calls: list[str] = []

    async def fake(address: str) -> tuple[float, float]:
        calls.append(address)
        return JOCHIWON_COORDS

    monkeypatch.setattr(geocoding, "geocode", fake)
    r = await client.patch("/api/store", json={"address": JOCHIWON}, headers=auth)
    assert r.status_code == 200, r.text
    assert "latitude" not in r.json()  # 위치 칸은 응답에 내보내지 않는다
    lat, lng, *rest = await _location(email)
    assert (lat, lng) == tuple(Decimal(f"{v:.6f}") for v in JOCHIWON_COORDS)
    assert rest == [*kma_grid(*JOCHIWON_COORDS), 181]

    # 주소가 그대로면 다시 부르지 않는다
    r = await client.patch("/api/store", json={"address": JOCHIWON, "phone": "010-2222-3333"},
                           headers=auth)
    assert r.status_code == 200, r.text
    assert calls == [JOCHIWON]


@pytest.mark.asyncio
async def test_geocode_failure_or_blank_address_clears_location(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    email, auth = await _register_verified_user(client)

    async def found(address: str) -> tuple[float, float]:
        return JOCHIWON_COORDS

    monkeypatch.setattr(geocoding, "geocode", found)
    await client.patch("/api/store", json={"address": JOCHIWON}, headers=auth)
    assert (await _location(email))[4] == 181

    async def not_found(address: str) -> None:
        return None

    monkeypatch.setattr(geocoding, "geocode", not_found)
    r = await client.patch("/api/store", json={"address": "아무말대잔치 주소"}, headers=auth)
    assert r.status_code == 200, r.text  # 변환 실패가 주소 저장을 막지 않는다
    assert r.json()["address"] == "아무말대잔치 주소"
    assert await _location(email) == (None, None, None, None, None)

    monkeypatch.setattr(geocoding, "geocode", found)
    await client.patch("/api/store", json={"address": JOCHIWON}, headers=auth)
    r = await client.patch("/api/store", json={"address": ""}, headers=auth)
    assert r.status_code == 200, r.text
    assert await _location(email) == (None, None, None, None, None)
