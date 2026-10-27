"""/api/pipeline — 예측 작업 상태·이력, n8n 예측 완료 알림 (02_implementation_design.md §3.9)."""
from __future__ import annotations

import hmac
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query, Response, status

from app.api.deps import CurrentUserDep, SessionDep, require_business_access
from app.config import get_settings
from app.core import errors
from app.models.forecast import PipelineType
from app.schemas.pipeline import (
    ForecastDoneRequest,
    PipelineHistoryResponse,
    PipelineStatusResponse,
)
from app.services.pipeline_service import PipelineService
from app.services.store_service import StoreService

router = APIRouter(prefix="/api/pipeline", tags=["pipeline"])


async def _store_id(session, user_id: str) -> str:
    return (await StoreService(session).get_store(user_id)).store_id


@router.get(
    "/status",
    response_model=PipelineStatusResponse,
    dependencies=[Depends(require_business_access)],
)
async def get_status(session: SessionDep, current: CurrentUserDep) -> PipelineStatusResponse:
    store_id = await _store_id(session, current.user_id)
    return await PipelineService(session).status(store_id=store_id)


@router.get(
    "/history",
    response_model=PipelineHistoryResponse,
    dependencies=[Depends(require_business_access)],
)
async def get_history(
    session: SessionDep,
    current: CurrentUserDep,
    type: PipelineType | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> PipelineHistoryResponse:
    store_id = await _store_id(session, current.user_id)
    return await PipelineService(session).history(
        store_id=store_id, type=type, page=page, size=size
    )


def _require_internal_token(
    x_internal_token: Annotated[str | None, Header()] = None,
) -> None:
    """n8n 전용 — 공유 비밀값이 설정돼 있고 헤더와 같을 때만 통과한다."""
    expected = get_settings().INTERNAL_API_TOKEN
    if not expected or not x_internal_token or not hmac.compare_digest(
        x_internal_token, expected
    ):
        raise errors.unauthorized("내부 호출 토큰이 올바르지 않습니다.")


@router.post(
    "/forecast-done",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    response_model=None,
    dependencies=[Depends(_require_internal_token)],
)
async def forecast_done(payload: ForecastDoneRequest, session: SessionDep) -> Response:
    await PipelineService(session).forecast_done(store_id=payload.store_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
