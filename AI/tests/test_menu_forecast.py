"""predict의 대상일별 메뉴 예상 수량 — 05_ai.md §2 ②, 02_implementation_design.md §3.8.

합성 이력(공개 정책: 실매장 데이터 미사용). 비중 분해 S1(decompose.py)이 대상일마다
'비중 × 그 날 예측 매출 × 수량/매출 계수'로 나오는지 본다.
"""
from __future__ import annotations

import datetime as dt
import random

from fastapi.testclient import TestClient

from app.main import create_app

client = TestClient(create_app())

WEEKDAY_MULT = [1.0, 0.9, 1.1, 1.6, 1.2, 0.8, 0.6]
MENU_SHARES = {"menu-nakgob": 0.5, "menu-bokkeum": 0.3, "menu-soju": 0.2}
END = dt.date(2026, 7, 27)  # 월요일
TARGETS = [END + dt.timedelta(days=k) for k in (1, 2, 3)]


def gen_history(end: dt.date, days: int, seed: int = 42) -> list[dict]:
    rng = random.Random(seed)
    out = []
    for i in range(days, 0, -1):
        d = end - dt.timedelta(days=i - 1)
        if d.weekday() == 6 and rng.random() < 0.3:
            continue
        amount = int(400_000 * WEEKDAY_MULT[d.weekday()] * rng.uniform(0.7, 1.3))
        out.append({"date": d.isoformat(), "total_amount": amount,
                    "order_count": max(1, amount // 50_000)})
    return out


def gen_menu_history(sales_history: list[dict]) -> list[dict]:
    out = []
    for row in sales_history:
        total_qty = max(1, row["total_amount"] // 20_000)
        for m, share in MENU_SHARES.items():
            q = round(total_qty * share)
            if q > 0:
                out.append({"date": row["date"], "menu_id": m, "quantity": q})
    return out


def make_body(days: int = 180, menu_days: int | None = None) -> dict:
    sales = gen_history(END, days)
    menu_src = sales if menu_days is None else sales[-menu_days:]
    return {
        "store_id": "test-store",
        "target_dates": [t.isoformat() for t in TARGETS],
        "sales_history": sales,
        "menu_sales_history": gen_menu_history(menu_src),
        "store_config": {"reopen_date": None},
    }


def test_each_prediction_has_menu_forecast_in_share_order():
    r = client.post("/ai/forecast/predict", json=make_body())
    assert r.status_code == 200, r.text
    preds = r.json()["predictions"]
    assert len(preds) == 3
    for p in preds:
        mf = p["menu_forecast"]
        assert [m["menu_id"] for m in mf] == ["menu-nakgob", "menu-bokkeum", "menu-soju"]
        assert all(m["expected_quantity"] > 0 for m in mf)


def test_menu_quantity_follows_each_days_sales():
    """예측 매출이 큰 날은 메뉴 수량 합도 크다 — 비중·계수는 같고 날짜별 매출만 다르다."""
    preds = client.post("/ai/forecast/predict", json=make_body()).json()["predictions"]
    totals = [(p["predicted_sales"], sum(m["expected_quantity"] for m in p["menu_forecast"]))
              for p in preds]
    by_sales = sorted(totals)
    assert [q for _, q in by_sales] == sorted(q for _, q in by_sales)


def test_menu_forecast_empty_without_enough_menu_history():
    r = client.post("/ai/forecast/predict", json=make_body(menu_days=5))
    assert r.status_code == 200, r.text
    assert all(p["menu_forecast"] == [] for p in r.json()["predictions"])

    body = make_body()
    del body["menu_sales_history"]
    r = client.post("/ai/forecast/predict", json=body)
    assert r.status_code == 200, r.text
    assert all(p["menu_forecast"] == [] for p in r.json()["predictions"])


def test_menu_forecast_empty_when_histories_do_not_overlap():
    body = make_body()
    body["menu_sales_history"] = [
        {**m, "date": (dt.date.fromisoformat(m["date"]) - dt.timedelta(days=400)).isoformat()}
        for m in body["menu_sales_history"]
    ]
    r = client.post("/ai/forecast/predict", json=body)
    assert r.status_code == 200, r.text
    assert all(p["menu_forecast"] == [] for p in r.json()["predictions"])


def test_recommend_endpoint_removed():
    assert client.post("/ai/orders/recommend", json={}).status_code == 404
