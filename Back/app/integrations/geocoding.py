"""Google Geocoding API — 매장 주소 → 좌표 (01_basic_design.md §3.11.1).

날씨 격자·관측소 계산에만 쓴다. 실패는 예외 없이 None — 주소 저장을 막지 않는다.
"""

from __future__ import annotations

import httpx
import structlog

from app.config import get_settings

GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
TIMEOUT_SECONDS = 5

log = structlog.get_logger(__name__)


async def geocode(address: str) -> tuple[float, float] | None:
    key = get_settings().GOOGLE_MAPS_API_KEY
    if not key:
        return None
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            r = await client.get(
                GEOCODE_URL,
                params={"address": address, "key": key, "language": "ko", "region": "kr"},
            )
            r.raise_for_status()
            body = r.json()
    except (httpx.HTTPError, ValueError) as exc:
        log.warning("geocode_failed", error=str(exc))
        return None
    if body.get("status") != "OK" or not body.get("results"):
        log.warning("geocode_no_result", status=body.get("status"))
        return None
    loc = body["results"][0]["geometry"]["location"]
    return float(loc["lat"]), float(loc["lng"])
