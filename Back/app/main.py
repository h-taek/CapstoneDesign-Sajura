"""FastAPI application entry — Phase 2 BE bootstrap.

Spec refs:
  - docs/spec/09_service_design.md §10 미들웨어 등록 순서
  - docs/plan/be/phase_02_infra.md M2.B2
"""
from __future__ import annotations

import sentry_sdk
from asgi_correlation_id import CorrelationIdMiddleware
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import ORJSONResponse
from sentry_sdk.integrations.asgi import SentryAsgiMiddleware

from app.api.health import router as health_router
from app.config import get_settings
from app.logging_config import configure_logging


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(env=settings.APP_ENV, level=settings.LOG_LEVEL)

    if settings.SENTRY_DSN:
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.SENTRY_ENVIRONMENT,
            traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
            release=settings.SENTRY_RELEASE or None,
            send_default_pii=False,
        )

    app = FastAPI(
        title=settings.APP_NAME,
        default_response_class=ORJSONResponse,
    )

    # 09_service_design.md §10.1 등록 순서 (바깥 → 안쪽)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=settings.trusted_hosts_list,
    )
    app.add_middleware(CorrelationIdMiddleware)
    if settings.SENTRY_DSN:
        app.add_middleware(SentryAsgiMiddleware)

    app.include_router(health_router)
    return app


app = create_app()
