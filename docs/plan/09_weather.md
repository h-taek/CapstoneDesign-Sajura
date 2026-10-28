# 09 날씨 — 매장 위치 + n8n 날씨 수집

> 범위 결정은 spec에 있다 — 날씨 출처·매장 위치·실패 처리 `01_basic_design.md` §3.11.1, 위치 칸 `02_implementation_design.md` §4.3.3, 예측 요청 `weather` §3.8, 출처 표 `05_ai.md` §4.2. 실측 `research/backend/18_weather_location_probe.md`.
> AI Server는 바꾸지 않는다. `weather`를 이미 선택 입력으로 받는다.

## 1. ASOS 관측소 목록 — 완료

`Back/app/data/asos_stations.json` — 운영 중인 ASOS 97곳(지점번호·이름·위도·경도). 받은 방법은 `research/backend/18_weather_location_probe.md` §2. 관측소가 바뀌면 같은 방법으로 다시 받는다.

## 2. BE — 완료

1. 마이그레이션 `0015_store_location` — `stores`에 `latitude`·`longitude`(DECIMAL(9,6))·`kma_nx`·`kma_ny`·`asos_stn_id`(SMALLINT), 모두 NULL.
2. `app/integrations/geocoding.py` — `geocode(address) -> (lat, lng) | None`. Google Geocoding(`language=ko`, `region=kr`), `status != OK`·HTTP 오류·`GOOGLE_MAPS_API_KEY` 비어 있음이면 None(경고 로그). 설정에 `GOOGLE_MAPS_API_KEY` 추가.
3. `app/core/weather_location.py` — `kma_grid(lat, lng) -> (nx, ny)`(기상청 격자 변환식, 조치원 36.6014·127.2985 → 66·106), `nearest_asos(lat, lng) -> stn_id`(관측소 목록에서 대권 거리 최소).
4. `StoreService.update_store` — 주소가 바뀌면 좌표 변환 → 다섯 칸을 채우거나 모두 NULL. 빈 주소면 NULL. 좌표 변환 실패가 주소 저장을 막지 않는다.
5. 기존 매장 채우기 — `app/scripts/backfill_store_location.py`(주소가 있고 `latitude`가 NULL인 매장). 실행 `docker compose exec be python -m app.scripts.backfill_store_location`.

검증: `store_location_test.py`(주소 저장 → 위치 칸 채움, 변환 실패·빈 주소 → NULL·저장 성공, 주소 그대로면 재호출 없음 — geocoding은 monkeypatch, 다른 테스트도 conftest가 실호출을 막는다), 격자·최근접 관측소 단위 테스트, `0015` 왕복, BE 전체 pytest.

## 3. n8n

1. 작업 기록 뒤 '매장 위치' 조회 — `kma_nx`·`kma_ny`·`asos_stn_id`. `n8n_user`는 `stores` 테이블 전체 SELECT 권한이 있어 권한 추가는 없다.
2. '날씨' Code 노드(메뉴별 판매 다음, AI 입력 앞) — 위치가 없으면 빈 배열.
   - 과거: ASOS 일자료 `startDt` = 판매 이력 첫날, `endDt` = min(어제, 마지막 대상일). 999행씩 페이지를 넘긴다. `minTa`·`maxTa`가 빈 날은 뺀다. `sumRn` 빈 글자 = 0.
   - 예보: 오늘 이후 대상일이 있으면 단기예보 최신 발표(02·05·…·23시, 발표 후 10분 지난 것). 날짜별 TMN·TMX, 강수량 = PCP 시간값 합(`강수없음` 0, `1mm 미만` 0.5, `a~bmm`은 a, `50.0mm 이상`은 50).
   - 호출마다 3회 재시도. 그래도 실패하면 그쪽 날짜를 비우고 진행한다(작업 실패로 만들지 않는다).
3. 'AI 입력' — `weather` = 날씨 노드 결과.
4. compose n8n 환경값 `KMA_SERVICE_KEY`(추가됨). `forecast.json`은 n8n 화면에서 고쳐 내보낸다.

검증: 조치원 주소 매장으로 웹훅 실행 → AI 요청 `weather`가 판매 이력 기간 + 대상일을 덮는지(n8n 실행 기록), `forecast_results` 저장·`DONE`. 위치 없는 매장은 날씨 없이 `DONE`. 서비스키를 틀리게 넣어도 `DONE`.
