# 테스트 · 코드 품질 · 미들웨어 · API 문서화

> **카테고리**: 단위/통합 테스트, 정적 분석·포매터·보안 스캔, BE 미들웨어, API 문서화 라이브러리 비교
> **연결 spec**: `docs/spec/02_implementation_design.md` §3.10·§3.11, `docs/spec/03_be.md` §14, `docs/spec/03_be.md`

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

| # | 후보 | 특징 |
|---|------|------|
| 1 | pytest | 픽스처·플러그인·assert 표현력 |
| 2 | pytest-asyncio | async fixture·코루틴 테스트, `mode=auto`로 단순화 |
| 3 | httpx AsyncClient | FastAPI app 직접 호출 통합 테스트 (`httpx.AsyncClient(app=app)`) |
| 4 | pytest-cov | branch coverage·CI 통합 |
| 5 | factory_boy | SQLAlchemy·Pydantic DTO 픽스처. async ORM은 별도 패턴 |
| 6 | Faker | 한국 로케일 이름·주소·날짜 |
| 7 | testcontainers-python | MySQL·Redis 실 컨테이너 통합 테스트 |
| 8 | respx | httpx 호출 mock — 외부 API 가짜 응답 |
| 9 | Pact-Python | Consumer-Driven 계약 테스트 |
| 10 | Schemathesis | OpenAPI 기반 fuzz. false positive가 생기고 인증 흐름 셋업이 필요하다 |
| 11 | pytest-playwright | Playwright 브라우저 UI 테스트. 외부 사이트를 대상으로 하면 CI 결과가 불안정하다 |
| 12 | Locust / k6 | 부하 테스트 |

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

| # | 후보 | 핵심 기능 |
|---|------|---------|
| 1 | ruff | linter + formatter + import 정렬 + pyupgrade 통합. Rust로 10~100배 빠름 |
| 2 | black | formatter — ruff format이 black 호환 출력 |
| 3 | isort | import 정렬 — ruff에 흡수 |
| 4 | mypy | PEP 484 표준·Pydantic/SQLAlchemy 플러그인. 검사 속도 보통 |
| 5 | pyright / pylance | 검사 속도가 빠르고 IDE(pylance)와 통합 |
| 6 | bandit | 하드코딩 시크릿·SQL injection·취약 함수 탐지. CI 통합 |
| 7 | pip-audit | PyPA 공식. PEP 621 / requirements 모두 지원 |
| - | safety | 상용 데이터셋. 무료는 제약 |
| 8 | pre-commit | ruff·mypy·bandit·pip-audit 등을 훅으로 일괄 실행 |

### 2.3 후보별 차이

- black, isort — ruff format이 black 호환 출력을 내고, ruff가 import 정렬을 포함한다.
- safety — 상용 취약점 데이터셋에 의존하고 무료 사용에 제약이 있다. pip-audit는 PyPA 공식 도구이고 무료다.
- pyright — mypy보다 검사 속도가 빠르다.

---

## 3. 미들웨어

### 3.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | FastAPI CORSMiddleware | CORS | 내장 |
| 2 | slowapi | Rate Limit | Flask-Limiter 포팅 |
| 3 | fastapi-limiter | Rate Limit | async·Redis |
| 4 | starlette-context | 컨텍스트 | structlog 결합 |
| 5 | asgi-correlation-id | 요청 ID | `X-Request-ID` |
| 6 | GZip / Brotli | 응답 압축 | Caddy `encode`로도 처리 가능 |
| 7 | TrustedHostMiddleware / HTTPSRedirectMiddleware | 보안 | Starlette 내장 |
| 8 | secure | 보안 헤더 | Caddy `header`로도 처리 가능 |

### 3.2 1차 벤치마크 — 필수 기능

| # | 후보 | 특징 |
|---|------|------|
| 1 | CORSMiddleware | FastAPI 내장 — 별도 라이브러리 불필요 |
| 2 | slowapi | Flask 포팅·async 부분 한계 |
| 3 | fastapi-limiter | async·Redis 백엔드 |
| 4 | starlette-context | 요청 범위 컨텍스트. asgi-correlation-id + structlog contextvars로 같은 기능 구성 가능 |
| 5 | asgi-correlation-id | `X-Request-ID` 처리·UUID 생성·contextvars 저장 |
| 6 | GZip/Brotli | 앱 단 응답 압축. Caddy `encode zstd gzip`로 엣지에서도 처리 가능 |
| 7 | TrustedHostMiddleware | Host 헤더 위변조 방어. HTTPSRedirectMiddleware는 HTTP→HTTPS 리다이렉트 |
| 8 | secure | 보안 헤더 설정. Caddy `header` 디렉티브로도 설정 가능 |

### 3.3 후보별 차이

- slowapi — Flask-Limiter 포팅이라 async 통합에 한계가 있다. fastapi-limiter는 async-first다.
- starlette-context — `asgi-correlation-id`가 contextvars로 요청 ID를 부여하고 structlog의 `bind_contextvars`로 `user_id`·`store_id` 등을 붙일 수 있어 기능이 겹친다. 함께 쓰면 키가 충돌·중복될 수 있다.
- GZip/Brotli — 앞단 프록시가 이미 압축하면 BE 내부 압축은 CPU 비용이 중복된다.
- HTTPSRedirectMiddleware — 앞단 프록시가 TLS를 종료하면 BE upstream은 평문 HTTP를 받는다.
- secure — 같은 보안 헤더(HSTS·X-Frame·CSP)를 Caddy `header` 디렉티브로 일괄 적용할 수 있다.

---

## 4. API 문서화

### 4.1 전체 후보 목록

| # | 후보 | 비고 |
|---|------|------|
| 1 | FastAPI OpenAPI/Swagger UI (내장) | FastAPI 기본 제공. 기본 경로 `/docs`, 스키마 `/openapi.json` |
| 2 | ReDoc (FastAPI 내장) | FastAPI 기본 제공. 기본 경로 `/redoc` |
| 3 | Stoplight Elements / RapiDoc | 별도 문서 UI. OpenAPI 스키마 사용 |
| 4 | Postman Collection 자동 생성 | OpenAPI 스키마에서 변환 가능 |

---

## 5. 후보 세부 정보

### 5.1 pytest
- **장점**: 픽스처·`parametrize`·플러그인 생태계 최강, `assert` 표현력 표준
- **단점**: 표준 `unittest`와 패턴 차이 (1회성 학습)
- **세부사항**: 라이선스 MIT

### 5.2 pytest-asyncio
- **장점**: async fixture·코루틴 테스트 지원, `mode=auto`로 단순화
- **단점**: 버전 간 API 변화
- **세부사항**: 라이선스 Apache 2.0

### 5.3 httpx AsyncClient
- **장점**: 실제 HTTP 흐름·async dependency·lifespan 검증. FastAPI 공식 패턴. `AsyncClient(app=app, base_url="http://test")`
- **단점**: 외부 서비스(MySQL·Redis·AI Server) 별도 mock 필요
- **세부사항**: httpx 패키지에 포함

### 5.4 pytest-cov
- **장점**: pytest 플러그인, branch coverage·HTML 리포트·CI 통합
- **단점**: async 코드 일부 분기 인식 미흡 (드물게 발생)
- **세부사항**: 라이선스 MIT

### 5.5 factory_boy
- **장점**: ORM·DTO 통합, Faker 결합 강력
- **단점**: 비동기 ORM 패턴은 `AsyncSQLAlchemyFactory` 또는 사용자 정의 wrapper 필요
- **세부사항**: 라이선스 MIT

### 5.6 Faker
- **장점**: `ko_KR` 한국 로케일, 광범위 데이터 유형(이름·주소·날짜·전화번호 등)
- **단점**: 시드 고정해도 버전 간 결과 변경 가능 (테스트 결정성 주의)
- **세부사항**: 라이선스 MIT

### 5.7 testcontainers-python
- **장점**: 실 MySQL·Redis 컨테이너로 실 환경 검증. CI에서도 안정
- **단점**: 컨테이너 기동 시간으로 테스트 느려짐
- **세부사항**: 라이선스 Apache 2.0. CI 환경에 Docker 데몬 필요

### 5.8 respx
- **장점**: httpx 1급 통합, 라우트 매칭·assertion·spy
- **단점**: requests/aiohttp 미지원
- **세부사항**: 라이선스 BSD

### 5.9 ruff
- **장점**: Rust로 매우 빠름(10~100배), 800+ 규칙, `pyproject.toml` 단일 설정, 0-config 시작. black·isort·flake8·pyupgrade 기능 통합
- **단점**: 일부 사용자 정의 룰은 flake8 플러그인 대비 부족
- **세부사항**: 라이선스 MIT. Astral

### 5.10 mypy
- **장점**: PEP 484 표준, `pydantic.mypy` + `sqlalchemy.ext.mypy_plugin`로 ORM·DTO 검증
- **단점**: async·복잡 제네릭에서 추론 한계, 검사 속도 보통
- **세부사항**: 라이선스 MIT. Dropbox

### 5.11 bandit
- **장점**: 하드코딩 시크릿·SQL injection·취약 함수 탐지. OWASP 매핑. CI 통합
- **단점**: false positive 비율 있음 — `# nosec` 주석으로 표시
- **세부사항**: 라이선스 Apache 2.0

### 5.12 pip-audit
- **장점**: PyPA 공식, `pip-audit --strict` CI 통합, PEP 665/621 + `requirements.txt` 모두 지원
- **단점**: 잠금 파일 갱신은 다루지 않음 (Renovate·Dependabot 등 별도 도구)
- **세부사항**: 라이선스 Apache 2.0

### 5.13 pre-commit
- **장점**: 팀원 환경 일관성, CI 이전 차단
- **단점**: 훅을 설치하지 않은 환경에서는 우회됨
- **세부사항**: 라이선스 MIT

### 5.14 fastapi-limiter
- **장점**: async-first, Redis 단일 소스, sliding window
- **단점**: 데코레이터 패턴이 slowapi 대비 다소 무거움
- **세부사항**: 라이선스 Apache 2.0. Redis 필요

---

## 6. 비교 요약 표

| 분류 | 후보 | 특징 |
|------|------|------|
| 테스트 러너 | pytest | 픽스처·플러그인 표준 |
| async 테스트 | pytest-asyncio | `mode=auto` |
| HTTP 통합 | httpx AsyncClient | FastAPI app 직접 호출 |
| 커버리지 | pytest-cov | branch·HTML·CI |
| 픽스처 | factory_boy | ORM·DTO 통합 |
| 더미 | Faker | `ko_KR` 로케일 |
| 통합 인프라 | testcontainers-python | 실 MySQL/Redis 컨테이너 |
| HTTP mock | respx | httpx 1급 |
| 계약 / fuzz / UI / 부하 | Pact / Schemathesis / pytest-playwright / Locust·k6 | Consumer-Driven 계약 / OpenAPI fuzz / 브라우저 UI / 부하 생성 |
| Linter+Formatter | ruff | Rust·linter+formatter+import 정렬 통합 |
| Formatter / Imports | black / isort | ruff에 같은 기능 포함 |
| 정적 타입 | mypy | PEP 484·Pydantic/SQLAlchemy 플러그인 |
| 정적 타입 | pyright | mypy보다 빠름·IDE 통합 |
| 보안 정적 분석 | bandit | OWASP 매핑·CI 통합 |
| 의존성 취약점 | pip-audit | PyPA 공식·무료 |
| 의존성 취약점 | safety | 상용 데이터셋·무료 제약 |
| 커밋 훅 | pre-commit | 검사 도구 훅 일괄 실행 |
| CORS | FastAPI CORSMiddleware | 내장 |
| Rate Limit | fastapi-limiter | async·Redis |
| Rate Limit | slowapi | Flask-Limiter 포팅 |
| 컨텍스트 | starlette-context | asgi-correlation-id + structlog와 기능 중복 |
| 요청 ID | asgi-correlation-id | `X-Request-ID`·contextvars |
| 응답 압축 | GZip/Brotli (BE) | Caddy `encode`로도 처리 가능 |
| 보안 | TrustedHost / secure | Host 헤더 검증 / 보안 헤더(Caddy `header`로도 처리 가능) |
| HTTPS 강제 | HTTPSRedirect | HTTP→HTTPS 리다이렉트 |
| API 문서 | Swagger UI / ReDoc | FastAPI 내장 |
| API 문서 대안 | Stoplight / RapiDoc / Postman | 별도 UI / OpenAPI 변환 |
