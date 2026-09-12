# Phase 2 인프라 부트스트랩 — BE

> 상위: [../plan_gantt.md](../plan_gantt.md) §2 Phase 2 / §4 `inf`
> Day: 7~12 (선행: `plan`)

## 마일스톤

| ID | 마일스톤 | 산출물 | 검증 |
|---|---|---|---|
| M2.B1 | Docker Compose 6 서비스 stack 기동 | `docker-compose.yml` (be·arq-worker·mysql·redis·n8n·caddy) | `docker compose up` → 6 컨테이너 healthy |
| M2.B2 | FastAPI 베이스 프로젝트 셋업 | `pyproject.toml` (uv) + `app/main.py` + structlog·asgi-correlation-id·sentry-sdk 미들웨어 | `GET /health` 200 |
| M2.B3 | Alembic 초기 마이그레이션 | `alembic/versions/0001_init.py` ([08_schema.md](../../spec/08_schema.md) 전체 테이블) | `alembic upgrade head` 무오류 |
| M2.B4 | pydantic-settings + .env 셋업 | `app/config.py` + `.env.example` (DB·Redis·OAuth·VAPID·Sentry) | 환경별 설정 분리 |

## 외부 의존

- 후속 트랙(Phase 3 BE, Phase 6 AI)이 본 Phase 종료 후 시작

## Phase 통합 종료 조건 (M2)

BE·FE 양쪽 모두 컨테이너 기동 + 헬스체크 통과
