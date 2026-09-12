"""AI Server entry — Phase 7 M7.A1 API 골격.

Spec refs:
  - docs/spec/07_api_spec.md §8 AI Server 연동 API (contract SSOT)
  - docs/spec/11_ai_spec.md §3 초기 모델 V1-t (38차 확정)
  - docs/plan/03_ai.md M7.A1~A7

라우터: /ai/health · /ai/forecast/{predict,train,status} · /ai/orders/recommend.
[MVP] 구현 완료: health(M7.A6)·predict(M7.A2)·recommend(M7.A3, 계약 v2 A안).
train/status는 [2단계](M7.A5) — 계약 스키마만 OpenAPI로 노출하고 501을 반환한다.
plan의 /ai/xai/{forecast_id}(M7.A4)는 07_api_spec.md §8에 없는 경로 — spec 방침(예측 근거를
predict 응답 필드로 추가)을 따르며, 경로 신설 여부는 spec 갱신 시 결정한다.
"""
from __future__ import annotations

from fastapi import FastAPI

from app.api.forecast import router as forecast_router
from app.api.health import router as health_router
from app.api.orders import router as orders_router


def create_app() -> FastAPI:
    app = FastAPI(title="sajura-ai", version="0.1.0")
    app.include_router(health_router)
    app.include_router(forecast_router)
    app.include_router(orders_router)
    return app


app = create_app()
