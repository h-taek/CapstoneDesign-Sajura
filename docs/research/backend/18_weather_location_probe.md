# 날씨·매장 위치 외부 API 실측

2026-10-28 실측. 키는 `.env`의 `KMA_SERVICE_KEY`(공공데이터포털 계정 키 하나)와 `GOOGLE_MAPS_API_KEY`.

## 1. 기상청 단기예보 조회서비스 (data.go.kr 15084084)

- 주소 `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst`. 인증 `serviceKey`에 일반 인증키 Decoding 값을 넣으면 `resultCode 00`.
- 조치원읍 부근(위도 36.6014, 경도 127.2985)을 기상청 격자 변환식으로 바꾸면 `nx 66, ny 106`.
- 2026-10-28 `base_time 0200` 발표 한 번에 944건. 10/28~10/31 날짜별 `TMN`·`TMX`가 하나씩, 11/1은 `PCP`만 있었다.
- `PCP`(1시간 강수량)는 숫자가 아니라 글자로 온다. 관찰한 값은 `강수없음`·`1mm 미만`·`0`.
- 격자 조회라 매장 좌표가 필요하다. 매장 테이블에는 글자 주소만 있다.

## 2. 기상청 ASOS 일자료 조회서비스 (data.go.kr 15059093)

- 주소 `https://apis.data.go.kr/1360000/AsosDalyInfoService/getWthrDataList`. 요청 `dataCd=ASOS`, `dateCd=DAY`, `startDt`·`endDt`(YYYYMMDD, 어제까지), `stnIds`.
- 활용신청 전에는 같은 키로 HTTP 403. 신청 후 바로 `resultCode 00`.
- 서울(108) 10/20~10/26 조회 — 날짜별 `minTa`·`maxTa`가 숫자 글자로 오고, `sumRn`은 비가 안 온 날 빈 글자(`''`), 온 날 `'0.3'` 등.
- 관측소 좌표 목록은 이 서비스에 없다. 공공데이터포털 '기상청_지상기상관측 지점정보 조회서비스'(15139439)는 안내 페이지만 있고 활용신청 버튼이 없다.
- 기상자료개방포털 [데이터 > 메타데이터 > 지점정보 > 관측지점정보](https://data.kma.go.kr/tmeta/stn/selectStnList.do)에서 받았다. 지점 '지상 > 종관기상관측', 지역 전체. CSV 다운로드(`selectStnListDownload.do`)는 로그인 상태에서도 오류 화면을 돌려줬다. 조회 요청(`selectStnList.do`, 로그인 필요)에 `schListCnt=1000`을 주면 화면의 10건 제한 없이 전체 148행(지점번호·시작일·종료일·지점명·주소·위도·경도·해발고도)이 온다.
- 148행 중 종료일이 비어 있는(운영 중) 행이 97개, 지점번호 중복 없음. 97곳 모두 ASOS 일자료 10/20~10/26 7일치 `minTa`·`maxTa`가 빠짐없이 왔다.
- 대권 거리 최근접 — 조치원 세종로 2639는 서청주(181) 9.0km, 청주(131) 13.9km, 세종(239) 15.6km 순. 서울 테헤란로 152는 서울(108) 10.0km.

## 3. n8n에서 호출

- n8n `2.20.7-exp.0` Code 노드(작업 러너)에서 `this.helpers.httpRequest`와 `$env.KMA_SERVICE_KEY`가 CLI 실행·웹훅 실행 모두에서 동작했다.
- 2026-10-28 17시대 실행 — 17시 발표의 10/28 값에는 TMN·TMX가 없어 TMP(저녁 시간대)로만 채워져 최저 5·최고 9였다. 같은 날 02시 발표로 바꾸자 10/28 최저 1·최고 13.
- 조치원 매장(서청주 181, 격자 65·106, 판매 8/29~10/27) — ASOS 60일 + 예보 3일(10/28~10/30) = 63일. 틀린 서비스키는 두 API 모두 HTTP 403.

## 4. 주소 → 좌표 변환

| 서비스 | 결과 |
|---|---|
| 카카오 로컬 주소 검색 (로그인용 REST 키) | HTTP 403 `App(사주라) disabled OPEN_MAP_AND_LOCAL service` — 앱에서 카카오맵 사용 설정이 꺼져 있음 |
| Google Geocoding API (`maps/api/geocode/json`, `language=ko`, `region=kr`) | 아래 표 |

| 입력 | status | 결과 | location_type |
|---|---|---|---|
| 세종특별자치시 조치원읍 세종로 2639 | OK | 36.6214795, 127.2863404 | ROOFTOP |
| 세종 조치원읍 신안리 | OK | 36.622146, 127.2856897 | APPROXIMATE |
| 조치원읍 원리 132-1 | OK | 36.6047731, 127.2956294 | ROOFTOP |
| 서울 강남구 테헤란로 152 | OK | 37.5009393, 127.036584 | ROOFTOP |
| 아무말대잔치 주소 | ZERO_RESULTS | — | — |

- Google 무료 체험판 계정(크레딧 90일)이다. 체험판에서는 Geocoding 일일 할당량(`v3 requests per day`, 기본 무제한)을 낮출 수 없다.
- 가격표 — 월 1만 건까지 무료, 그 위 1천 건당 USD 5.00부터.
