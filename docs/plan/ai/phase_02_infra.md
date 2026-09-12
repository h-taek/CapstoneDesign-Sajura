# Phase 2 인프라 부트스트랩 — AI

> 상위: [../04_gantt.md](../04_gantt.md) §2 Phase 2 / §4 `inf` (AI 측)
> Day: 7~12 (선행: `plan`)

## 마일스톤

| ID | 마일스톤 | 산출물 | 검증 |
|---|---|---|---|
| M2.A1 | AI Server FastAPI 베이스 셋업 | `AI/pyproject.toml` (uv) + `AI/app/main.py` + `/health` endpoint | `GET /ai/health` 200 |
| M2.A2 | ML 라이브러리 의존성 셋업 | pandas + numpy + scikit-learn + LightGBM + (선택) Pytorch — 후보 비교는 Phase 6에서. 본 단계는 환경 설치만 | `import` 무오류, 컨테이너 빌드 통과 |
| M2.A3 | AI Server Docker 컨테이너화 | `docker/ai/Dockerfile` + `docker-compose.yml`에 `ai` 서비스 추가 | `docker compose up ai` healthy |
| M2.A4 | 외부 데이터 수집용 자격증명 환경변수 | `.env.example`에 `WEATHER_API_KEY`·`SEDAMTER_API_KEY`·`HONGIK_CALENDAR_URL` 등 자리 마련 | env 누락 시 명확한 에러 |

## 외부 의존

- BE Phase 2 (`inf` 트랙) — docker-compose 베이스 파일 + 공용 네트워크
- 후속 트랙(Phase 6 AI 모델)이 본 Phase 종료 후 시작

## Phase 통합 종료 조건 (M2)

3트랙(BE·FE·AI) 모두 컨테이너 기동 + 헬스체크 통과
