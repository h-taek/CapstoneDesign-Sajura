# 웹 프레임워크

> **카테고리**: BE HTTP 요청을 수신·라우팅하는 웹 프레임워크 후보 조사
> **연결 spec**: `docs/spec/09_service_design.md` §1 (FastAPI 확정)

---


## 1. 전체 후보 목록

비동기(ASGI) 10개 + 듀얼(ASGI+WSGI) 2개 = **총 12개**. 동기(WSGI) 단독 프레임워크(Flask·Django 등)는 사주라 BE의 async I/O 흐름(SQLAlchemy async·httpx·Playwright·Redis 모두 async)과 정합하지 않아 후보에서 제외한다.

| # | 후보 | 분류 | 프로토콜 |
|---|------|------|---------|
| 1 | FastAPI | 비동기 | ASGI |
| 2 | Starlette | 비동기(간접) | ASGI |
| 3 | Sanic | 비동기 | ASGI(호환) |
| 4 | Litestar | 비동기 | ASGI |
| 5 | BlackSheep | 비동기 | ASGI |
| 6 | Quart | 비동기 | ASGI |
| 7 | Robyn | 비동기 | ASGI |
| 8 | Emmett | 비동기 | ASGI |
| 9 | Esmerald | 비동기 | ASGI |
| 10 | aiohttp | 비동기 | 자체 async |
| 11 | Falcon | 듀얼 | WSGI+ASGI |
| 12 | Tornado | 듀얼 | 자체 async |

---

## 2. 1차 벤치마크 — 기능 매칭 (체크리스트)

> 사주라 spec 충족 필수 기능 9개로 채점한다.
> **O**: 1급(네이티브) / **△**: 외부 라이브러리·플러그인·수동 결합 / **X**: 미지원(직접 구현)

### 2.1 채점 표

| # | 후보 | async | Pydantic v2 | OpenAPI 자동 | DI | multipart | BackgroundTasks | HttpOnly Cookie | 응답 스트리밍 | WebSocket | 결과 |
|---|------|:-----:|:-----------:|:-----------:|:---:|:--------:|:---------------:|:---------------:|:------------:|:--------:|:----|
| 1 | FastAPI | O | O | O | O(`Depends`) | O | O | O | O | O | ✅ **통과** |
| 2 | Starlette | O | X | X | X | O | O(BackgroundTask) | O | O | O | ⛔ |
| 3 | Sanic | O | △(Sanic-Ext) | △(Sanic-Ext) | △(Sanic-Ext) | O | △(ctx task) | O | O | O | ⛔ |
| 4 | Litestar | O | O(+MsgSpec·attrs) | O | O(컨테이너·Provide) | O | O | O | O | O(Channels) | ✅ **통과** |
| 5 | BlackSheep | O | O | O | O(rodi) | O | △(asyncio.create_task) | O | O | O | ✅ **통과** |
| 6 | Quart | O | △(quart-schema) | △(quart-schema) | X(Flask 패턴) | O | △(create_task) | O | O | O | ⛔ |
| 7 | Robyn | O | △ | △ | X | △ | △ | O | △ | O | ⛔ |
| 8 | Emmett | O | X(자체 validators) | X | △(자체 DI) | O | △ | O | O | O | ⛔ |
| 9 | Esmerald | O | O | O | O(Litestar 기반) | O | O | O | O | O | ✅ **통과** |
| 10 | aiohttp | O(자체) | X | X | X | O(1급) | △(on_startup·create_task) | O | O(1급) | O(1급) | ⛔ |
| 11 | Falcon | O(4.x ASGI) | X | X | X | O(falcon-multipart) | X | O | O | O(4.x) | ⛔ |
| 12 | Tornado | △(자체 async) | X | X | X | O | △(IOLoop) | O | O | O(1급) | ⛔ |

### 2.2 판정 기준

| 기능 | 필수도 | 근거 |
|------|-------|------|
| async/await | **필수** | 09_service_design.md 1장 — SQLAlchemy async·httpx·Playwright·Redis 모두 async |
| Pydantic v2 | **필수** | 07_api_spec.md 전체 Request/Response 구조가 Pydantic DTO 전제 |
| OpenAPI 자동 | **필수** | 07_api_spec.md 섹션 10 인터페이스 표준 — Swagger 자동 문서화 |
| DI | **필수** | 09_service_design.md 2~3장 Controller/Service/Model 계층 분리 |
| multipart | **필수** | `POST /api/sales/upload` CSV 업로드 |
| BackgroundTasks | 중요 | 단가 갱신·이메일·자동화 트리거 |
| HttpOnly Cookie | **필수** | Refresh Token 30일 HttpOnly Cookie (12_security.md 2.3) |
| 응답 스트리밍 | 중요 | `GET /api/data/export` CSV 다운로드(2단계) |
| WebSocket | 참고 | 현재 spec 미사용, 향후 인앱 알림 옵션 |

**판정 룰**: 필수 항목 X 1개 이상 → 탈락. △는 보완 코드량 감점.

### 2.3 탈락 항목 사유 (8개)

- **#2 Starlette** — Pydantic·OpenAPI·DI 모두 X. FastAPI·Litestar의 토대로만 의미 있음.
- **#3 Sanic** — Pydantic·OpenAPI·DI 모두 △(Sanic-Ext 플러그인 필요). 결합 코드량 증가로 FastAPI 대비 매력 떨어짐.
- **#6 Quart** — DI 부재(Flask current_app·g 패턴), Pydantic·OpenAPI도 △.
- **#7 Robyn** — DI X, multipart △, 응답 스트리밍 △. 신생·운영 검증 부족.
- **#8 Emmett** — Pydantic·OpenAPI 모두 X(자체 validators 사용).
- **#10 aiohttp** — Pydantic·OpenAPI·DI 모두 X. 추상 부족으로 서비스 단위 보일러플레이트 큼.
- **#11 Falcon** — Pydantic·OpenAPI·DI·BackgroundTasks 모두 X.
- **#12 Tornado** — Pydantic·OpenAPI·DI 모두 X. asyncio 호환 일부 차이.

### 2.4 통과 후보 (4개)

| # | 후보 | 핵심 강점 |
|---|------|---------|
| 1 | FastAPI | 모든 9개 필수 항목 1급 네이티브. Pydantic v2 일체화·생태계 최강 |
| 4 | Litestar | DTO·Repository·Channels 내장 → 09_service_design.md 3계층 매핑 가장 매끄러움 |
| 5 | BlackSheep | Cython 라우터 가속. Pydantic·OpenAPI·DI 1급 |
| 9 | Esmerald | Litestar 기반 풀스택. permission·국제화 통합 |

---

## 3. 2차 벤치마크 — 성능 (공개 자료 기반)

> 1차 통과 4개 후보(FastAPI / Litestar / BlackSheep / Esmerald) 대상. **공개 벤치마크 자료**로 상대 처리량을 평가한다. 직접 실측은 본 research 단계의 범위가 아니며 — 본 §3.3에서 4개 모두 사주라 SLA(`13_performance.md` §1.1)를 여유 있게 충족하는 것이 자료만으로 결론지어지기 때문이다. 운영 후 실측 검증은 [구현 후 부하 테스트] 항목으로 별도 관리된다.

### 3.1 평가 지표 (공개 자료 기반)

- RPS (단순 JSON GET·POST) — TechEmpower 측정
- JSON 직렬화 RPS — TechEmpower 측정
- Single Query RPS — TechEmpower 측정
- 응답 시간 p50/p95/p99 — 공식 자료 보조 참조

> 메모리·콜드 스타트 등 인프라 측정은 사주라 4개 후보 모두 처리량 단독으로 SLA 통과하므로 결정 영향 없음 → 비교 항목에서 제외.

### 3.2 공개 벤치마크 자료 수집

#### 3.2.1 TechEmpower Web Framework Benchmarks Round 22

가장 권위 있는 웹 프레임워크 벤치마크. **Plaintext / JSON Serialization / Single Query / Multiple Queries / Fortunes / Data Updates** 6개 시나리오에서 동일 하드웨어 클러스터(Citrine) 기준 측정.

> **출처**: https://www.techempower.com/benchmarks (Round 22 Composite Scores)
> **환경**: Linux, Python 3.11~3.12, Uvicorn·Granian·기타 ASGI 서버 조합

| 후보 | Plaintext (req/s) | JSON Serialization (req/s) | Single Query (req/s) | 비고 |
|------|------------------|---------------------------|---------------------|------|
| FastAPI + Uvicorn | ≈ 70,000 | ≈ 80,000 | ≈ 35,000 | 기준선 |
| Litestar + Uvicorn | ≈ 110,000 | ≈ 130,000 | ≈ 50,000 | FastAPI 대비 1.4~1.6x |
| BlackSheep + Uvicorn | ≈ 150,000 | ≈ 170,000 | ≈ 60,000 | FastAPI 대비 2.0~2.2x. Granian 결합 시 더 빠름 |
| Esmerald + Uvicorn | — | — | — | TechEmpower 미등록 |

> 위 수치는 R22 시점 참고치이며 라운드·하드웨어·구성에 따라 변동한다. 본 결정에서는 절대 수치가 아닌 4개 후보 간 상대 처리량 차이가 결정에 사용되며, §3.3에서 4개 모두 SLA 여유 안에 있어 절대값 정확성은 결정에 영향 없다.

#### 3.2.2 각 프레임워크 공식 벤치 / 블로그

| 후보 | 자료 | 주장·결과 요약 |
|------|------|--------------|
| FastAPI | 공식 사이트 (fastapi.tiangolo.com) | "NodeJS·Go에 견줄 수 있는 성능". Pydantic v2(2023) 도입으로 검증 속도 5~50배 향상 |
| Litestar | 공식 사이트 (litestar.dev) Performance 페이지 | FastAPI 대비 동등 또는 약간 우위. **MsgSpec** 사용 시 격차 추가 확대 |
| BlackSheep | GitHub repo Wiki Benchmarks | FastAPI 대비 2~3x. Cython 라우터 + 자체 응답 캐싱 |
| Esmerald | 공식 자료 매우 부족 | Litestar 기반이라 Litestar 수준 추정만 가능 |

#### 3.2.3 종합 상대 처리량 (FastAPI = 1.0)

| 후보 | 상대 처리량 | 근거 |
|------|----------|------|
| BlackSheep | **2.0 ~ 2.5x** | TechEmpower R22 + 공식 Wiki |
| Litestar | **1.3 ~ 1.7x** | TechEmpower R22 + 공식 Performance |
| Esmerald | 1.0 ~ 1.5x (추정) | Litestar 기반, 직접 측정 자료 없음 |
| FastAPI | 1.0 (기준) | Pydantic v2 도입 후 충분히 빠름 |

### 3.3 사주라 SLA 충족 평가

| SLA 항목 | 목표 (13_performance.md 1.1) | 4개 후보 평가 |
|----------|--------------------------|--------------|
| 일반 API 응답 | ≤ 200ms | **모두 충족 가능** — 처리량이 수만 RPS이므로 200ms 초과 가능성 거의 없음 |
| 캐시 hit 응답 | ≤ 300ms | 모두 충족 가능 |
| 동시 사용자 (MVP 20 → 2단계 100 → 3단계 300) | — | 4개 모두 처리 여유 충분 |

→ **순수 처리량만으로는 4개 모두 사주라 SLA를 여유 있게 충족.** 처리량 단독으로 탈락 결정 어려움 → 자료 신뢰도·생태계·Pydantic v2 일체화·학습 곡선을 보조 기준으로 사용.

### 3.4 탈락 항목 사유 (1개)

- **#9 Esmerald** ⛔
  - TechEmpower 미등록·공식 벤치 자료 부족 → 성능 추정만 가능, 검증 불가
  - Litestar 기반이라 별도 후보로 둘 필요 약함
  - Litestar 대비 추가 가치(국제화·permission·백오피스)가 사주라 MVP에 불필요
  - **결론**: Litestar로 대체 가능, 후보에서 제거

### 3.5 통과 후보 (3개)

| # | 후보 | 상대 처리량 | 핵심 강점 |
|---|------|----------|---------|
| 1 | FastAPI | 1.0 (기준) | 생태계 최강·Pydantic v2 일체화 |
| 4 | Litestar | 1.3~1.7x | DTO·Repository·Channels 내장 |
| 5 | BlackSheep | 2.0~2.5x | Cython 라우터로 최고 처리량 |

---

## 4. 최종 선발

**FastAPI** ✅ 확정.

| 결정 사유 | 내용 |
|----------|------|
| 성능 충족 | 사주라 SLA(`13_performance.md` §1.1 일반 200 ms·캐시 hit 300 ms)를 여유 있게 충족 (§3.3 평가) |
| Pydantic v2 일체화 | 타입 힌트 → 자동 검증·직렬화·OpenAPI 스키마 단일 생성. `07_api_spec.md` DTO 구조와 일치 |
| 생태계 | Python 웹 프레임워크 PyPI 다운로드·GitHub stars 1위. 한국어 자료 풍부 → 1인 운영 디버깅 자료 확보 |
| 학습 곡선 | BE 팀(2명) 온보딩 비용 최소 |
| 처리량 이점 무력화 | BlackSheep 2.0~2.5x·Litestar 1.3~1.7x의 처리량 우위가 SLA 여유 안에서 사용자 체감되지 않음 → 의사결정 가치 미미 |
| Esmerald 대비 | Litestar 기반이라 별도 후보로 둘 필요 약함 (`§3.4` 탈락 사유 참조) |

> 본 결정은 spec(`09_service_design.md` §1)에 반영된다. PROGRESS.md §3 결정 이력 갱신 필요.

---

## 5. 통과 후보 세부 정보

> 1차 통과 4개 후보의 사용처·장점·단점·세부사항. 탈락 8개는 §2.3 사유로 대체.

### 5.1 FastAPI ✅
- **사용처**: 모든 점주 API·AI Server 연동 API의 라우팅·요청 검증·응답 직렬화·OpenAPI 자동 문서화. 09_service_design.md 섹션 1 확정.
- **장점**:
  - Pydantic v2 통합으로 타입 힌트 → 자동 검증·직렬화·OpenAPI 스키마 일체화
  - async/await 1급 시민, `Depends` 기반 의존성 주입 표준
  - Swagger UI(`/docs`)·ReDoc(`/redoc`) 무설정 제공
  - WebSocket·BackgroundTasks·StaticFiles·CORSMiddleware 내장
  - 활발한 커뮤니티·튜토리얼·예제 풍부
- **단점**:
  - 풀스택 기능(ORM·Auth·Admin) 없음 → 직접 조립 필요
  - 복잡 트랜잭션·다중 DB·복잡 권한에 대한 공식 가이드 부족
  - 의존성 트리 무거움(Starlette + Pydantic + Starlette 계열 미들웨어)
  - 큰 코드베이스에서는 라우터·Service 계층 분리 패턴이 팀별로 갈림
- **세부사항**: 라이선스 MIT. 저자 Sebastián Ramírez(tiangolo). Python 3.8+. Starlette + Pydantic v2 의존. PyPI 다운로드 기준 Python 웹 프레임워크 상위권. tiangolo 본인은 OpenAI·Cloudflare에서 후원 받음.

### 5.2 Litestar 🔵
- **사용처**: FastAPI 대안의 ASGI 풀스택 프레임워크.
- **장점**:
  - DTO(transfer object)·DI·Repository·Channels(WebSocket)·OpenAPI 내장
  - Pydantic·MsgSpec·Attrs·dataclasses 모두 지원
  - Plugin 시스템(SQLAlchemy·Piccolo·Tortoise)
  - 구조화된 계층(Controller·Service·Repository) 권장 패턴 명확
- **단점**:
  - FastAPI 대비 채택률 낮음 → 1인 운영 디버깅 자료 확보 어려움
  - 생태계 작음(자료·예제 적음)
- **세부사항**: 라이선스 MIT. 구 Starlite에서 분기·리브랜드. 2024년 v2 안정화. Litestar Org 운영.

### 5.3 BlackSheep 🔵
- **사용처**: 고성능 ASGI 프레임워크. FastAPI 대안.
- **장점**:
  - Cython으로 라우팅 가속 → FastAPI보다 빠른 처리량
  - OpenAPI v3 자동 문서화, DI 컨테이너 내장
  - .NET 친화 API 스타일(컨트롤러·미들웨어)
- **단점**:
  - 자료·채택 매우 작음
  - 한국어 자료 거의 없음
- **세부사항**: 라이선스 MIT. Robert Esposito(Microsoft 엔지니어) 제작.

### 5.4 Esmerald 🔵
- **사용처**: Litestar 기반 풀스택 ASGI 프레임워크.
- **장점**:
  - Litestar 위에 백오피스·DI·ORM·세션·permission·국제화 통합
  - 마이크로~풀스택 모드 선택 가능
- **단점**:
  - 매우 신생
  - Litestar 의존
- **세부사항**: 라이선스 MIT. Dymmond/Tarsil 운영.

---

