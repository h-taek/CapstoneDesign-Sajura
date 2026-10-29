"""담기 에이전트 서버 — 03_be.md §2.4. Compose 내부 네트워크에서 BE의 호출만 받는다."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from redis.asyncio import Redis

from app import service
from app.config import get_settings
from app.errors import AgentError
from app.redis_client import set_redis
from app.schemas import FilterRequest, StepRequest

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

# 분류기 설정이 비었으면 여기서 멈춘다 — 시작하지 않는다 (§2.4.3)
get_settings()


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    redis = Redis.from_url(get_settings().redis_url)
    set_redis(redis)
    yield
    await redis.aclose()


app = FastAPI(title="Sajura Agent", lifespan=_lifespan, docs_url=None, redoc_url=None)


@app.exception_handler(AgentError)
async def _agent_error(request: Request, exc: AgentError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content=exc.body())


@app.exception_handler(RequestValidationError)
async def _validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=400,
        content={
            "error": "VALIDATION_ERROR",
            "message": "요청 형식이 올바르지 않습니다.",
            "detail": [
                {"field": ".".join(str(p) for p in e["loc"]), "message": e["msg"]}
                for e in exc.errors()
            ],
        },
    )


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/agent/step")
async def agent_step(req: StepRequest) -> dict[str, Any]:
    return await service.step(req)


@app.post("/agent/filter")
async def agent_filter(req: FilterRequest) -> dict[str, Any]:
    return await service.filter_candidates(req)
