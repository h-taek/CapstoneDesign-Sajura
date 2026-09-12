"""M7.A2 predict e2e — 합성 이력으로 검증 (공개 정책: 실매장 데이터 미사용).

검증 대상: 계약 v2 응답 구조 · 다일 horizon · P10≤P90 · 신뢰도 트리거(04_feature_spec.md §5.3) ·
예측 근거(11_ai_spec.md §8) · 최소 이력 422.
"""
from __future__ import annotations

import datetime as dt
import random

from fastapi.testclient import TestClient

from app.main import create_app

client = TestClient(create_app())

WEEKDAY_MULT = [1.0, 0.9, 1.1, 1.6, 1.2, 0.8, 0.6]  # 목(3) 피크·일(6) 저점 — EDA §2.5 모사


def gen_history(end: dt.date, days: int, seed: int = 42) -> list[dict]:
    """합성 일계 이력 — 요일 패턴 + 노이즈, 일요일 30%는 휴무(행 생략)."""
    rng = random.Random(seed)
    out = []
    for i in range(days, 0, -1):
        d = end - dt.timedelta(days=i - 1)
        if d.weekday() == 6 and rng.random() < 0.3:
            continue  # 휴무일은 행 자체를 생략 (계약 허용)
        amount = int(400_000 * WEEKDAY_MULT[d.weekday()] * rng.uniform(0.7, 1.3))
        out.append({"date": d.isoformat(), "total_amount": amount,
                    "order_count": max(1, amount // 50_000)})
    return out


def gen_weather(start: dt.date, end: dt.date) -> list[dict]:
    return [{"date": (start + dt.timedelta(days=i)).isoformat(),
             "temp_min": 20.0, "temp_max": 29.0, "rainfall_mm": 0.0}
            for i in range((end - start).days + 1)]


def make_body(end: dt.date, days: int, targets: list[dt.date], seed: int = 42) -> dict:
    return {
        "store_id": "test-store",
        "target_dates": [t.isoformat() for t in targets],
        "sales_history": gen_history(end, days, seed),
        "weather": gen_weather(end - dt.timedelta(days=days), max(targets)),
        "store_config": {"reopen_date": None},
    }


END = dt.date(2026, 7, 27)  # 월요일 — D+1=화, D+3=목


def test_predict_multi_horizon_contract():
    targets = [END + dt.timedelta(days=k) for k in (1, 2, 3)]
    r = client.post("/ai/forecast/predict", json=make_body(END, 180, targets))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["store_id"] == "test-store"
    preds = body["predictions"]
    assert [p["horizon_days"] for p in preds] == [1, 2, 3]
    for p in preds:
        assert p["predicted_sales"] > 0
        assert p["interval_p10"] <= p["interval_p90"]
        ex = p["explanation"]
        assert ex["baseline"] == "직전 7영업일 평균"
        assert len(ex["top_factors"]) == 3
        assert "평소보다" in ex["sentence"]
    # T4 LONG_HORIZON — D+3부터 (06 §1 계단)
    assert preds[2]["is_low_confidence"] and preds[2]["low_confidence_reason"] == "LONG_HORIZON"


def test_special_day_trigger_beats_horizon():
    end = dt.date(2026, 8, 14)  # 금요일 — D+1 = 광복절(공휴일)
    r = client.post("/ai/forecast/predict",
                    json=make_body(end, 180, [dt.date(2026, 8, 15)]))
    assert r.status_code == 200, r.text
    p = r.json()["predictions"][0]
    assert p["is_low_confidence"] and p["low_confidence_reason"] == "SPECIAL_DAY"


def test_short_history_trigger():
    r = client.post("/ai/forecast/predict",
                    json=make_body(END, 45, [END + dt.timedelta(days=1)]))
    assert r.status_code == 200, r.text
    p = r.json()["predictions"][0]
    assert p["is_low_confidence"] and p["low_confidence_reason"] == "SHORT_HISTORY"


def test_too_short_history_rejected():
    r = client.post("/ai/forecast/predict",
                    json=make_body(END, 8, [END + dt.timedelta(days=1)]))
    assert r.status_code == 422


def test_deterministic_for_same_input():
    body = make_body(END, 120, [END + dt.timedelta(days=1)])
    a = client.post("/ai/forecast/predict", json=body).json()
    b = client.post("/ai/forecast/predict", json=body).json()
    assert a["predictions"][0]["predicted_sales"] == b["predictions"][0]["predicted_sales"]
