"""M7.A3 recommend v2 e2e — 합성 이력 (공개 정책: 실매장 데이터 미사용).

검증 대상: A안 단일 호출 파이프라인(① 매출 예측 × ② 비중 분해 → BOM → 재고) 계약 구조 ·
비중 반영 순서 · 재고 수준별 발주량 방향성 · 신뢰도 전파 · 결정성 · 최소 이력 422.
"""
from __future__ import annotations

import datetime as dt
import random

from fastapi.testclient import TestClient

from app.main import create_app

client = TestClient(create_app())

WEEKDAY_MULT = [1.0, 0.9, 1.1, 1.6, 1.2, 0.8, 0.6]
MENU_SHARES = {"menu-nakgob": 0.5, "menu-bokkeum": 0.3, "menu-soju": 0.2}
RECIPES = [
    {"menu_id": "menu-nakgob", "item_id": "item-nakji", "quantity_per_menu": 0.3, "unit": "kg"},
    {"menu_id": "menu-nakgob", "item_id": "item-gopchang", "quantity_per_menu": 0.2, "unit": "kg"},
    {"menu_id": "menu-bokkeum", "item_id": "item-gopchang", "quantity_per_menu": 0.25, "unit": "kg"},
    # menu-soju: 레시피 미연결(완제품) — BOM 없는 메뉴 허용
]
INVENTORY = [
    {"item_id": "item-nakji", "current_quantity": 0.5, "unit": "kg",
     "lead_time_days": 2, "safety_stock": 1.0},                      # 저재고 → 발주 권고 기대
    {"item_id": "item-gopchang", "current_quantity": 999.0, "unit": "kg",
     "lead_time_days": 1, "safety_stock": 2.0},                      # 과재고 → 0 기대
    {"item_id": "item-idle", "current_quantity": 3.0, "unit": "ea",
     "lead_time_days": 1, "safety_stock": 0.0},                      # 레시피 미연결 재료
]


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
    """일계 매출에 고정 비중(MENU_SHARES)을 곱해 메뉴×일 이력 합성."""
    out = []
    for row in sales_history:
        total_qty = max(1, row["total_amount"] // 20_000)
        for m, share in MENU_SHARES.items():
            q = round(total_qty * share)
            if q > 0:
                out.append({"date": row["date"], "menu_id": m, "quantity": q})
    return out


def make_body(end: dt.date, days: int, targets: list[dt.date], menu_days: int | None = None) -> dict:
    sales = gen_history(end, days)
    menu_src = sales if menu_days is None else sales[-menu_days:]
    return {
        "store_id": "test-store",
        "target_dates": [t.isoformat() for t in targets],
        "sales_history": sales,
        "menu_sales_history": gen_menu_history(menu_src),
        "weather": [{"date": (end - dt.timedelta(days=days) + dt.timedelta(days=i)).isoformat(),
                     "temp_min": 20.0, "temp_max": 29.0, "rainfall_mm": 0.0}
                    for i in range(days + 4)],
        "store_config": {"reopen_date": None},
        "recipes": RECIPES,
        "inventory": INVENTORY,
    }


END = dt.date(2026, 7, 27)  # 월요일
TARGETS = [END + dt.timedelta(days=k) for k in (1, 2, 3)]


def test_recommend_contract_and_pipeline():
    r = client.post("/ai/orders/recommend", json=make_body(END, 180, TARGETS))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["store_id"] == "test-store"
    assert len(body["target_dates"]) == 3

    # ② 비중 분해 — 합성 비중(0.5/0.3/0.2) 순서 그대로 복원돼야 함
    mf = body["menu_forecast"]
    assert [m["menu_id"] for m in mf] == ["menu-nakgob", "menu-bokkeum", "menu-soju"]
    assert all(m["expected_quantity"] > 0 for m in mf)

    # ③ 재고 로직 방향성
    recs = {x["item_id"]: x for x in body["recommendations"]}
    assert set(recs) == {"item-nakji", "item-gopchang", "item-idle"}
    assert recs["item-nakji"]["recommended_quantity"] > 0          # 저재고 → 발주
    assert recs["item-nakji"]["expected_stockout_date"] is not None
    assert recs["item-gopchang"]["recommended_quantity"] == 0      # 과재고 → 발주 불요
    assert recs["item-idle"]["recommended_quantity"] == 0          # 레시피 미연결
    assert "소모 없음" in recs["item-idle"]["recommendation_reason"]

    # ① 신뢰도 전파 — D+3 포함이라 LONG_HORIZON 배지 동반
    assert body["is_low_confidence"] is True
    assert body["low_confidence_reason"] == "LONG_HORIZON"


def test_recommend_deterministic():
    body = make_body(END, 120, TARGETS[:1])
    a = client.post("/ai/orders/recommend", json=body).json()
    b = client.post("/ai/orders/recommend", json=body).json()
    assert a["menu_forecast"] == b["menu_forecast"]
    assert a["recommendations"] == b["recommendations"]



def test_recommend_subtracts_incoming_from_quantity_only():
    base = make_body(END, 120, TARGETS[:1])
    incoming = {**base, "inventory": [{**INVENTORY[0], "incoming_quantity": 0.3}, *INVENTORY[1:]]}
    a = {x["item_id"]: x for x in client.post("/ai/orders/recommend", json=base).json()["recommendations"]}
    b = {x["item_id"]: x for x in client.post("/ai/orders/recommend", json=incoming).json()["recommendations"]}

    nakji_a, nakji_b = a["item-nakji"], b["item-nakji"]
    assert abs((nakji_a["recommended_quantity"] - nakji_b["recommended_quantity"]) - 0.3) < 0.011
    assert nakji_b["expected_stockout_date"] == nakji_a["expected_stockout_date"]  # 손에 있는 재고 기준
    assert "입고 예정 0.3" in nakji_b["recommendation_reason"]
    assert "입고 예정" not in nakji_a["recommendation_reason"]  # 칸 생략 시 기존 동작

def test_recommend_menu_history_too_short():
    r = client.post("/ai/orders/recommend", json=make_body(END, 120, TARGETS[:1], menu_days=5))
    assert r.status_code == 422
    assert "메뉴 판매 이력" in r.json()["detail"]


def test_recommend_disjoint_histories_rejected():
    """메뉴 이력이 일계 이력과 날짜가 안 겹치면 422 — 환산 계수 0으로 전량 0 발주 방지."""
    body = make_body(END, 120, TARGETS[:1])
    shifted = [{**m, "date": (dt.date.fromisoformat(m["date"]) + dt.timedelta(days=400)).isoformat()}
               for m in body["menu_sales_history"]]
    body["menu_sales_history"] = shifted
    body["target_dates"] = [(END + dt.timedelta(days=500)).isoformat()]  # 이력 이후 유지
    r = client.post("/ai/orders/recommend", json=body)
    assert r.status_code == 422
    assert "겹치지 않아" in r.json()["detail"]
