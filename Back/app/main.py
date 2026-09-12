"""FastAPI application entry — Phase 2 BE bootstrap + Phase 3 auth routers.

Spec refs:
  - docs/spec/09_service_design.md §10 미들웨어 등록 순서
  - docs/plan/01_be.md M2.B2
"""
from __future__ import annotations

from datetime import UTC, datetime

import sentry_sdk
from asgi_correlation_id import CorrelationIdMiddleware
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import ORJSONResponse
from sentry_sdk.integrations.asgi import SentryAsgiMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.admin import router as admin_router
from app.api.auth import router as auth_router
from app.api.forecast import router as forecast_router
from app.api.health import router as health_router
from app.api.inventory import router as inventory_router
from app.api.menu import router as menu_router
from app.api.oauth import router as oauth_router
from app.api.orders import router as orders_router
from app.api.pos_stub import router as pos_router
from app.api.prices import router as prices_router
from app.api.sales import router as sales_router
from app.api.store import router as store_router
from app.config import get_settings
from app.logging_config import configure_logging


def _default_error_code(status_code: int) -> str:
    return {
        400: "VALIDATION_ERROR", 401: "UNAUTHORIZED", 403: "FORBIDDEN",
        404: "NOT_FOUND", 409: "CONFLICT", 422: "VALIDATION_ERROR",
        429: "TOO_MANY_REQUESTS", 500: "INTERNAL_SERVER_ERROR",
        503: "SERVICE_UNAVAILABLE",
    }.get(status_code, "INTERNAL_SERVER_ERROR")


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(env=settings.APP_ENV, level=settings.LOG_LEVEL)

    if settings.SENTRY_DSN:
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN, environment=settings.SENTRY_ENVIRONMENT,
            traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
            release=settings.SENTRY_RELEASE or None, send_default_pii=False,
        )

    app = FastAPI(title=settings.APP_NAME, default_response_class=ORJSONResponse)

    app.add_middleware(
        CORSMiddleware, allow_origins=settings.cors_origins_list,
        allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
    )
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_hosts_list)
    app.add_middleware(CorrelationIdMiddleware)
    if settings.SENTRY_DSN:
        app.add_middleware(SentryAsgiMiddleware)

    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(oauth_router)
    app.include_router(store_router)
    app.include_router(admin_router)
    app.include_router(pos_router)
    app.include_router(menu_router)
    app.include_router(inventory_router)
    app.include_router(orders_router)
    app.include_router(forecast_router)
    app.include_router(sales_router)
    app.include_router(prices_router)

    @app.exception_handler(StarletteHTTPException)
    async def _http_exc_handler(request: Request, exc: StarletteHTTPException) -> ORJSONResponse:
        body = exc.detail if isinstance(exc.detail, dict) else {
            "error": _default_error_code(exc.status_code),
            "message": str(exc.detail), "detail": None,
        }
        return ORJSONResponse(
            status_code=exc.status_code,
            content={
                "error": body.get("error", _default_error_code(exc.status_code)),
                "message": body.get("message", ""),
                "detail": body.get("detail"),
                "path": request.url.path,
                "timestamp": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            },
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_exc_handler(
        request: Request, exc: RequestValidationError
    ) -> ORJSONResponse:
        return ORJSONResponse(
            status_code=400,
            content={
                "error": "VALIDATION_ERROR",
                "message": "요청 파라미터 형식이 올바르지 않습니다.",
                "detail": [
                    {"field": ".".join(str(p) for p in e["loc"]), "message": e["msg"]}
                    for e in exc.errors()
                ],
                "path": request.url.path,
                "timestamp": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            },
        )

    return app


app = create_app()
