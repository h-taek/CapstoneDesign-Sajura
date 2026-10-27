# 07 예측 배치 — n8n 모델 예측 + BE 추천발주 계산

> 범위 결정은 spec에 있다 — 배치 단계·책임 분리 `01_basic_design.md` §3.11.1, 수동 실행 §3.6.2, 추천 산식 §3.7.2, API `02_implementation_design.md` §3.7·§3.8·§3.9, 시퀀스 §2.3·§2.5, DDL §4.3.14~§4.3.20, n8n 계정 §4.5, AI 산출 구조 `05_ai.md` §2.
> 수정안 저장(`PATCH /api/orders/recommend`)은 spec에서 지웠다. 화면을 나가도 수정값을 남기려면 FE 일괄에서 브라우저 저장소로 처리한다.

## 1. AI Server

1. `POST /ai/forecast/predict` — 입력에 `menu_sales_history`(선택)를 받고, 대상일마다 `menu_forecast`를 낸다. 대상일 메뉴 수량 = 비중 × 그 날 예측 매출 × 수량/매출 계수(`decompose.py` 재사용). 메뉴 이력이 모자라거나 날짜가 겹치지 않으면 빈 배열.
2. `POST /ai/orders/recommend`와 그 스키마를 지운다. `test_recommend.py`의 비중 분해 검증은 predict 테스트로 옮긴다.

검증: AI pytest(호스트 임시 가상환경 — 끝나면 지운다).

## 2. BE

1. 마이그레이션 `0014_forecast_v2` — `forecast_results`를 spec 정의로 다시 만들고 `forecast_menu_items`를 만든다(dev·prod 모두 예측 행 없음). `order_recommendation_items`·`order_approval_logs`의 `adjusted_quantity`를 지운다.
2. 모델 — `ForecastResult`·`ForecastMenuItem`·`PipelineJob`. 추천안 품목·수정 이력 모델과 응답에서 `adjusted_quantity`를 뺀다.
3. `ForecastService`
   - `get_forecast(store_id, target_date)` — 마지막 영업일 기준 D+1~D+3의 저장된 예측과 메뉴별 수량(메뉴 이름 포함). 없으면 404 `FORECAST_NOT_FOUND`.
   - `run(store_id)` — 이 매장의 10분 이내 `RUNNING` 작업이 있으면 429 `PIPELINE_ALREADY_RUNNING`(10분 넘은 `RUNNING`은 멈춘 작업으로 본다). `N8nClient`로 웹훅을 부르고 끝날 때까지 기다린다. 결과가 이력 부족이면 422 `AI_INSUFFICIENT_HISTORY`, 실패·연결 불가면 503 `PIPELINE_AI_SERVER_UNAVAILABLE`, 성공이면 `get_forecast`.
4. `OrderService.recommend` — AI 호출을 지우고 §3.7.2 산식을 BE에서 계산한다(AI Server의 기존 산식·문구를 그대로 옮긴다). 대상일의 저장된 예측이 없으면 404. 입고 예정량·기본값·추천안 저장·응답 형태는 지금과 같다.
5. `PipelineService` — 상태(매장의 최근 `FORECAST` 작업, `train_job`은 null), 이력(페이지), 예측 완료 알림(`FORECAST_DONE` 한 건).
6. API — `GET /api/forecast`·`POST /api/forecast/run`, `GET /api/pipeline/status`·`/history`, `POST /api/pipeline/forecast-done`(`X-Internal-Token` = `INTERNAL_API_TOKEN`, 비어 있으면 항상 401).
7. `app/integrations/ai_client.py`와 BE의 AI 호출 경로를 지운다. `N8nClient`(`app/integrations/n8n.py`) 추가.
8. `Front/openapi.json`·`types.gen.ts` 재생성. 빠진 필드(`adjusted_quantity`)로 FE 빌드가 깨지면 그 부분만 고친다.

검증: `forecast_test.py`(저장 예측 조회·대상일 필터·404·수동 실행 성공/422/503/429, n8n 호출은 respx), `orders_test.py`(저장 예측으로 산식 계산 — 입고 예정·기본값·레시피 없는 재료·예측 없음 404), `pipeline_test.py`(상태·이력·예측 완료 알림·토큰 401), `0014` 왕복, BE 전체 pytest.

## 3. n8n

1. compose — `GENERIC_TIMEZONE`·`TZ`=`Asia/Seoul`, 워크플로우·설정 파일 마운트(`docker/n8n`), 환경값(`AI_SERVER_BASE_URL`·BE 주소·`INTERNAL_API_TOKEN`·`SLACK_WEBHOOK_URL`·n8n DB 계정), 노드에서 환경값 읽기 허용.
2. DB 계정 `n8n_user` — `docker/mysql/init.sh`에 §4.5 권한으로 추가. 이미 만든 dev 볼륨에는 같은 SQL을 한 번 실행하는 스크립트를 둔다.
3. 워크플로우 `docker/n8n/forecast.json` — 트리거 둘(02:00 스케줄 = 전체 매장 `N8N`, 웹훅 `POST /webhook/forecast` = 매장 하나 `USER`, 헤더 토큰 확인) → 매장마다: 작업 시작 기록 → 일별 매출·메뉴별 판매 조회 → 외부 데이터 → 입력 만들기 → AI 예측(3회 재시도) → 예측·메뉴 수량 UPSERT → 작업 완료 → BE 예측 완료 알림. AI 실패는 작업 실패 기록, 이력 부족이 아니면 Slack(주소가 있을 때만). 웹훅은 마지막 노드 결과(`{status, error}`)로 응답한다.
4. 설정 스크립트 `docker/n8n/setup.sh` — MySQL 자격 증명과 워크플로우를 `n8n import`로 넣고 활성화한다.
5. 외부 데이터 — 기상청 단기예보 서비스키가 없으면 날씨 없이 보낸다(AI Server는 날씨를 선택 입력으로 받는다). 키를 받으면 수집 노드를 채운다.

검증: 실서버 흐름 — 판매 30일 테스트 매장에서 웹훅 실행 → `forecast_results` 3행·`forecast_menu_items`·`pipeline_jobs DONE`·`FORECAST_DONE` 알림 → `GET /api/forecast`·`GET /api/orders/recommend`가 저장 예측으로 응답. 이력 9일 매장은 `FAILED`·Slack 없음. 스케줄 트리거 등록(02:00 KST) 확인.
