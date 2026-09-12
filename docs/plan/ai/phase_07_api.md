# Phase 7 AI Server API — AI

> 상위: [../04_gantt.md](../04_gantt.md) §2 Phase 7 / §4 `ai_api`
> Day: 25~30 (선행: `ai_model` 종료)

## 마일스톤

| ID | 마일스톤 | 산출물 | 검증 |
|---|---|---|---|
| M7.A1 | AI Server REST API 골격 | `AI/app/api/forecast.py`·`recommend.py`·`xai.py` + FastAPI 라우터 등록 | OpenAPI(`/openapi.json`) 노출 |
| M7.A2 | `/ai/forecast/predict` endpoint | `11_ai_spec.md` §3 초기 모델로 단건/배치 예측. 입력/출력 스키마는 `07_api_spec.md` §forecast 정합 | 200 응답 + 응답 스키마 BE openapi-typescript 생성 통과 |
| M7.A3 | `/ai/orders/recommend` endpoint | 예측 판매량 + 현재 재고 + 레시피 + 리드타임 기반 추천 발주량 산출 | 200 응답 + recommendation 표 출력 |
| M7.A4 | `/ai/xai/{forecast_id}` endpoint | TreeSHAP 결과 (top-3 기여 피처·자연어 변환). `11_ai_spec.md` §9 출력 형태 사용 | 200 응답 + SHAP 결과 직렬화 |
| M7.A5 | `/ai/forecast/train` endpoint | 주간 재학습 트리거 (비동기 작업) — `pipeline_jobs` 테이블 status 갱신 | 호출 시 job_id 즉시 반환, 백그라운드 학습 |
| M7.A6 | `/ai/health` endpoint | 모델 로드 상태·DB 연결·외부 데이터 fresh check | `GET /ai/health` 200 + 컴포넌트별 상태 |
| M7.A7 | Backend AIServerClient 협의 | `Back/app/clients/ai_server.py` 인터페이스 정합 (BE 측 작업이지만 본 Phase에서 spec 합의) | 07_api_spec.md §forecast 양 트랙 정합 |

## 외부 의존

- M6 (AI 모델 개발) 완료 — 선정된 모델 + XAI 모듈
- M2.A3 (AI Server Docker) 완료

## Phase 통합 종료 조건 (M7)

AI Server `/ai/health` 200 + `/ai/forecast/predict` 정상 응답 + BE AIServerClient 호출 통과
