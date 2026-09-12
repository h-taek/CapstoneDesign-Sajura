# 테스트 · 코드 품질 · 미들웨어 · API 문서화

> **카테고리**: 단위/통합 테스트, 정적 분석·포매터·보안 스캔, BE 미들웨어, API 문서화 라이브러리 결정
> **연결 spec**: `docs/spec/07_api_spec.md` §10·§11, `docs/spec/13_performance.md`, `docs/spec/12_security.md`

---

## 0. 카테고리 구성 & 결정 항목

| 하위 카테고리 | 후보 수 | 결정 항목 수 |
|------------|--------|------------|
| §1 테스트 | 12 | 7 (러너 / async / HTTP 클라이언트 / 커버리지 / 픽스처·더미 / 통합 인프라 / HTTP mock) + 2 보존 |
| §2 코드 품질·정적 분석 | 8 | 5 (linter+formatter / 타입 / 보안 / 의존성 취약점 / 훅) |
| §3 미들웨어 | 8 | 4 (CORS / Rate Limit / 요청 ID / TrustedHost) — 3는 Caddy 처리로 미채택, 1은 07에서 ratify |
| §4 API 문서화 | 4 | 2 (Swagger UI / ReDoc 내장) |

### 본 research가 결정하는 라이브러리 (spec 반영)

| 라이브러리 | 카테고리 | 결정 근거 위치 | spec 반영 위치 |
|----------|---------|--------------|--------------|
| pytest | 테스트 러너 | §1.2 + §1.4 | `09_service_design.md` §1 개발·테스트 도구 (신규) |
| pytest-asyncio | async 테스트 | §1.2 + §1.4 | 동상 |
| pytest-cov | 커버리지 | §1.2 + §1.4 | 동상 |
| factory_boy | 픽스처 | §1.2 + §1.4 | 동상 |
| Faker | 더미 데이터 | §1.2 + §1.4 | 동상 |
| testcontainers-python | 통합 인프라 | §1.2 + §1.4 | 동상 |
| respx | httpx mock | §1.2 + §1.4 | 동상 |
| ruff | linter + formatter | §2.2 + §2.4 | 동상 |
| mypy | 정적 타입 | §2.2 + §2.4 | 동상 |
| bandit | 보안 정적 분석 | §2.2 + §2.4 | 동상 |
| pip-audit | 의존성 취약점 | §2.2 + §2.4 | 동상 (05 §3에서 09에 위임) |
| pre-commit | 커밋 훅 | §2.2 + §2.4 | 동상 |
| fastapi-limiter | Rate Limit | §3.2 + §3.4 | `09_service_design.md` §1 운영 라이브러리 (신규) |

### 이미 결정된 항목 (다른 research에서)

| 항목 | 결정 | 결정 위치 |
|------|------|---------|
| asgi-correlation-id | ✅ 채택 | `07_cache_observability.md` §2.4 |
| secure 미들웨어 | ⛔ 미채택 (Caddy `header`) | `05_auth_security.md` §3.4 |
| HTTPSRedirectMiddleware | ⛔ 미채택 (Caddy TLS 종료·HTTP→HTTPS) | `03_reverse_proxy.md` §4 |
| GZip/Brotli 응답 압축 | ⛔ 미채택 (Caddy `encode zstd gzip`) | `03_reverse_proxy.md` §4.1 |
| Swagger UI / ReDoc | ✅ 채택 (FastAPI 내장) | `01_web_framework.md` §2, `07_api_spec.md` §11 |

### 본 research 보존 후보 (probe-dependent 트리거)

| 후보 | 보류 이유 | 트리거 |
|------|---------|------|
| Pact-Python | BE-FE 1:1 구조에선 도입 비용이 큼 | FE 팀 분리 운영·계약 변경 회귀 비용 증가 |
| Schemathesis | false positive 비용·인증 흐름 셋업 부담 | api_spec endpoint 30+ 증가 / 회귀 빈도 증가 |
| pytest-playwright | 쿠팡 외부 의존성 강해 CI 불안정 | 사주라 자체 PWA UI 회귀 테스트 필요 시 |
| Locust / k6 | MVP RPS 가정에서 부하 테스트 시급성 낮음 | 매장 ≥ 300 (2단계) scale-up 검증 시점 |
| pyright | mypy 채택 — IDE 보조 가능 | mypy 검사 속도가 CI 병목이 될 때 |

---

## 1. 테스트

### 1.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | pytest | 러너 | Python 표준 |
| 2 | pytest-asyncio | async | 코루틴 테스트 |
| 3 | httpx AsyncClient | HTTP 통합 | FastAPI 공식 패턴 |
| 4 | pytest-cov | 커버리지 | 표준 |
| 5 | factory_boy | 픽스처 | ORM·DTO 통합 |
| 6 | Faker | 더미 데이터 | 다국어 |
| 7 | testcontainers-python | 통합 인프라 | 실 DB·Redis 컨테이너 |
| 8 | respx | HTTP mock | httpx 1급 |
| 9 | Pact-Python | 계약 테스트 | Consumer-Driven |
| 10 | Schemathesis | OpenAPI fuzz | property-based |
| 11 | pytest-playwright | UI | Playwright 자체 테스트 |
| 12 | Locust / k6 | 부하 | scale-up |

### 1.2 1차 벤치마크 — 필수 기능

| # | 후보 | 채택 영역 | 결과 |
|---|------|---------|:----|
| 1 | pytest | 러너 — 픽스처·플러그인·assert 표현력 | ✅ **통과 (러너)** |
| 2 | pytest-asyncio | FastAPI async 코드 필수, `mode=auto`로 단순화 | ✅ **통과 (async)** |
| 3 | httpx AsyncClient | FastAPI app 직접 호출 통합 테스트 (`httpx.AsyncClient(app=app)`) | ✅ **통과 (HTTP 통합)** |
| 4 | pytest-cov | branch coverage·CI 통합 | ✅ **통과 (커버리지)** |
| 5 | factory_boy | SQLAlchemy·Pydantic DTO 픽스처. async ORM은 별도 패턴 | ✅ **통과 (픽스처)** |
| 6 | Faker | 한국 로케일 이름·주소·날짜 | ✅ **통과 (더미)** |
| 7 | testcontainers-python | MySQL·Redis 실 컨테이너 통합 테스트. CI 일관성 | ✅ **통과 (통합 인프라)** |
| 8 | respx | httpx mock — AI Server·국세청·쿠팡 API 가짜 응답 | ✅ **통과 (HTTP mock)** |
| 9 | Pact-Python | BE-FE 1:1·계약 변경 회귀 발생 빈도 작음 | 🟡 **보존** |
| 10 | Schemathesis | api_spec endpoint 50개 미만·인증 셋업 부담 | 🟡 **보존** |
| 11 | pytest-playwright | 쿠팡 외부 의존 강 — CI 불안정. PWA 자체 UI는 FE 영역 | 🟡 **보존** |
| 12 | Locust / k6 | MVP 50매장·20 동시 RPS 작아 부하 테스트 시급성 낮음 | 🟡 **보존** |

### 1.3 판정 기준 및 보존 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| Python 테스트 러너 | **필수** | BE 코드 검증 기반 |
| async 테스트 | **필수** | `02_app_server.md` §4.1 — FastAPI async 일관성 |
| HTTP 통합 테스트 | **필수** | `07_api_spec.md` endpoint 회귀 검증 |
| 커버리지 | **필수** | 코드 품질 측정 |
| 픽스처·더미 데이터 | **필수** | DB·DTO 테스트 데이터 |
| 통합 인프라 (실 DB) | **필수** | 04 SQLAlchemy/aiomysql 결정에 따라 mock DB로는 검증 부족 — 실 MySQL/Redis 통합 필요 |
| HTTP mock | **필수** | 외부 API 테스트 (실 호출은 비용·불안정) |

**보존 후보 트리거** — §0에 정리.

### 1.4 최종 선발

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **러너** | **pytest** ✅ | 픽스처·`parametrize`·플러그인 생태계 최강. assert 표현력 표준 |
| **async** | **pytest-asyncio** ✅ | `mode=auto`로 async fixture·코루틴 테스트 단순화. FastAPI 공식 권장. 마이너 버전 핀 권장 |
| **HTTP 통합** | **httpx AsyncClient (`app=app`)** ✅ | TestClient 대신 AsyncClient로 lifespan·async dependency 모두 검증. FastAPI 공식 패턴 |
| **커버리지** | **pytest-cov** ✅ | branch coverage·HTML 리포트·CI 통합 (목표 라인 커버리지는 MVP 60%, 2단계 80% — 본 research 권장값) |
| **픽스처** | **factory_boy** ✅ | SQLAlchemy·Pydantic 모델 둘 다 지원. async ORM은 `AsyncSQLAlchemyFactory` 패턴 |
| **더미 데이터** | **Faker** ✅ | 한국 로케일 (`ko_KR`) — 주점 메뉴명·점주 이름·주소 |
| **통합 인프라** | **testcontainers-python** ✅ | 실 MySQL/Redis 컨테이너로 통합 테스트. CI에서도 안정 동작 |
| **HTTP mock** | **respx** ✅ | httpx 1급 통합. 라우트 매칭·assertion·spy. AI Server·국세청·쿠팡 외부 호출 모두 적용 |

---

## 2. 코드 품질 · 정적 분석

### 2.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | ruff | linter + formatter | Rust |
| 2 | black | formatter | opinionated |
| 3 | isort | import 정렬 | ruff 흡수 |
| 4 | mypy | 타입 검사 | 표준 |
| 5 | pyright / pylance | 타입 검사 | MS |
| 6 | bandit | 보안 정적 분석 | OWASP |
| 7 | pip-audit / safety | 의존성 취약점 | CI |
| 8 | pre-commit | 커밋 훅 | 일관성 |

### 2.2 1차 벤치마크 — 필수 기능

| # | 후보 | 핵심 기능 | 결과 |
|---|------|---------|:----|
| 1 | ruff | linter + formatter + import 정렬 + pyupgrade 통합. Rust로 10~100배 빠름 | ✅ **통과 (linter+formatter)** |
| 2 | black | formatter — ruff format이 black 호환 출력 | ⛔ (ruff에 흡수) |
| 3 | isort | import 정렬 — ruff에 흡수 | ⛔ |
| 4 | mypy | PEP 484 표준·Pydantic/SQLAlchemy 플러그인. 검사 속도 보통 | ✅ **통과 (정적 타입)** |
| 5 | pyright / pylance | 빠름·정확하나 mypy 채택 시 보조 (IDE) | 🟡 보존 (mypy 속도 한계 시) |
| 6 | bandit | 하드코딩 시크릿·SQL injection·취약 함수 탐지. CI 통합 | ✅ **통과 (보안 정적 분석)** |
| 7 | pip-audit | PyPI 공식. PEP 621 / requirements 모두 지원 | ✅ **통과 (의존성 취약점)** |
| - | safety | 상용 데이터셋. 무료는 제약 | ⛔ (pip-audit 우위) |
| 8 | pre-commit | ruff·mypy·bandit·pip-audit 훅 통합 | ✅ **통과 (훅)** |

### 2.3 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| Linter + Formatter 통합 | **필수** | BE 팀(2명) 코드 스타일 일관성·CI 속도 |
| 정적 타입 검사 | **필수** | Pydantic v2 + SQLAlchemy 2.x 타입 친화 — 회귀 방지 |
| 보안 정적 분석 | **필수** | `12_security.md` §5.3 감사·민감 자격증명 보호 |
| 의존성 취약점 스캔 | **필수** | `12_security.md` §7 — 05 §3에서 09에 위임 |
| 커밋 훅 일관성 | **필수** | 1인 운영 - 팀원 환경 일관성 |

**탈락 사유:**

- **#2 black / #3 isort** — ruff format/import 정렬에 흡수. 별도 도입 비용·중복 실행 회피.
- **#7 safety** — 상용 데이터셋 의존. pip-audit가 PyPI 공식·무료·동등 커버리지.

### 2.4 최종 선발

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **Linter + Formatter** | **ruff** ✅ | Rust로 빠름(10~100배), `ruff check` + `ruff format` 단일 도구. 800+ 규칙. `pyproject.toml` 단일 설정. black·isort·flake8·pyupgrade 통합 |
| **정적 타입** | **mypy** ✅ | PEP 484 표준, `pydantic.mypy` + `sqlalchemy.ext.mypy_plugin`로 ORM·DTO 타입 검증. `--strict` 권장 |
| **보안 정적 분석** | **bandit** ✅ | 하드코딩 시크릿·SQL injection·취약 함수. CI 통합. false positive는 `# nosec` 주석으로 표시 |
| **의존성 취약점** | **pip-audit** ✅ | PyPI 공식. `pip-audit --strict` CI 통합. PEP 665/621 + `requirements.txt` 모두 지원 |
| **커밋 훅** | **pre-commit** ✅ | ruff·mypy·bandit·pip-audit·secret 검사를 훅으로 일괄 적용. CI에서도 동일 검사 실행 (훅 우회 방어) |

---

## 3. 미들웨어

### 3.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | FastAPI CORSMiddleware | CORS | 내장 |
| 2 | slowapi | Rate Limit | Flask-Limiter 포팅 |
| 3 | fastapi-limiter | Rate Limit | async·Redis |
| 4 | starlette-context | 컨텍스트 | structlog 결합 |
| 5 | asgi-correlation-id | 요청 ID | 07에서 채택 |
| 6 | GZip / Brotli | 응답 압축 | Caddy 처리 |
| 7 | TrustedHostMiddleware / HTTPSRedirectMiddleware | 보안 | Starlette 내장 |
| 8 | secure | 보안 헤더 | 05에서 미채택 |

### 3.2 1차 벤치마크 — 필수 기능

| # | 후보 | 결과 | 비고 |
|---|------|:----|------|
| 1 | CORSMiddleware | ✅ | FastAPI 내장 — 별도 라이브러리 불필요. allow_origins 정책만 결정 |
| 2 | slowapi | ⛔ | Flask 포팅·async 부분 한계. fastapi-limiter 우위 |
| 3 | fastapi-limiter | ✅ | async·Redis(사주라 기존) 재활용. 인증 API·알림 발송 API 보호 |
| 4 | starlette-context | ⛔ | asgi-correlation-id + structlog contextvars(`07_cache_observability.md` §3.2)로 대체 가능 |
| 5 | asgi-correlation-id | ✅ (ratify) | 07 §2.4 결정 — 본 카테고리에선 확인만 |
| 6 | GZip/Brotli | ⛔ | Caddy `encode zstd gzip` 엣지 처리 (`03_reverse_proxy.md` §4.1) |
| 7 | TrustedHostMiddleware | ✅ | Host 헤더 위변조 방어 (Caddy 후 BE 도달 시 잘못된 Host 차단). HTTPSRedirectMiddleware는 Caddy가 외부 HTTPS 강제하므로 BE 단에선 ⛔ |
| 8 | secure | ⛔ | Caddy `header` 디렉티브 (`05_auth_security.md` §3.4) |

### 3.3 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| CORS 정책 | **필수** | PWA(Frontend) ↔ BE 다른 origin 호출 가능성 (개발 환경 또는 도메인 분리 운영 시) |
| Rate Limit | **필수** | 인증 API 무차별 시도 방어, 알림 발송 API 남용 방어 |
| 요청 상관 ID | **필수** | 07 §2.4 ratify |
| Host 검증 | **필수** | Host 헤더 위변조 방어 |
| HTTPS 강제 | Caddy 처리 | 03 §4 — BE upstream은 HTTP/1.1 평문 (12_security.md §4) |
| 응답 압축 | Caddy 처리 | 03 §4.1 |
| 보안 헤더 (HSTS·X-Frame·CSP) | Caddy 처리 | 05 §3.4 |

**탈락 사유:**

- **#2 slowapi** — Flask-Limiter 포팅으로 async 통합 한계. fastapi-limiter는 async-first.
- **#4 starlette-context** — `asgi-correlation-id`가 contextvars로 요청 ID 부여, structlog의 `bind_contextvars`가 `user_id`·`store_id` 부여(`07_cache_observability.md` §3.2). starlette-context 도입 시 키 충돌·중복.
- **#6 GZip/Brotli** — Caddy 엣지 압축으로 충분. BE 내부 압축은 CPU 중복 비용.
- **HTTPSRedirectMiddleware** (7의 일부) — BE upstream은 평문 HTTP/1.1 (12_security.md §4 정합). Caddy가 외부 HTTPS 강제.
- **#8 secure** — Caddy `header` 디렉티브로 일괄 적용 (05 §3.5).

### 3.4 최종 선발

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **CORS** | **FastAPI CORSMiddleware** ✅ | 내장. `allow_origins` = 운영 PWA 도메인(`<sub>.iptime.org`) + 개발 환경(`localhost:5173` 등). `allow_credentials=True`(Refresh Cookie 흐름), `allow_methods=["*"]`, `allow_headers=["*"]` |
| **Rate Limit** | **fastapi-limiter** ✅ | async·Redis 재활용. 인증 API `5/min`(POST /login·register), 알림 발송 API `30/min`, 일반 API 제한 없음 (사주라 RPS 가정 작음) |
| **요청 상관 ID** | **asgi-correlation-id** ✅ | 07 ratify. 미들웨어 등록 순서: CORS → asgi-correlation-id → 인증 → 라우터 |
| **Host 검증** | **TrustedHostMiddleware** ✅ | Starlette 내장. `allowed_hosts = ["<sub>.iptime.org", "localhost", "be"]` (Caddy 내부 hostname 포함) |

---

## 4. API 문서화

### 4.1 전체 후보 목록 및 1차 평가

| # | 후보 | 결과 |
|---|------|:----|
| 1 | FastAPI OpenAPI/Swagger UI (내장) | ✅ **채택** |
| 2 | ReDoc (FastAPI 내장) | ✅ **채택** |
| 3 | Stoplight Elements / RapiDoc | ⛔ (내장 UI 2개로 충분) |
| 4 | Postman Collection 자동 생성 | ⛔ MVP 미채택 (OpenAPI → 변환 가능, QA 요구 발생 시 적용) |

### 4.2 운영 정책

| 항목 | 결정 |
|------|------|
| 경로 | `/docs` (Swagger UI), `/redoc` (ReDoc), `/openapi.json` (스키마) |
| 운영 환경 접근 | 인증 게이트 — `app.openapi_url`을 운영에서 비공개 (또는 Caddy basic auth로 보호) |
| 개발/스테이징 접근 | 공개 |
| api_spec 변경 시 동기화 | FastAPI 자동 생성이므로 코드 변경 즉시 반영. `07_api_spec.md` 정의와 일치 검증은 Schemathesis (보존 후보 §0) 도입 시 자동화 |

---

## 5. 운영 흐름 (research 결정)

### 5.1 테스트 전략

| 계층 | 도구 | 범위 |
|------|------|------|
| 단위 테스트 | pytest + pytest-asyncio | Service 메서드·비즈니스 로직·헬퍼 함수 |
| 통합 테스트 | pytest + httpx AsyncClient + testcontainers-python (MySQL/Redis) | Controller → Service → Model → 실 DB end-to-end |
| 외부 API mock | respx | AI Server·국세청·기타 외부 호출은 respx 라우트로 mock |
| Playwright | 통합 테스트에서 mock 또는 skip | 쿠팡 자동화 코드 자체는 단위 테스트만 (`AutomationService.parse_result` 등) — 실 호출은 보존 후보 (pytest-playwright) |

### 5.2 커버리지 목표

| 단계 | 목표 |
|------|------|
| MVP | 라인 커버리지 60% |
| 2단계 | 라인 커버리지 80% |
| 핵심 모듈 (AuthService·InventoryService FIFO·OrderService 등) | 항상 80%+ |

### 5.3 CI 파이프라인 (요약)

GitHub Actions 등 CI 환경에서 다음 순서:

1. `pre-commit run --all-files` (ruff check + format + mypy + bandit + pip-audit)
2. `pytest --cov` (단위 + 통합 — testcontainers Docker 필요)
3. 커버리지 임계치 미달 시 실패

> CI 도구 자체 결정은 `10_deployment.md` 카테고리.

### 5.4 미들웨어 순서

```
요청 →
  CORSMiddleware →
  TrustedHostMiddleware →
  asgi-correlation-id →
  (Sentry SDK 자동 통합 미들웨어) →
  인증 의존성 (FastAPI Depends) →
  라우터
```

> 순서 원칙: 가장 바깥(CORS·Host) → 컨텍스트(요청 ID) → 관측(Sentry) → 인증 → 비즈니스.

### 5.5 Rate Limit 정책

| 대상 | 제한 | 키 |
|------|------|---|
| `POST /api/auth/login`, `POST /api/auth/register` | 5/min | IP 기반 |
| `POST /api/auth/refresh` | 30/min | IP 기반 |
| `POST /api/notifications/subscribe` | 10/min | `user_id` |
| `GET /api/notifications` | 60/min | `user_id` |
| 그 외 일반 API | 미적용 (사주라 MVP RPS 가정 작음) | — |

> 실 운영에서 부족하면 `06_external_integration.md` §3.6 카카오 알림톡 트리거와 함께 재평가.

---

## 6. 통합 최종 결정 (spec 반영)

### 6.1 라이브러리 결정

**개발·테스트 도구 (신규 spec 표 — `09_service_design.md` §1에 추가)**

| 라이브러리 | 역할 |
|----------|------|
| pytest | 테스트 러너 |
| pytest-asyncio | async 테스트 |
| pytest-cov | 커버리지 |
| httpx (테스트 모드) | FastAPI AsyncClient — `09_service_design.md` §1 httpx 행에 이미 포함 |
| factory_boy | 픽스처 |
| Faker | 더미 데이터 (`ko_KR`) |
| testcontainers-python | 실 MySQL/Redis 통합 테스트 |
| respx | httpx mock |
| ruff | linter + formatter |
| mypy | 정적 타입 |
| bandit | 보안 정적 분석 |
| pip-audit | 의존성 취약점 |
| pre-commit | 커밋 훅 일관성 |

**운영 라이브러리 (`09_service_design.md` §1 본 표에 추가)**

| 라이브러리 | 역할 |
|----------|------|
| **fastapi-limiter** | Redis 기반 async Rate Limit. 인증 API·알림 발송 API 보호 |

### 6.2 결정에 따라 spec에서 갱신될 항목 (참조)

| 영향 영역 | 결정 사항 | 위치 |
|---------|---------|------|
| 미들웨어 순서·정책 | CORS / TrustedHost / asgi-correlation-id / Sentry / 인증 / 라우터. CORS allow_origins·credentials 정책 | `09_service_design.md` 미들웨어 절 또는 별도 신규 절 |
| Rate Limit 적용 endpoint 5개 | 인증 5/min · refresh 30/min · subscribe 10/min · GET notifications 60/min | `07_api_spec.md` 또는 `12_security.md`에 표기 가능 (현 구조에서는 `09_service_design.md` 미들웨어 절에 통합) |
| API 문서 운영 환경 비공개 정책 | `/docs`·`/redoc` 운영 비공개 또는 Caddy basic auth | `07_api_spec.md` §11 인터페이스 표준 |

> DB 컬럼·API endpoint·서비스 시그니처 추가 없음 — 본 카테고리 결정은 라이브러리·미들웨어·운영 정책 한정.

---

## 7. 후보 세부 정보

### 7.1 pytest ✅
- **사용처**: BE 전 테스트 코드 — 단위·통합·픽스처
- **장점**: 픽스처·`parametrize`·플러그인 생태계 최강, `assert` 표현력 표준
- **단점**: 표준 `unittest`와 패턴 차이 (1회성 학습)
- **세부사항**: 라이선스 MIT

### 7.2 pytest-asyncio ✅
- **사용처**: async fixture·코루틴 테스트
- **장점**: FastAPI async 코드 테스트 필수, `mode=auto`로 단순화
- **단점**: 버전 간 API 변화 — 마이너 버전 핀 권장
- **세부사항**: 라이선스 Apache 2.0

### 7.3 httpx AsyncClient ✅
- **사용처**: FastAPI app 직접 호출 통합 테스트 — `AsyncClient(app=app, base_url="http://test")`
- **장점**: 실제 HTTP 흐름·async dependency·lifespan 검증. FastAPI 공식 패턴
- **단점**: 외부 서비스(MySQL·Redis·AI Server) 별도 mock (testcontainers + respx)
- **세부사항**: `09_service_design.md` §1 httpx에 포함

### 7.4 pytest-cov ✅
- **사용처**: 코드 커버리지 측정
- **장점**: pytest 플러그인, branch coverage·HTML 리포트·CI 통합
- **단점**: async 코드 일부 분기 인식 미흡 (드물게 발생)
- **세부사항**: 라이선스 MIT

### 7.5 factory_boy ✅
- **사용처**: SQLAlchemy 모델·Pydantic DTO 픽스처
- **장점**: ORM·DTO 통합, Faker 결합 강력
- **단점**: 비동기 ORM 패턴은 `AsyncSQLAlchemyFactory` 또는 사용자 정의 wrapper 필요
- **세부사항**: 라이선스 MIT

### 7.6 Faker ✅
- **사용처**: 더미 데이터 — 이름·주소·날짜·전화번호 등
- **장점**: `ko_KR` 한국 로케일, 광범위 데이터 유형
- **단점**: 시드 고정해도 버전 간 결과 변경 가능 (테스트 결정성 주의)
- **세부사항**: 라이선스 MIT

### 7.7 testcontainers-python ✅
- **사용처**: 통합 테스트에서 MySQL·Redis 실 컨테이너 spawn
- **장점**: 실 환경 검증 — 04 SQLAlchemy/aiomysql 결정에 따라 mock으로는 검증 부족. CI에서도 안정
- **단점**: 컨테이너 기동 시간으로 테스트 느려짐 — 통합 테스트만 적용, 단위 테스트는 제외
- **세부사항**: 라이선스 Apache 2.0. CI 환경에 Docker 데몬 필요

### 7.8 respx ✅
- **사용처**: httpx 호출 mock — AI Server·국세청·외부 공공 API·쿠팡 단가
- **장점**: httpx 1급 통합, 라우트 매칭·assertion·spy
- **단점**: requests/aiohttp 미지원 (사주라는 httpx 단일이라 무관)
- **세부사항**: 라이선스 BSD

### 7.9 ruff ✅
- **사용처**: linter + formatter + import 정렬 + pyupgrade
- **장점**: Rust로 매우 빠름(10~100배), 800+ 규칙, `pyproject.toml` 단일 설정, 0-config 시작
- **단점**: 일부 사용자 정의 룰은 flake8 플러그인 대비 부족
- **세부사항**: 라이선스 MIT. Astral

### 7.10 mypy ✅
- **사용처**: 정적 타입 검사
- **장점**: PEP 484 표준, `pydantic.mypy` + `sqlalchemy.ext.mypy_plugin`로 ORM·DTO 검증
- **단점**: async·복잡 제네릭에서 추론 한계, 검사 속도 보통
- **세부사항**: 라이선스 MIT. Dropbox. `--strict` 권장

### 7.11 bandit ✅
- **사용처**: 보안 정적 분석
- **장점**: 하드코딩 시크릿·SQL injection·취약 함수 탐지. OWASP 매핑. CI 통합
- **단점**: false positive 비율 있음 — `# nosec` 주석으로 표시
- **세부사항**: 라이선스 Apache 2.0

### 7.12 pip-audit ✅
- **사용처**: Python 의존성 알려진 취약점 스캔
- **장점**: PyPA 공식, `pip-audit --strict` CI 통합, PEP 665/621 + `requirements.txt` 모두 지원
- **단점**: 잠금 파일 갱신 정책 별도 (Renovate / Dependabot은 `10_deployment.md` 영역)
- **세부사항**: 라이선스 Apache 2.0

### 7.13 pre-commit ✅
- **사용처**: 커밋 훅 — ruff·mypy·bandit·pip-audit·secret 검사
- **장점**: 팀원 환경 일관성, CI 이전 차단
- **단점**: 훅 설치 미흡한 팀원 우회 가능 → CI에도 동일 검사 적용으로 방어
- **세부사항**: 라이선스 MIT

### 7.14 fastapi-limiter ✅
- **사용처**: Redis 기반 분산 Rate Limit
- **장점**: async-first, Redis 단일 소스, sliding window. 인증 API·알림 발송 API 보호
- **단점**: 데코레이터 패턴이 slowapi 대비 다소 무거움
- **세부사항**: 라이선스 Apache 2.0. Redis 재활용으로 인프라 추가 0

### 7.15 보존·탈락 후보 요약

| 후보 | 분류 | 결과 | 사유 |
|------|------|------|------|
| Pact-Python | 계약 테스트 | 🟡 보존 | FE 분리·계약 회귀 비용 시점 |
| Schemathesis | OpenAPI fuzz | 🟡 보존 | endpoint 50+ / 인증 셋업 비용 |
| pytest-playwright | UI | 🟡 보존 | 쿠팡 외부 의존 — 자체 PWA 회귀 시 |
| Locust / k6 | 부하 | 🟡 보존 | 매장 300+ scale-up 시점 |
| pyright / pylance | 타입 | 🟡 보존 | mypy 속도 한계 시 |
| black | formatter | ⛔ | ruff format이 흡수 |
| isort | import 정렬 | ⛔ | ruff에 흡수 |
| safety | 의존성 취약점 | ⛔ | pip-audit 우위 |
| slowapi | Rate Limit | ⛔ | async 부분 한계 |
| starlette-context | 컨텍스트 | ⛔ | asgi-correlation-id + structlog로 대체 |
| GZip/Brotli (BE) | 응답 압축 | ⛔ | Caddy `encode` 엣지 처리 |
| HTTPSRedirectMiddleware | HTTPS 강제 | ⛔ | Caddy 처리 |
| secure | 보안 헤더 | ⛔ | Caddy `header` 디렉티브 |
| Stoplight / RapiDoc | API UI | ⛔ | 내장 Swagger UI + ReDoc로 충분 |
| Postman Collection | API 변환 | ⛔ | MVP 미채택 (요구 발생 시 변환) |

---

## 8. 비교 요약 표

| 분류 | 후보 | 결과 | 핵심 사유 |
|------|------|------|---------|
| 테스트 러너 | pytest | ✅ | 픽스처·플러그인 표준 |
| async 테스트 | pytest-asyncio | ✅ | `mode=auto`·FastAPI 공식 |
| HTTP 통합 | httpx AsyncClient | ✅ | FastAPI 공식 패턴 |
| 커버리지 | pytest-cov | ✅ | branch·HTML·CI |
| 픽스처 | factory_boy | ✅ | ORM·DTO 통합 |
| 더미 | Faker | ✅ | `ko_KR` 로케일 |
| 통합 인프라 | testcontainers-python | ✅ | 실 MySQL/Redis |
| HTTP mock | respx | ✅ | httpx 1급 |
| 계약 / fuzz / UI / 부하 | Pact / Schemathesis / pytest-playwright / Locust·k6 | 🟡 보존 | trigger 기반 |
| Linter+Formatter | ruff | ✅ | 빠름·통합 |
| Formatter / Imports | black / isort | ⛔ | ruff 흡수 |
| 정적 타입 | mypy | ✅ | PEP 484·Pydantic/SQLAlchemy 플러그인 |
| 타입 보조 | pyright | 🟡 보존 | mypy 속도 한계 시 |
| 보안 정적 분석 | bandit | ✅ | OWASP·CI |
| 의존성 취약점 | pip-audit | ✅ | PyPA 공식 |
| 의존성 취약점 | safety | ⛔ | pip-audit 우위 |
| 커밋 훅 | pre-commit | ✅ | 일관성 |
| CORS | FastAPI CORSMiddleware | ✅ | 내장 |
| Rate Limit | fastapi-limiter | ✅ | async·Redis |
| Rate Limit | slowapi | ⛔ | Flask 포팅 |
| 컨텍스트 | starlette-context | ⛔ | asgi-correlation-id + structlog 대체 |
| 요청 ID | asgi-correlation-id | ✅ (07 ratify) | — |
| 응답 압축 | GZip/Brotli (BE) | ⛔ | Caddy 처리 |
| 보안 | TrustedHost / secure | ✅ TrustedHost / ⛔ secure | Caddy 처리 + Host 검증만 BE |
| HTTPS 강제 | HTTPSRedirect | ⛔ | Caddy 처리 |
| API 문서 | Swagger UI / ReDoc | ✅ (내장) | FastAPI |
| API 문서 대안 | Stoplight / RapiDoc / Postman | ⛔ | 내장 충분 / MVP 미채택 |
