"""AI Server health endpoint — 07_api_spec.md §8 GET /ai/health (M7.A6 확장).

- model_loaded : 서빙 스택 자가 점검(합성 미니 학습·예측 스모크) 통과 여부 —
  stateless 설계라 "아티팩트 로드" 대신 "요청 시 학습 가능"을 보증한다.
- last_trained_at : stateless MVP에서는 null 고정 — 주간 재학습·모델 저장(M7.A5 [2단계]) 도입 시 채움.
- components : serving_stack·academic_calendar(커버리지 stale 판정)·holidays.
  하나라도 ok가 아니면 status="degraded" (호출 주체 n8n/BE가 알림 처리 — 11_ai_spec.md §10).
"""
from __future__ import annotations

from fastapi import APIRouter

from app.model.status import health_components
from app.schemas import HealthResponse

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    components = health_components()
    ok = all(c.get("status") == "ok" for c in components.values())
    return HealthResponse(
        status="ok" if ok else "degraded",
        model_loaded=components["serving_stack"].get("status") == "ok",
        last_trained_at=None,
        components=components,
    )
