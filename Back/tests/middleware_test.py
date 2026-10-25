"""미들웨어 순서 — 03_be.md §13.1 (CORS가 가장 바깥)."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.config import get_settings


@pytest.mark.asyncio
async def test_rejected_host_response_still_has_cors_header(client: AsyncClient) -> None:
    origin = get_settings().cors_origins_list[0]
    r = await client.get("/health", headers={"host": "evil.example", "origin": origin})
    assert r.status_code == 400, r.text
    assert r.headers.get("access-control-allow-origin") == origin
