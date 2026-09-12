# AI Server image — Phase 7 서빙 (LightGBM V1-t stateless).
# Build context: repo root (compose: context=.)

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# lightgbm의 컴파일된 바이너리가 OpenMP 런타임(libgomp)을 요구 — slim 이미지엔 기본 미포함.
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv==0.5.11

COPY AI/pyproject.toml ./
RUN uv pip install --system --no-cache .

COPY AI/app ./app
COPY AI/data/manual ./data/manual

EXPOSE 8001

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
