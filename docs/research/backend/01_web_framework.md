# 웹 프레임워크

> **카테고리**: BE HTTP 요청을 수신·라우팅하는 웹 프레임워크 후보 조사
> **연결 spec**: `docs/spec/03_be.md` §1

---


## 1. 전체 후보 목록

비동기(ASGI) 10개 + 듀얼(ASGI+WSGI) 2개 = **총 12개**. 동기(WSGI) 단독 프레임워크(Flask·Django 등)는 목록에 넣지 않았다.

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

> 기능 9개로 채점한다.
> **O**: 1급(네이티브) / **△**: 외부 라이브러리·플러그인·수동 결합 / **X**: 미지원(직접 구현)

### 2.1 채점 표

| # | 후보 | async | Pydantic v2 | OpenAPI 자동 | DI | multipart | BackgroundTasks | HttpOnly Cookie | 응답 스트리밍 | WebSocket |
|---|------|:-----:|:-----------:|:-----------:|:---:|:--------:|:---------------:|:---------------:|:------------:|:--------:|
| 1 | FastAPI | O | O | O | O(`Depends`) | O | O | O | O | O |
| 2 | Starlette | O | X | X | X | O | O(BackgroundTask) | O | O | O |
| 3 | Sanic | O | △(Sanic-Ext) | △(Sanic-Ext) | △(Sanic-Ext) | O | △(ctx task) | O | O | O |
| 4 | Litestar | O | O(+MsgSpec·attrs) | O | O(컨테이너·Provide) | O | O | O | O | O(Channels) |
| 5 | BlackSheep | O | O | O | O(rodi) | O | △(asyncio.create_task) | O | O | O |
| 6 | Quart | O | △(quart-schema) | △(quart-schema) | X(Flask 패턴) | O | △(create_task) | O | O | O |
| 7 | Robyn | O | △ | △ | X | △ | △ | O | △ | O |
| 8 | Emmett | O | X(자체 validators) | X | △(자체 DI) | O | △ | O | O | O |
| 9 | Esmerald | O | O | O | O(Litestar 기반) | O | O | O | O | O |
| 10 | aiohttp | O(자체) | X | X | X | O(1급) | △(on_startup·create_task) | O | O(1급) | O(1급) |
| 11 | Falcon | O(4.x ASGI) | X | X | X | O(falcon-multipart) | X | O | O | O(4.x) |
| 12 | Tornado | △(자체 async) | X | X | X | O | △(IOLoop) | O | O | O(1급) |

### 2.2 후보별 차이

- Starlette — Pydantic·OpenAPI·DI를 내장하지 않는다. FastAPI가 Starlette 위에 만들어졌다.
- Sanic — Pydantic·OpenAPI·DI를 Sanic-Ext 플러그인으로 지원한다.
- Quart — DI가 없고 Flask의 `current_app`·`g` 패턴을 쓴다. Pydantic·OpenAPI는 quart-schema로 지원한다.
- Robyn — DI가 없고 multipart·응답 스트리밍 지원이 부분적이다. 신생이라 운영 사례가 적다.
- Emmett — Pydantic·OpenAPI를 지원하지 않고 자체 validators를 쓴다.
- aiohttp — Pydantic·OpenAPI·DI를 지원하지 않는다. 추상화가 적어 서비스 단위 보일러플레이트가 많다.
- Falcon — Pydantic·OpenAPI·DI·BackgroundTasks를 지원하지 않는다.
- Tornado — Pydantic·OpenAPI·DI를 지원하지 않는다. asyncio 호환에 일부 차이가 있다.

---

## 3. 2차 벤치마크 — 성능 (공개 자료 기반)

> FastAPI / Litestar / BlackSheep / Esmerald 4개 후보 대상. 공개 벤치마크 자료로 상대 처리량을 비교한다. 직접 실측은 하지 않았다.

### 3.1 평가 지표 (공개 자료 기반)

- RPS (단순 JSON GET·POST) — TechEmpower 측정
- JSON 직렬화 RPS — TechEmpower 측정
- Single Query RPS — TechEmpower 측정
- 응답 시간 p50/p95/p99 — 공식 자료 보조 참조

> 메모리·콜드 스타트는 비교하지 않았다.

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

> 위 수치는 R22 시점 참고치이며 라운드·하드웨어·구성에 따라 변동한다.

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
| FastAPI | 1.0 (기준) | Pydantic v2 도입으로 검증 속도 향상 |

---

## 4. 후보 세부 정보

> §3 비교 대상 4개 후보의 장점·단점·세부사항. 나머지 8개는 §2.2 참조.

### 4.1 FastAPI
- **장점**:
  - Pydantic v2 통합으로 타입 힌트 → 자동 검증·직렬화·OpenAPI 스키마 일체화
  - async/await 1급 시민, `Depends` 기반 의존성 주입 표준
  - Swagger UI(`/docs`)·ReDoc(`/redoc`) 무설정 제공
  - WebSocket·BackgroundTasks·StaticFiles·CORSMiddleware 내장
  - 활발한 커뮤니티·튜토리얼·예제 풍부(한국어 자료 포함)
- **단점**:
  - 풀스택 기능(ORM·Auth·Admin) 없음 → 직접 조립 필요
  - 복잡 트랜잭션·다중 DB·복잡 권한에 대한 공식 가이드 부족
  - 의존성 트리 무거움(Starlette + Pydantic + Starlette 계열 미들웨어)
  - 큰 코드베이스에서는 라우터·Service 계층 분리 패턴이 팀별로 갈림
- **세부사항**: 라이선스 MIT. 저자 Sebastián Ramírez(tiangolo). Python 3.8+. Starlette + Pydantic v2 의존. PyPI 다운로드 기준 Python 웹 프레임워크 상위권. tiangolo 본인은 OpenAI·Cloudflare에서 후원 받음.

### 4.2 Litestar
- **사용처**: FastAPI 대안의 ASGI 풀스택 프레임워크.
- **장점**:
  - DTO(transfer object)·DI·Repository·Channels(WebSocket)·OpenAPI 내장
  - Pydantic·MsgSpec·Attrs·dataclasses 모두 지원
  - Plugin 시스템(SQLAlchemy·Piccolo·Tortoise)
  - 구조화된 계층(Controller·Service·Repository) 권장 패턴 명확
- **단점**:
  - FastAPI 대비 채택률 낮음
  - 생태계 작음(자료·예제 적음)
- **세부사항**: 라이선스 MIT. 구 Starlite에서 분기·리브랜드. 2024년 v2 안정화. Litestar Org 운영.

### 4.3 BlackSheep
- **사용처**: 고성능 ASGI 프레임워크. FastAPI 대안.
- **장점**:
  - Cython으로 라우팅 가속 → FastAPI보다 빠른 처리량
  - OpenAPI v3 자동 문서화, DI 컨테이너 내장
  - .NET 친화 API 스타일(컨트롤러·미들웨어)
- **단점**:
  - 자료·채택 매우 작음
  - 한국어 자료 거의 없음
- **세부사항**: 라이선스 MIT. Robert Esposito(Microsoft 엔지니어) 제작.

### 4.4 Esmerald
- **사용처**: Litestar 기반 풀스택 ASGI 프레임워크.
- **장점**:
  - Litestar 위에 백오피스·DI·ORM·세션·permission·국제화 통합
  - 마이크로~풀스택 모드 선택 가능
- **단점**:
  - 매우 신생
  - Litestar 의존
- **세부사항**: 라이선스 MIT. Dymmond/Tarsil 운영.

---
