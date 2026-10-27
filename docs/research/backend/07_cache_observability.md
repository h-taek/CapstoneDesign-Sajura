# 캐시 · 로깅 · 모니터링 · 에러추적

> **카테고리**: 인메모리 스토어·캐시 클라이언트, 구조화 로깅·요청 상관 ID, 메트릭·트레이싱·에러 추적 라이브러리 비교
> **연결 spec**: `docs/spec/03_be.md` §1·§12, `docs/spec/03_be.md` §14.4

---

## 1. 캐시 / 인메모리 스토어 / 클라이언트

### 1.1 전체 후보 목록

인메모리 스토어 4개 + 클라이언트 1개 + 추상화 2개 = **총 7개**.

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | Redis | 인메모리 스토어 | 사실상 표준 |
| 2 | Dragonfly | 인메모리 스토어 | Redis 호환 멀티스레드 |
| 3 | Valkey | 인메모리 스토어 | Redis 7.2 BSD 포크 |
| 4 | KeyDB | 인메모리 스토어 | Redis 멀티스레드 호환 |
| 5 | redis-py (async) | 클라이언트 | 공식 |
| 6 | aiocache | 추상화 | 데코레이터·다중 백엔드 |
| 7 | fastapi-cache2 | 추상화 | endpoint 단위 캐시 |

### 1.2 1차 벤치마크 — 필수 기능

| # | 후보 | Pub/Sub · Sorted Set | 단일 노드 처리량 | persistence(AOF/RDB) | Docker 친화 | 라이선스 안전성 |
|---|------|:------------------:|:-------------:|:------------------:|:----------:|:------------:|
| 1 | Redis | ◎ | ◎(100k+ ops/s) | ◎ | ◎ | △(7.4부터 RSALv2/SSPL — 자체 호스팅 사용은 제한하지 않음) |
| 2 | Dragonfly | △(일부 모듈 미지원) | ◎(멀티스레드) | O | O | O(BSL 1.1) |
| 3 | Valkey | ◎(Redis 7.2 동등) | ◎ | ◎ | O | ◎(BSD 3-clause) |
| 4 | KeyDB | O | O(멀티스레드) | O | △ | O(BSD) |

| # | 후보 | async API | Sentinel·Cluster | 활발한 유지보수 | Service 명시적 키 호출 |
|---|------|:--------:|:---------------:|:-----------:|:------------------:|
| 5 | redis-py (async) | ◎ (4.x 통합) | ◎ | ◎ | ◎ |

| # | 후보 | 명시적 키 운영 | TTL 정밀 제어 |
|---|------|:----------:|:----------:|
| 6 | aiocache | △(데코레이터 우선) | O |
| 7 | fastapi-cache2 | X(endpoint 단위) | O |

### 1.3 후보별 차이

- Dragonfly — 멀티스레드로 처리량이 높으나 일부 Redis 모듈·명령어를 지원하지 않는다. Redis 7은 단일 노드에서 100k+ ops/s를 낸다.
- KeyDB — Snap 인수 이후 활동이 줄어 운영 검증 자료가 줄고 있다.
- aiocache — 데코레이터 기반으로 캐시 키를 자동 생성한다.
- fastapi-cache2 — endpoint 단위로 캐시하며 Service 계층에서 키를 다루지 않는다.

---

## 2. 로깅 · 모니터링 · 에러추적

### 2.1 전체 후보 목록

로깅 3개 + 요청 ID 1개 + 에러 추적 1개 + 메트릭 1개 + 트레이싱 1개 + 대시보드·저장·SaaS 3개 = **총 10개**.

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | structlog | 구조화 로깅 | dict 기반 |
| 2 | loguru | 로깅 | 0-config |
| 3 | python-json-logger | 로깅 | 표준 logging 호환 |
| 4 | asgi-correlation-id | 요청 ID | structlog 결합 표준 |
| 5 | sentry-sdk[fastapi] | 에러·성능 추적 | SDK |
| 6 | Prometheus + prometheus-fastapi-instrumentator | 메트릭 | pull 표준 |
| 7 | OpenTelemetry | 분산 트레이싱 표준 | 벤더 중립 |
| 8 | Grafana | 대시보드 | OSS |
| 9 | Loki | 로그 저장 | 라벨 기반 |
| 10 | Datadog / New Relic / Elastic APM | SaaS 통합 | 매니지드 |

### 2.2 1차 벤치마크 — 필수 기능

**구조화 로깅**

| # | 후보 | JSON 출력 | contextvars 통합 | 표준 logging 결합 | 활발한 유지보수 |
|---|------|:--------:|:--------------:|:--------------:|:-----------:|
| 1 | structlog | ◎ | ◎ | ◎(processor로 표준 logging brridge) | ◎ |
| 2 | loguru | △(별도 sink 설정) | △(record.extra) | △(intercept handler) | ◎ |
| 3 | python-json-logger | ◎ | X(직접 LogRecord에 추가) | ◎ | O |

**요청 상관 ID**

| # | 후보 | ASGI 미들웨어 | structlog 결합 |
|---|------|:-----------:|:------------:|
| 4 | asgi-correlation-id | ◎ | ◎ (contextvars 자동 전파) |

**에러·성능 추적**

| # | 후보 | FastAPI 통합 | 운영 부담 | 비용 |
|---|------|:-----------:|:-------:|:-------:|
| 5 | sentry-sdk[fastapi] | ◎(자동 통합) | 낮음(SaaS Hosted) | 0 (무료 플랜 5k 이벤트/월) |

### 2.3 후보별 차이

- loguru — 설정 없이 쓸 수 있고 가독성이 좋다. 표준 `logging` 통합과 구조화 JSON 필드 자동 부여에는 sink·intercept handler 설정이 따로 필요하다.
- python-json-logger — 표준 logging과 호환된다. contextvars를 자동 부여하지 않아 매 로그에 `extra=`로 값을 넘겨야 한다.
- Grafana·Loki — Prometheus와 함께 쓰는 대시보드·로그 저장소다. Prometheus·Loki·Grafana를 함께 도입하면 컨테이너가 3개 늘어난다.
- Datadog·New Relic·Elastic APM — 매니지드 SaaS로 통합 편의를 주는 대신 비용이 든다.

---

## 3. 후보 세부 정보

### 3.1 Redis
- **장점**: 단일 노드 100k+ ops/s, Pub/Sub·Sorted Set·HLL·Bitmap 등 자료구조 풍부, AOF/RDB persistence, 클러스터·복제 옵션
- **단점**: 7.4부터 RSALv2/SSPL 라이선스
- **세부사항**: 공식 Docker 이미지 `redis:7-alpine`

### 3.2 redis-py (async)
- **장점**: 공식 클라이언트, 4.x부터 async API 통합(`redis.asyncio`), Sentinel·Cluster 지원, 연결 풀 내장
- **단점**: async lifecycle 명시적 관리 필요 (FastAPI lifespan에서 풀 생성/종료)
- **세부사항**: 라이선스 MIT. 구 aioredis는 redis-py에 통합 완료

### 3.3 structlog
- **장점**: dict 기반 로깅, contextvars 통합(`structlog.contextvars.bind_contextvars`), JSON·콘솔 출력 processor pipeline 분리, 표준 logging bridge 가능
- **단점**: 초기 processor 설정 보일러플레이트 존재 (1회성)
- **세부사항**: 라이선스 MIT/Apache 2.0

### 3.4 asgi-correlation-id
- **장점**: ASGI 미들웨어로 `X-Request-ID` 헤더 처리·없으면 UUID 생성, contextvars에 자동 저장, structlog와 결합 시 처리 0
- **단점**: 미들웨어 등록 순서 주의
- **세부사항**: 라이선스 MIT

### 3.5 sentry-sdk[fastapi]
- **장점**: FastAPI 자동 통합(예외·트랜잭션), breadcrumb·user 컨텍스트·release tracking, SDK MIT 라이선스, 무료 플랜 5k 이벤트/월 + 트랜잭션 100k/월
- **단점**: 자체 호스팅(Self-Hosted)은 운영 부담
- **세부사항**: PII scrubbing·`send_default_pii`·`traces_sample_rate` 옵션 제공

### 3.6 Valkey
- **장점**: Linux Foundation 산하, BSD 3-clause, Redis 7.2 동등 기능, 프로토콜 호환으로 마이그레이션 비용 낮음
- **단점**: 신생 — 클라우드 매니지드·자료 축적 진행 중
- **세부사항**: AWS·Google·Oracle 등 후원

### 3.7 Prometheus + instrumentator
- **장점**: 사실상 표준, PromQL 강력, Alertmanager 결합
- **단점**: pull 방식·서비스 디스커버리 필요, 장기 보존 별도(Thanos/Cortex)
- **세부사항**: 라이선스 Apache 2.0. `prometheus-fastapi-instrumentator`로 자동 메트릭 부여

### 3.8 OpenTelemetry
- **장점**: 벤더 중립, FastAPI·SQLAlchemy·httpx·redis 자동 instrumentation, Sentry·Jaeger·Datadog 모두 백엔드 가능
- **단점**: 컬렉터·백엔드 별도 구성 필요
- **세부사항**: 라이선스 Apache 2.0

---

## 4. 비교 요약 표

| 분류 | 후보 | 특징 |
|------|------|------|
| 인메모리 스토어 | Redis | 사실상 표준·자료구조·persistence·7.4부터 RSALv2/SSPL |
| 인메모리 스토어 | Valkey | Redis 7.2 BSD 포크·프로토콜 호환 |
| 인메모리 스토어 | Dragonfly / KeyDB | 일부 모듈 미지원 / 활동 감소 |
| 클라이언트 | redis-py (async) | 공식·async 통합·Cluster |
| 캐시 추상화 | aiocache / fastapi-cache2 | 데코레이터 키 자동 생성 / endpoint 단위 |
| 구조화 로깅 | structlog | dict·contextvars·processor |
| 로깅 | loguru / python-json-logger | 표준 결합 별도 설정 / contextvars 자동 부여 없음 |
| 요청 ID | asgi-correlation-id | ASGI 미들웨어·structlog 결합 |
| 에러·성능 추적 | sentry-sdk[fastapi] | FastAPI 자동 통합·무료 플랜 |
| 메트릭 | Prometheus | pull 방식·PromQL |
| 트레이싱 | OpenTelemetry | 벤더 중립·자동 instrumentation |
| 대시보드 | Grafana | Prometheus와 함께 사용 |
| 로그 저장 | Loki | 라벨 기반 로그 저장 |
| SaaS APM | Datadog / New Relic / Elastic | 매니지드·유료 |
