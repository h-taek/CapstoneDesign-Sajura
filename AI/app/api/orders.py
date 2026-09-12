"""추천발주 라우터 — 07_api_spec.md §8 POST /ai/orders/recommend 계약 v2 (M7.A3, A안: 단일 호출).

파이프라인(전 단계 매장별·요청 단위 stateless):
  ① V1-t 매출 예측(app/model/predictor.py)
  × ② 메뉴 비중 분해(app/model/decompose.py — 검증: notebooks/11_menu_decomposition.ipynb)
  → 메뉴별 예상 수량 → 점주 레시피(BOM) 전개 → 재고·리드타임·안전재고 반영 발주 참고치.
③ 이후는 결정론 — 예측 불확실성은 is_low_confidence로 동반 전파(참고치 원칙, model_spec §9).
"""
from __future__ import annotations

import datetime as dt
import math

import pandas as pd
from fastapi import APIRouter, HTTPException

from app.model.decompose import MIN_MENU_OPEN_DAYS, menu_shares, qty_per_krw
from app.model.predictor import MIN_OPEN_DAYS, SalesForecaster
from app.schemas import MenuForecastItem, Recommendation, RecommendRequest, RecommendResponse

router = APIRouter(prefix="/ai/orders", tags=["orders"])


@router.post("/recommend", response_model=RecommendResponse)
async def recommend(body: RecommendRequest) -> RecommendResponse:
    history = pd.DataFrame([r.model_dump() for r in body.sales_history])
    history["date"] = pd.to_datetime(history["date"])
    n_open = int((history["total_amount"] > 0).sum())
    if n_open < MIN_OPEN_DAYS:
        raise HTTPException(
            status_code=422,
            detail=f"영업일 이력 {n_open}일 — 최소 {MIN_OPEN_DAYS}일 필요 (lag·rolling 피처 구성 불가)",
        )
    last_open = history.loc[history["total_amount"] > 0, "date"].max().date()
    if min(body.target_dates) <= last_open:
        raise HTTPException(status_code=422, detail="target_dates는 이력 마지막 영업일 이후여야 합니다")

    menu_hist = pd.DataFrame([m.model_dump() for m in body.menu_sales_history])
    menu_hist["date"] = pd.to_datetime(menu_hist["date"])
    menu_open = int(menu_hist.loc[menu_hist["quantity"] > 0, "date"].nunique())
    if menu_open < MIN_MENU_OPEN_DAYS:
        raise HTTPException(
            status_code=422,
            detail=f"메뉴 판매 이력 {menu_open}영업일 — 비중 분해에 최소 {MIN_MENU_OPEN_DAYS}일 필요",
        )

    weather = (pd.DataFrame([w.model_dump() for w in body.weather])
               if body.weather else pd.DataFrame(columns=["date", "temp_min", "temp_max", "rainfall_mm"]))
    reopen = body.store_config.reopen_date if body.store_config else None

    # ① 매출 예측 — predict와 동일한 stateless fit
    forecaster = SalesForecaster(history, weather, reopen)
    forecaster.fit()
    preds = [forecaster.predict_one(d) for d in sorted(body.target_dates)]
    low = next((p for p in preds if p["is_low_confidence"]), None)

    # ② 비중 분해 — 예측 매출 × (수량/매출 계수) × 메뉴 비중 = 대상 기간 메뉴별 예상 수량
    shares = menu_shares(menu_hist)
    ratio = qty_per_krw(menu_hist, history)
    if ratio <= 0:  # 두 이력의 날짜 불일치 → 조용한 전량 0 발주를 막는다
        raise HTTPException(
            status_code=422,
            detail="menu_sales_history와 sales_history의 날짜가 겹치지 않아 수량/매출 환산 불가",
        )
    total_sales_hat = float(sum(p["predicted_sales"] for p in preds))
    menu_qty = shares * total_sales_hat * ratio
    menu_forecast = [MenuForecastItem(menu_id=str(m), expected_quantity=round(float(q), 1))
                     for m, q in menu_qty.sort_values(ascending=False).items()]

    # ③ BOM 전개(점주 레시피) → 재료별 예상 소모 → 재고·리드타임 반영 참고치
    need: dict[str, float] = {}
    for r in body.recipes:
        need[r.item_id] = need.get(r.item_id, 0.0) + float(menu_qty.get(r.menu_id, 0.0)) * r.quantity_per_menu

    horizon = len(body.target_dates)
    recs = []
    for inv in body.inventory:
        daily = need.get(inv.item_id, 0.0) / horizon
        window_need = daily * (horizon + inv.lead_time_days)  # 대상 기간 + 리드타임 커버
        recommended = max(0.0, window_need + inv.safety_stock - inv.current_quantity)
        stockout = (last_open + dt.timedelta(days=math.ceil(inv.current_quantity / daily))
                    if daily > 0 else None)
        reason = (f"향후 {horizon}일+리드타임 {inv.lead_time_days}일 예상 소모 "
                  f"{window_need:.1f}{inv.unit} + 안전재고 {inv.safety_stock:g} "
                  f"− 현재고 {inv.current_quantity:g}"
                  if daily > 0 else "대상 기간 예상 소모 없음 — 레시피 연결 메뉴의 판매 예상 0")
        recs.append(Recommendation(
            item_id=inv.item_id, recommended_quantity=round(recommended, 2),
            expected_stockout_date=stockout, lead_time_days=inv.lead_time_days,
            safety_stock=inv.safety_stock, config_status="OK", defaults_used=None,
            recommendation_reason=reason))

    return RecommendResponse(
        store_id=body.store_id, target_dates=sorted(body.target_dates),
        is_low_confidence=low is not None,
        low_confidence_reason=low["low_confidence_reason"] if low else None,
        menu_forecast=menu_forecast, recommendations=recs)
