# 캐시 · 로깅 · 모니터링 · 에러추적

> **카테고리**: 인메모리 스토어·캐시 클라이언트, 구조화 로깅·요청 상관 ID, 메트릭·트레이싱·에러 추적 라이브러리 결정
> **연결 spec**: `docs/spec/09_service_design.md` §1·§9, `docs/spec/13_performance.md` §5

---

## 0. 카테고리 구성 & 결정 항목

| 하위 카테고리 | 후보 수 | 결정 항목 수 |
|------------|--------|------------|
| §1 캐시 (인메모리 스토어·클라이언트·패턴) | 7 | 3 (스토어 / 클라이언트 / 캐시 호출 방식) |
| §2 로깅·모니터링·에러추적 | 10 | 5 (로깅·요청 ID·에러 추적·메트릭·트레이싱) |

### 본 research가 결정하는 라이브러리 (spec 반영)

| 라이브러리 | 카테고리 | 결정 근거 위치 | spec 반영 위치 |
|----------|---------|--------------|--------------|
| Redis | 인메모리 스토어 | §1.2 + §1.4 | `09_service_design.md` §1 (기존) + §9 캐시 패턴 (기존) |
| redis-py (async) | Redis 클라이언트 | §1.2 + §1.4 | `09_service_design.md` §1 (신규) |
| structlog | 구조화 로깅 | §2.2 + §2.4 | `09_service_design.md` §1 (신규) |
| asgi-correlation-id | 요청 상관 ID | §2.2 + §2.4 | `09_service_design.md` §1 (신규) |
| sentry-sdk[fastapi] | 에러·성능 추적 | §2.2 + §2.4 | `09_service_design.md` §1 (신규), `13_performance.md` §5 결정 반영 |

### 운영 흐름 (research 결정)

| 영역 | 결정 | 위치 |
|------|------|------|
| 캐시 호출 방식 | Service 계층에서 redis-py로 명시적 키 호출 (aiocache/fastapi-cache2 같은 데코레이터 추상화 미사용) | §1.4 + §3.1 |
| 로그 출력 | stdout에 JSON 1줄/이벤트, Docker 로그 드라이버 수집 | §3.2 |
| 로그 필수 필드 | `request_id`, `user_id`, `store_id`, `level`, `event`, `ts`(UTC ISO) | §3.2 |
| Sentry 환경 분리 | `environment=dev|staging|prod`, `traces_sample_rate=0.1` (운영), PII scrubbing 활성 | §3.3 |

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

| # | 후보 | Pub/Sub · Sorted Set | 단일 노드 처리량 | persistence(AOF/RDB) | Docker 친화 | 라이선스 안전성 | 결과 |
|---|------|:------------------:|:-------------:|:------------------:|:----------:|:------------:|:----|
| 1 | Redis | ◎ | ◎(100k+ ops/s) | ◎ | ◎ | △(7.4 RSALv2/SSPL — 자체 운영엔 무영향) | ✅ **통과 (인메모리 스토어)** |
| 2 | Dragonfly | △(일부 모듈 미지원) | ◎(멀티스레드) | O | O | O(BSL 1.1) | ⛔ |
| 3 | Valkey | ◎(Redis 7.2 동등) | ◎ | ◎ | O | ◎(BSD 3-clause) | 🟡 **보존 (라이선스 트리거)** |
| 4 | KeyDB | O | O(멀티스레드) | O | △ | O(BSD) | ⛔ |

| # | 후보 | async API | Sentinel·Cluster | 활발한 유지보수 | Service 명시적 키 호출 | 결과 |
|---|------|:--------:|:---------------:|:-----------:|:------------------:|:----|
| 5 | redis-py (async) | ◎ (4.x 통합) | ◎ | ◎ | ◎ | ✅ **통과 (클라이언트)** |

| # | 후보 | 명시적 키 운영 | TTL 정밀 제어 | spec §9 캐시 패턴 정합 | 결과 |
|---|------|:----------:|:----------:|:------------------:|:----|
| 6 | aiocache | △(데코레이터 우선) | O | △(키 패턴 자동 생성 vs 명시 패턴 충돌) | ⛔ |
| 7 | fastapi-cache2 | ⛔(endpoint 단위) | O | ⛔(Service 계층 패턴 불일치) | ⛔ |

### 1.3 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| Pub/Sub · Sorted Set 등 자료구조 | 중요 | 향후 알림 큐·차단기 상태 등 확장 |
| persistence(AOF/RDB) | **필수** | Refresh Token 블랙리스트 30일 유지 (`09_service_design.md` §9) |
| async Python 클라이언트 | **필수** | `02_app_server.md` §4.1 I/O bound async 일관성 |
| 명시적 키 패턴 운영 | **필수** | `09_service_design.md` §9 — `forecast:{store_id}:{target_date}` 등 5개 명시 키 |
| 라이선스 안전성 | 중요 | 1인 운영 부담 최소화 |

**탈락 사유:**

- **#2 Dragonfly** — 멀티스레드 처리량 우위가 매력적이나 일부 Redis 모듈·명령어 미지원으로 검증 비용 발생. Redis 7로 단일 노드 100k+ ops/s 확보되며 사주라 RPS 가정(MVP 50매장)에서 멀티스레드 이점 무의미.
- **#4 KeyDB** — Snap 인수 이후 활동 감소로 운영 검증 자료 줄고 있음. Valkey 보존 + Redis 본채택 조합이 더 안전.
- **#6 aiocache** — 데코레이터 기반 키 자동 생성과 spec §9의 명시 키 패턴이 충돌. 추상화 비용 대비 가치 없음.
- **#7 fastapi-cache2** — endpoint 단위 캐시. spec §9는 Service 계층 Cache-Aside·TTL·Write-Through 3가지 패턴을 명시 — 추상 위치 불일치.

### 1.4 최종 선발

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **인메모리 스토어** | **Redis 7.x** ✅ | 단일 노드 100k+ ops/s, Pub/Sub·Sorted Set·HyperLogLog·Bitmap 등 자료구조 풍부. `09_service_design.md` §9 5개 캐시 패턴(`forecast:{...}` / `recommend:{...}` / `dashboard:{...}` / `inventory_summary:{...}` / `refresh_token_blacklist:{...}`)을 모두 표현 가능. 라이선스 7.4 RSALv2/SSPL은 자체 컨테이너 운영(Mac mini)에선 영향 없음 |
| **클라이언트** | **redis-py (async)** ✅ | 공식 클라이언트, 4.x부터 async 통합, Sentinel·Cluster 지원. `AsyncSession` 패턴과 lifecycle 정합 |
| **호출 방식** | **Service 계층에서 명시적 키로 redis-py 직접 호출** ✅ | `09_service_design.md` §9가 5개 키 패턴을 spec으로 확정 → 데코레이터 추상화(aiocache/fastapi-cache2) 도입 가치 없음. 캐시 로직이 도메인 코드에 명시되어 디버깅·무효화 추적 명확 |

### 1.5 보존 후보 (Valkey)

Valkey는 Linux Foundation 산하·BSD 3-clause로 라이선스 안전성이 더 강하다. Redis 7.4 RSALv2/SSPL이 자체 운영엔 무영향이라 현재 Redis 본채택을 유지하되, 라이선스 정책이 사주라 운영(예: 매장 SaaS 형태로 호스팅 전환)에 영향 줄 수 있는 시점에 전환.

**재평가 트리거:**

| 지표 | 임계치 |
|------|------|
| Redis 라이선스 변경 | RSALv2/SSPL → 더 제한적 라이선스로 추가 변경 |
| 사주라 운영 형태 | 자체 호스팅 → 매장 SaaS 형태 전환 |
| 클라우드 매니지드 Redis | 사용 시점 (현재 Mac mini 자체 운영) |

→ 1개 이상 발생 시 Valkey 전환 검토 (Redis 프로토콜 호환으로 마이그레이션 비용 작음).

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

**구조화 로깅** (감사 로그·요청 컨텍스트 필수)

| # | 후보 | JSON 출력 | contextvars 통합 | 표준 logging 결합 | 활발한 유지보수 | 결과 |
|---|------|:--------:|:--------------:|:--------------:|:-----------:|:----|
| 1 | structlog | ◎ | ◎ | ◎(processor로 표준 logging brridge) | ◎ | ✅ **통과 (구조화 로깅)** |
| 2 | loguru | △(별도 sink 설정) | △(record.extra) | △(intercept handler) | ◎ | ⛔ |
| 3 | python-json-logger | ◎ | ⛔(직접 LogRecord에 추가) | ◎ | O | ⛔ |

**요청 상관 ID**

| # | 후보 | ASGI 미들웨어 | structlog 결합 | 결과 |
|---|------|:-----------:|:------------:|:----|
| 4 | asgi-correlation-id | ◎ | ◎ (contextvars 자동 전파) | ✅ **통과 (요청 ID)** |

**에러·성능 추적**

| # | 후보 | FastAPI 통합 | 운영 부담 | MVP 비용 | 결과 |
|---|------|:-----------:|:-------:|:-------:|:----|
| 5 | sentry-sdk[fastapi] | ◎(자동 통합) | 낮음(SaaS Hosted) | 0 (무료 플랜 5k 이벤트/월) | ✅ **통과 (에러·성능 추적)** |

**메트릭 / 트레이싱 / 대시보드 / 저장 / SaaS**

| # | 후보 | 결과 |
|---|------|:----|
| 6 | Prometheus + instrumentator | 🟡 **보존 (메트릭 본격 도입 시)** |
| 7 | OpenTelemetry | 🟡 **보존 (분산 트레이싱 도입 시)** |
| 8 | Grafana | ⛔ (Prometheus 미채택과 묶음) |
| 9 | Loki | ⛔ (단일 노드 stdout + Docker json-file 충분) |
| 10 | Datadog / New Relic / Elastic APM | ⛔ (Sentry로 에러·성능 커버) |

### 2.3 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| 구조화 JSON 로그 | **필수** | `12_security.md` §5.3 감사 로그 + `13_performance.md` §5 응답 시간·에러율·DB 쿼리 시간 로깅 |
| 요청 상관 ID 자동 전파 | **필수** | 단일 요청의 로그·DB·외부 API 흐름 추적 |
| FastAPI 자동 통합 (에러·성능) | **필수** | `13_performance.md` §5 에러 추적 위임 |
| 메트릭 수집 (RPS·p95) | MVP 미채택 | Sentry Performance가 일부 커버. 본격 도입은 2단계 |
| 분산 트레이싱 | MVP 미채택 | 사주라 단일 BE 노드, 분산 컴포넌트 없음. AI Server 분리는 이미 명확해 트레이싱 가치 작음 |

**탈락 사유:**

- **#2 loguru** — 0-config 가독성 우위지만 표준 `logging` 통합·구조화 JSON 필드 자동 부여는 별도 작업 필요. structlog가 1인 운영에서 컨텍스트 부여(`bind`)·processor pipeline으로 더 명확.
- **#3 python-json-logger** — 표준 logging 100% 호환은 강점이나 contextvars 자동 부여 없음 → 매 로그에 수동 `extra=` 전달. structlog가 우위.
- **#8 Grafana / #9 Loki** — Prometheus·Loki·Grafana 묶음은 도입 시 컨테이너 3개 추가 + Mac mini 메모리 부담. 단일 BE 노드 환경에서 stdout JSON + Docker json-file 드라이버 + Sentry Performance 조합으로 MVP 커버 가능.
- **#10 Datadog / New Relic / Elastic APM** — SaaS 통합 편의 vs 비용. Sentry 무료 플랜으로 에러·성능 커버 가능하고 추가 SaaS 의존 회피.

### 2.4 최종 선발

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **구조화 로깅** | **structlog** ✅ | dict 기반 로깅·contextvars 통합·processor pipeline으로 `request_id`·`user_id`·`store_id` 자동 부여. 표준 `logging`과 bridge 가능 |
| **요청 상관 ID** | **asgi-correlation-id** ✅ | ASGI 미들웨어로 `X-Request-ID` 헤더 처리·없으면 UUID 생성·contextvars에 자동 저장. structlog processor에서 자동 픽업 |
| **에러·성능 추적** | **sentry-sdk[fastapi]** ✅ | FastAPI 자동 통합. breadcrumb·exception·트랜잭션 추적. 무료 플랜 5k 이벤트/월로 MVP 50매장 충분. PII scrubbing 활성으로 매출 데이터 노출 차단 |
| 메트릭 (Prometheus) | MVP 미채택 (보존) | Sentry Performance로 응답 시간·트랜잭션 추적 일부 커버. 2단계 매장 수·노드 수 증가 시 도입 |
| 분산 트레이싱 (OpenTelemetry) | MVP 미채택 (보존) | 단일 BE 노드 환경에선 가치 작음. AI Server 호출 트레이스는 Sentry 트랜잭션으로 일부 커버 |

### 2.5 보존 후보 (Prometheus · OpenTelemetry)

**Prometheus 재평가 트리거:**

| 지표 | 임계치 |
|------|------|
| 동시 매장 수 | ≥ 300 (2단계) |
| BE 노드 수 | ≥ 2 (확장 시) |
| Sentry 이벤트 한도 초과 | 5k 이벤트/월 |

**OpenTelemetry 재평가 트리거:**

| 지표 | 임계치 |
|------|------|
| 마이크로서비스 분리 | BE 외 분리된 서비스 ≥ 2 (AI Server는 이미 분리) |
| 분산 트랜잭션 디버깅 빈도 | 주 1회 이상 |

→ 각각 1개 이상 발생 시 도입 검토.

---

## 3. 운영 흐름 (research 결정)

### 3.1 캐시 호출 방식

- Service 계층 메서드 안에서 `redis-py`를 직접 호출한다 (데코레이터 추상화 미사용).
- 키 패턴은 `09_service_design.md` §9가 source-of-truth — 본 research에서 중복 정의하지 않는다.
- 패턴별 흐름:
  - **Cache-Aside** (`forecast`·`recommend`): GET 시 MISS면 DB 조회 후 SETEX, PUT/PATCH 시 키 DEL → 다음 GET 시 재적재
  - **TTL 기반** (`dashboard`·`inventory_summary`): SETEX로 TTL 설정 후 자동 만료 — 무효화 호출 불필요 (집계 데이터 오차 허용)
  - **Write-Through** (`refresh_token_blacklist`): 로그아웃·탈퇴 시 즉시 SETEX, 토큰 검증 시 EXISTS 확인

### 3.2 로그 구조

- 출력: stdout, JSON 1줄/이벤트. Docker 로그 드라이버(`json-file`)가 자동 수집·로테이션.
- 필수 필드:

| 필드 | 출처 | 비고 |
|------|------|------|
| `ts` | structlog | UTC ISO 8601 |
| `level` | structlog | DEBUG / INFO / WARNING / ERROR / CRITICAL |
| `event` | structlog | 짧은 이벤트명 (snake_case) |
| `request_id` | asgi-correlation-id contextvars | 미들웨어 자동 부여 |
| `user_id` | JWT payload → contextvars | 인증 미들웨어에서 부여 |
| `store_id` | JWT payload → contextvars | 인증 미들웨어에서 부여 |
| `path` / `method` / `status` | FastAPI request hook | 요청 로그 한정 |
| `duration_ms` | request hook | 응답 직전 측정 |

- 감사 로그(`12_security.md` §5.3 대상)는 `event=audit_<action>` 패턴 + 위 필드 + 도메인별 컨텍스트(예: `disposal_log_id`).

### 3.3 Sentry 환경 분리

| 항목 | 값 |
|------|---|
| DSN | 환경변수 `SENTRY_DSN` (pydantic-settings 로딩) |
| `environment` | `dev` / `staging` / `prod` |
| `traces_sample_rate` | `prod=0.1` (10% 샘플링), `staging=1.0`, `dev=1.0` |
| `profiles_sample_rate` | `0`(MVP 미사용) |
| PII scrubbing | 기본 활성 + `send_default_pii=False` |
| Release tagging | Git commit SHA 환경변수 주입 |
| 무시 이벤트 | `KeyboardInterrupt`, `SystemExit` |

> Sentry Performance(트랜잭션)는 응답 시간·DB·외부 API 호출 span을 자동 수집. 매장 매출 등 PII는 scrubbing rule에 추가.

### 3.4 메트릭·트레이싱 (보존 운영 기준)

본 MVP에선 Prometheus·OpenTelemetry 미채택. 도입 시 다음 흐름 가정:
- Prometheus 도입 시: `/metrics` 엔드포인트를 Caddy에서 인증 게이트, Prometheus pull
- OpenTelemetry 도입 시: AI Server 트레이스 전파 — `traceparent` 헤더를 httpx에서 자동 주입

본 항목은 보존 후보 트리거(§2.5)가 충족되는 시점에 별도 research/plan으로 구체화.

---

## 4. 통합 최종 결정 (spec 반영)

본 research가 결정한 라이브러리는 `09_service_design.md` §1에 반영된다. 캐시 키 패턴·서비스 클래스·감사 로그 항목 등 도메인 정의는 spec(`09_service_design.md` §9, `12_security.md` §5.3)이 source-of-truth — 본 문서는 호출 방식·운영 흐름만 정의한다.

### 4.1 라이브러리 결정 (4개 신규 + 1개 기존)

| 라이브러리 | 역할 | spec 반영 위치 |
|----------|------|--------------|
| **redis-py (async)** | Redis Python 클라이언트. `09_service_design.md` §9 5개 키 패턴 명시 호출 | `09_service_design.md` §1 |
| **structlog** | 구조화 JSON 로깅. `request_id`·`user_id`·`store_id` contextvars 자동 부여 | `09_service_design.md` §1 |
| **asgi-correlation-id** | ASGI 미들웨어. `X-Request-ID` 처리·UUID 생성·contextvars 저장 | `09_service_design.md` §1 |
| **sentry-sdk[fastapi]** | 에러·성능 추적. PII scrubbing·환경 분리·`traces_sample_rate=0.1`(prod) | `09_service_design.md` §1 |
| `Redis` (기존) | 인메모리 스토어 | `09_service_design.md` §1 + §9 캐시 패턴 |

### 4.2 결정에 따라 spec에서 갱신될 항목 (참조)

| 영향 영역 | 결정 사항 | 위치 |
|---------|---------|------|
| 모니터링 도구 결정 (위임 → 결정 반영) | 에러·성능 추적은 Sentry SDK. 메트릭·트레이싱은 MVP 미채택 (보존) | `13_performance.md` §5 갱신 |

---

## 5. 후보 세부 정보

### 5.1 Redis ✅
- **사용처**: `09_service_design.md` §9 5개 캐시 패턴 일체 — `forecast:{store_id}:{target_date}`(24h), `recommend:{store_id}`(24h), `dashboard:{store_id}`(10m), `inventory_summary:{store_id}`(5m), `refresh_token_blacklist:{token_hash}`(30d)
- **장점**: 단일 노드 100k+ ops/s, Pub/Sub·Sorted Set·HLL·Bitmap 등 자료구조 풍부, AOF/RDB persistence, 클러스터·복제 옵션
- **단점**: 7.4부터 RSALv2/SSPL 라이선스 — 자체 운영(사주라 Mac mini)엔 영향 없음
- **세부사항**: 컨테이너 단일 노드 운영. `redis:7-alpine`. persistence는 Refresh Token 블랙리스트 30일 유지를 위해 AOF 활성

### 5.2 redis-py (async) ✅
- **사용처**: Python BE에서 Redis 호출
- **장점**: 공식 클라이언트, 4.x부터 async API 통합(`redis.asyncio`), Sentinel·Cluster 지원, 연결 풀 내장
- **단점**: async lifecycle 명시적 관리 필요 (FastAPI lifespan에서 풀 생성/종료)
- **세부사항**: 라이선스 MIT. 구 aioredis는 redis-py에 통합 완료

### 5.3 structlog ✅
- **사용처**: 전 BE 구조화 JSON 로그
- **장점**: dict 기반 로깅, contextvars 통합(`structlog.contextvars.bind_contextvars`), JSON·콘솔 출력 processor pipeline 분리, 표준 logging bridge 가능
- **단점**: 초기 processor 설정 보일러플레이트 존재 (1회성)
- **세부사항**: 라이선스 MIT/Apache 2.0. `structlog>=24` 권장

### 5.4 asgi-correlation-id ✅
- **사용처**: 요청별 상관 ID 부여·로그 컨텍스트 전파
- **장점**: ASGI 미들웨어로 `X-Request-ID` 헤더 처리·없으면 UUID 생성, contextvars에 자동 저장, structlog와 결합 시 처리 0
- **단점**: 미들웨어 등록 순서 주의 (CORS·인증 후, 로깅 전)
- **세부사항**: 라이선스 MIT

### 5.5 sentry-sdk[fastapi] ✅
- **사용처**: 예외·성능 추적
- **장점**: FastAPI 자동 통합(예외·트랜잭션), breadcrumb·user 컨텍스트·release tracking, SDK MIT 라이선스, 무료 플랜 5k 이벤트/월 + 트랜잭션 100k/월
- **단점**: 자체 호스팅(Self-Hosted)은 운영 부담 — MVP는 SaaS Hosted 사용
- **세부사항**: PII scrubbing 활성, `send_default_pii=False`, `traces_sample_rate=0.1`(prod)

### 5.6 Valkey 🟡 (보존)
- **사용처**: Redis 라이선스 이슈 회피용 대안
- **장점**: Linux Foundation 산하, BSD 3-clause, Redis 7.2 동등 기능, 프로토콜 호환으로 마이그레이션 비용 낮음
- **단점**: 신생 — 클라우드 매니지드·자료 축적 진행 중
- **세부사항**: AWS·Google·Oracle 등 후원

### 5.7 Prometheus + instrumentator 🟡 (보존)
- **사용처**: 메트릭 수집 (RPS·p95·5xx 비율)
- **장점**: 사실상 표준, PromQL 강력, Alertmanager 결합
- **단점**: pull 방식·서비스 디스커버리 필요, 장기 보존 별도(Thanos/Cortex)
- **세부사항**: 라이선스 Apache 2.0. `prometheus-fastapi-instrumentator`로 자동 메트릭 부여

### 5.8 OpenTelemetry 🟡 (보존)
- **사용처**: 분산 트레이싱·메트릭·로그 표준
- **장점**: 벤더 중립, FastAPI·SQLAlchemy·httpx·redis 자동 instrumentation, Sentry·Jaeger·Datadog 모두 백엔드 가능
- **단점**: 컬렉터·백엔드 별도 구성 필요
- **세부사항**: 라이선스 Apache 2.0

### 5.9 탈락 후보 요약

| 후보 | 분류 | 탈락 사유 |
|------|------|---------|
| Dragonfly | 인메모리 스토어 | Redis 7 단일 노드로 충분, 모듈 미지원 일부 |
| KeyDB | 인메모리 스토어 | Snap 인수 후 활동 감소 |
| aiocache | 캐시 추상화 | spec §9 명시 키 패턴과 충돌 |
| fastapi-cache2 | endpoint 캐시 | Service 계층 패턴 불일치 |
| loguru | 로깅 | 구조화·표준 logging 결합 별도 |
| python-json-logger | 로깅 | contextvars 자동 부여 없음 |
| Grafana | 대시보드 | Prometheus 미채택과 묶음 |
| Loki | 로그 저장 | stdout + Docker json-file 충분 |
| Datadog / New Relic / Elastic APM | SaaS APM | Sentry로 에러·성능 커버, 추가 비용 회피 |

---

## 6. 비교 요약 표

| 분류 | 후보 | 결과 | 핵심 사유 |
|------|------|------|---------|
| 인메모리 스토어 | Redis | ✅ | 표준·자료구조·persistence |
| 인메모리 스토어 | Valkey | 🟡 보존 | 라이선스 트리거 |
| 인메모리 스토어 | Dragonfly / KeyDB | ⛔ | Redis로 충분 / 활동 감소 |
| 클라이언트 | redis-py (async) | ✅ | 공식·async 통합·Cluster |
| 캐시 추상화 | aiocache / fastapi-cache2 | ⛔ | 명시 키 패턴 불일치 |
| 구조화 로깅 | structlog | ✅ | dict·contextvars·processor |
| 로깅 | loguru / python-json-logger | ⛔ | 표준 결합 별도 / 컨텍스트 별도 |
| 요청 ID | asgi-correlation-id | ✅ | ASGI 미들웨어·structlog 결합 |
| 에러·성능 추적 | sentry-sdk[fastapi] | ✅ | 자동 통합·무료 플랜 |
| 메트릭 | Prometheus | 🟡 보존 | 300매장+·2노드+ 트리거 |
| 트레이싱 | OpenTelemetry | 🟡 보존 | 분산 컴포넌트 추가 시 |
| 대시보드 | Grafana | ⛔ | Prometheus와 묶음 |
| 로그 저장 | Loki | ⛔ | stdout + Docker json-file 충분 |
| SaaS APM | Datadog / New Relic / Elastic | ⛔ | Sentry로 커버 |
