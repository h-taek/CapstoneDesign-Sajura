"""매장 좌표 → 기상청 예보 격자·최근접 ASOS 관측소 (02_implementation_design.md §4.3.3).

격자는 기상청 단기예보 격자 변환식(Lambert 정각원추, 5km). 관측소 목록은 app/data/asos_stations.json
(운영 중 ASOS — research/backend/18_weather_location_probe.md §2).
"""

from __future__ import annotations

import json
import math
from functools import cache
from pathlib import Path

STATIONS_PATH = Path(__file__).resolve().parent.parent / "data" / "asos_stations.json"

# 기상청 격자 상수 — 지구 반경(km), 격자 간격(km), 표준위도 1·2, 기준점 경도·위도, 기준점 격자 X·Y
_RE, _GRID = 6371.00877, 5.0
_SLAT1, _SLAT2, _OLON, _OLAT = 30.0, 60.0, 126.0, 38.0
_XO, _YO = 43, 136


def kma_grid(lat: float, lng: float) -> tuple[int, int]:
    d = math.pi / 180
    re = _RE / _GRID
    slat1, slat2, olon, olat = _SLAT1 * d, _SLAT2 * d, _OLON * d, _OLAT * d
    sn = math.log(math.cos(slat1) / math.cos(slat2)) / math.log(
        math.tan(math.pi / 4 + slat2 / 2) / math.tan(math.pi / 4 + slat1 / 2)
    )
    sf = math.tan(math.pi / 4 + slat1 / 2) ** sn * math.cos(slat1) / sn
    ro = re * sf / math.tan(math.pi / 4 + olat / 2) ** sn
    ra = re * sf / math.tan(math.pi / 4 + lat * d / 2) ** sn
    theta = lng * d - olon
    theta = (theta + math.pi) % (2 * math.pi) - math.pi
    theta *= sn
    return int(ra * math.sin(theta) + _XO + 0.5), int(ro - ra * math.cos(theta) + _YO + 0.5)


@cache
def _stations() -> list[dict]:
    return json.loads(STATIONS_PATH.read_text(encoding="utf-8"))


def _distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p = math.radians
    h = (
        math.sin(p(lat2 - lat1) / 2) ** 2
        + math.cos(p(lat1)) * math.cos(p(lat2)) * math.sin(p(lng2 - lng1) / 2) ** 2
    )
    return 2 * 6371.0 * math.asin(math.sqrt(h))


def nearest_asos(lat: float, lng: float) -> int:
    return min(_stations(), key=lambda s: _distance_km(lat, lng, s["lat"], s["lng"]))["stn_id"]
