# 담기 에이전트 서버 이미지 — 03_be.md §2.4·§15.1 (agent 컨테이너, 내부 네트워크만)
# Build context: repo root (compose: context=.)
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN pip install --no-cache-dir uv==0.5.11

COPY Agent/pyproject.toml ./
# Dev image: runtime deps + [dev] extras — 컨테이너에서 pytest 실행용 (BE 이미지와 같은 방식)
RUN uv pip install --system --no-cache ".[dev]"

COPY Agent/app ./app
COPY Agent/tests ./tests

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
