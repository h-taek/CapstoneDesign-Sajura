# Backend image — 09_service_design.md §11.1 (be 컨테이너, Gunicorn + uvicorn.workers)
# Build context: repo root (compose: context=.)
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# uv (09_service_design.md §1 dev tools) — used here only to resolve+install deps from pyproject.
RUN pip install --no-cache-dir uv==0.5.11

COPY Back/pyproject.toml ./
# Dev image: runtime deps + [dev] extras (pytest, ruff, mypy 등) — auth_test 실행용.
# 운영 단계에서는 multi-stage로 dev extras 제외 예정 (Phase 13 release hardening).
RUN uv pip install --system --no-cache ".[dev]"

COPY Back/app ./app
COPY Back/alembic ./alembic
COPY Back/alembic.ini ./alembic.ini
COPY Back/tests ./tests

EXPOSE 8000

# Default = production Gunicorn (09_service_design.md §1 표).
# Compose `be` 서비스는 dev에서 `uvicorn --reload` 로 override.
CMD ["gunicorn", "app.main:app", \
     "-k", "uvicorn.workers.UvicornWorker", \
     "-w", "4", \
     "-b", "0.0.0.0:8000", \
     "--timeout", "60", \
     "--graceful-timeout", "30", \
     "--keep-alive", "5", \
     "--max-requests", "1000", \
     "--max-requests-jitter", "50", \
     "--preload"]
