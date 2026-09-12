# 사주라 기술 스택 요약 (확정 결정만)

> backend(`docs/research/backend/01~11, 13~14`) + frontend(`docs/research/frontend/01~11`) research에서 확정된 프레임워크·라이브러리·언어·도구·인프라 일람.
> **보존 후보**(probe·트리거 의존)는 제외. 결정 근거·트리거·탈락 사유는 각 research 파일 참조.
> 결정 이력 요약: `PROGRESS.md` §3 / 본 SUMMARY는 결정 결과만 보여줌.

---

## 0. 사용 안내

| 항목 | 설명 |
|------|------|
| 이름 | 라이브러리·언어·도구 공식 이름 (버전 메이저까지) |
| 종류 | "라이브러리(언어)·언어·도구·인프라·서비스" 구분 |
| 설명 | 한 줄 요약 (역할만) |
| 적용 위치 | spec 또는 코드 영역 — 어디서 사용되는가 |

> 표 우측 끝의 ref는 결정 근거 research 파일.

---

## 1. 언어·런타임

| 이름 | 종류 | 설명 | 적용 위치 | ref |
|------|------|------|---------|----|
| **Python 3.12** | 언어 | BE·AI Server 메인 언어 | BE 전체·AI Server 전체 | 04 |
| **TypeScript 5.x (strict)** | 언어 | FE 메인 언어 (strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes) | FE 전체 | fe 01 |
| **Node 22 LTS** | 런타임 | FE 빌드·테스트·CI 런타임 | FE 빌드·CI | fe 10 |
| **SQL (MySQL 8 방언)** | 언어 | DB 직접 쿼리·Alembic 마이그레이션 | `08_schema.md`·`alembic/` | 04 |

---

## 2. Backend — 웹·서버·프록시

| 이름 | 종류 | 설명 | 적용 위치 | ref |
|------|------|------|---------|----|
| **FastAPI** | 라이브러리(Python) | 웹 프레임워크 — HTTP 라우팅·Pydantic v2·자동 OpenAPI | BE 전체·`07_api_spec.md` 22 endpoint | 01 |
| **Uvicorn** | 라이브러리(Python) | dev ASGI 서버 (`uvicorn main:app --reload`) | 로컬 개발 | 02 |
| **Gunicorn + uvicorn.workers** | 라이브러리(Python) | 운영 ASGI 프로세스 매니저 — 워커 4 + `--timeout 60 --max-requests 1000 --preload` | 운영 BE 컨테이너 | 02 |
| **Caddy v2** | 인프라 | 리버스 프록시 + 자동 HTTPS(Let's Encrypt) + HTTP/2·3 + PWA 정적 서빙 | `09_service_design.md` §11 `caddy` 컨테이너 (자체 빌드, FE dist COPY) | 03 + fe 10 |

---

## 3. Backend — 데이터 계층

| 이름 | 종류 | 설명 | 적용 위치 | ref |
|------|------|------|---------|----|
| **SQLAlchemy 2.x (async)** | 라이브러리(Python) | ORM | Service·Repository 전체 | 04 |
| **aiomysql** | 라이브러리(Python) | async MySQL 드라이버 (SQLAlchemy backend) | BE runtime DB 접속 | 04 |
| **PyMySQL** | 라이브러리(Python) | sync MySQL 드라이버 (Alembic 한정) | `alembic/env.py` | 04 |
| **Alembic** | 라이브러리(Python) | DB 스키마 마이그레이션 | `alembic/versions/` | 04 |
| **Pydantic v2** | 라이브러리(Python) | Request/Response DTO 검증·직렬화·OpenAPI 스키마 | 모든 DTO·Controller | 04 |
| **pydantic-settings** | 라이브러리(Python) | `.env`·환경변수 → 타입 안전 Settings | `config.py`·환경별 `.env.*` | 04 |
| **orjson** | 라이브러리(Python) | FastAPI 응답 JSON 가속 | `default_response_class=ORJSONResponse` | 04 |
| **python-multipart** | 라이브러리(Python) | 멀티파트 폼 처리 | `POST /api/sales/upload` | 04 |
| **pandas** | 라이브러리(Python) | DataFrame — CSV 파싱·집계·IQR/Z-score 이상치 | `SaleService.upload_csv`·`DashboardService.get_roi` | 04 |
| **numpy** | 라이브러리(Python) | 수치 연산 (pandas backend) | 동상 | 04 |
| **MySQL 8** | 인프라 | RDB | `09_service_design.md` §11 `mysql` 컨테이너 | 04 |
| **datetime + zoneinfo (표준)** | 라이브러리(Python·표준) | 시간 처리 (KST `Asia/Seoul`) | 전 영역 | 11 |

---

## 4. Backend — 인증·암호화·보안

| 이름 | 종류 | 설명 | 적용 위치 | ref |
|------|------|------|---------|----|
| **Authlib** | 라이브러리(Python) | OAuth 2.0 인가·콜백 (Google·카카오) | `AuthService.login_with_oauth` | 05 |
| **python-jose** | 라이브러리(Python) | JWT Access Token 생성·검증 | `AuthService`·인증 의존성 | 05 |
| **passlib (bcrypt)** | 라이브러리(Python) | 이메일 로그인 비밀번호 해싱 | `AuthService.register`·`login_with_email` | 05 |
| **cryptography** | 라이브러리(Python) | AES-256-GCM (`pos_connections.api_key` 저장 암호화) | `PosService` | 05 |

---

## 5. Backend — 외부 연동·자동화·알림

| 이름 | 종류 | 설명 | 적용 위치 | ref |
|------|------|------|---------|----|
| **httpx** | 라이브러리(Python) | async/sync HTTP 클라이언트 — AI Server·국세청·외부 공공 API | `AIServerClient`·`AuthService.verify_business_no` | 06 |
| **tenacity** | 라이브러리(Python) | 재시도 데코레이터·context (지수 백오프 + jitter, `stop_after_attempt(3)`) | 외부 API 호출 | 06 |
| **aiobreaker** | 라이브러리(Python) | async circuit breaker (`CLOSED→OPEN→HALF_OPEN`) | `AIServerClient` | 06 |
| **Playwright (async, Python)** | 라이브러리(Python) | 브라우저 자동화 (Chromium 단일) | `AutomationService` 쿠팡 장바구니·`SiteScrapingService` 단가 조회 | 06 |
| **BeautifulSoup4 + lxml** | 라이브러리(Python) | HTML 파싱 (Playwright `page.content()` → 셀렉터) | 쿠팡 단가 파싱 | 06 |
| **slack_sdk** | 라이브러리(Python) | Slack Webhook 단방향 — `AsyncWebhookClient` | n8n 파이프라인 실패 알림(개발팀) | 06 |
| **pywebpush** | 라이브러리(Python) | Web Push (VAPID 표준, iOS Safari 16.4+) | `NotificationService.create_and_push` | 06 |
| **fastapi-mail** | 라이브러리(Python) | SMTP + Jinja 이메일 | 회원 탈퇴 증빙·파기 통보 | 06 |
| **phonenumbers** | 라이브러리(Python) | 전화번호 정규화 (`stores.phone` NATIONAL 형식) | `StoreService.update_store` | 11 |

---

## 6. Backend — 캐시·로깅·모니터링

| 이름 | 종류 | 설명 | 적용 위치 | ref |
|------|------|------|---------|----|
| **Redis 7** | 인프라 | 캐시 + 잡 큐 브로커 + Rate Limit 카운터 | `09_service_design.md` §11 `redis` 컨테이너 | 07 |
| **redis-py (async)** | 라이브러리(Python) | Redis 클라이언트 (Service 계층 명시 키 호출) | 모든 Service 캐시 호출 | 07 |
| **structlog** | 라이브러리(Python) | 구조화 JSON 로깅 (`request_id`·`user_id`·`store_id` contextvars) | BE 전체 로그 | 07 |
| **asgi-correlation-id** | 라이브러리(Python) | ASGI 미들웨어 — `X-Request-ID` 처리·UUID 생성 | `09_service_design.md` §10 미들웨어 | 07 |
| **sentry-sdk[fastapi]** | 라이브러리(Python) | 에러·성능 추적 (PII scrubbing·`traces_sample_rate=0.1`) | BE 진입·예외 핸들러 | 07 |

---

## 7. Backend — 비동기·잡 큐·파이프라인

| 이름 | 종류 | 설명 | 적용 위치 | ref |
|------|------|------|---------|----|
| **FastAPI BackgroundTasks** | 라이브러리(Python·FastAPI 내장) | 짧은 후처리 (1~3초) | 응답 후 로깅·캐시 무효화 | 08 |
| **ARQ** | 라이브러리(Python) | Redis 기반 async 잡 큐 + cron_jobs (소비기한 일일 점검·단가 일괄 갱신 등) | `09_service_design.md` §11 `arq-worker` 컨테이너 | 08 |
| **n8n** | 인프라(서비스) | AI 파이프라인 GUI 오케스트레이션 — 외부 API 수집·AI Server 호출·재시도 | `09_service_design.md` §11 `n8n` 컨테이너 | 08 |
| **fastapi-limiter** | 라이브러리(Python) | Redis 기반 Rate Limit | `09_service_design.md` §10.4 인증·알림 endpoint | 09 |

---

## 8. Backend — 테스트·코드 품질·미들웨어

| 이름 | 종류 | 설명 | 적용 위치 | ref |
|------|------|------|---------|----|
| **pytest** | 라이브러리(Python) | 테스트 러너 | `tests/` | 09 |
| **pytest-asyncio** | 라이브러리(Python) | async fixture·코루틴 테스트 (`mode=auto`) | 동상 | 09 |
| **pytest-cov** | 라이브러리(Python) | branch coverage (MVP 60%·핵심 모듈 80%) | CI | 09 |
| **factory_boy** | 라이브러리(Python) | SQLAlchemy·Pydantic 픽스처 | `tests/factories/` | 09 |
| **Faker** | 라이브러리(Python) | 더미 데이터 (`ko_KR` 로케일) | 동상 | 09 |
| **testcontainers-python** | 라이브러리(Python) | 통합 테스트용 실 MySQL·Redis 컨테이너 spawn | 통합 테스트 | 09 |
| **respx** | 라이브러리(Python) | httpx 호출 mock | 외부 API 단위 테스트 | 09 |
| **ruff** | 도구(Rust) | Python linter + formatter + import 정렬 + pyupgrade 통합 | pre-commit·CI | 09 |
| **mypy** | 도구(Python) | 정적 타입 검사 (`--strict` + `pydantic.mypy` + `sqlalchemy.ext.mypy_plugin`) | pre-commit·CI | 09 |
| **bandit** | 도구(Python) | 보안 정적 분석 | pre-commit·CI | 09 |
| **pip-audit** | 도구(Python) | 의존성 알려진 취약점 스캔 | pre-commit·CI | 09 |
| **pre-commit** | 도구(Python) | 커밋 훅 (ruff·mypy·bandit·pip-audit 일괄) | `.pre-commit-config.yaml` | 09 |
| **CORSMiddleware** | 라이브러리(Python·FastAPI 내장) | CORS (PWA 도메인 + dev `localhost:5173`) | `09_service_design.md` §10.2 | 09 |
| **TrustedHostMiddleware** | 라이브러리(Python·Starlette 내장) | Host 헤더 검증 | `09_service_design.md` §10.3 | 09 |

---

## 9. Backend — 의존성·컨테이너·배포·CI

| 이름 | 종류 | 설명 | 적용 위치 | ref |
|------|------|------|---------|----|
| **uv** | 도구(Rust) | Python 패키지·가상환경·빌드 통합 (`pyproject.toml` + `uv.lock`) | 로컬·CI | 10 |
| **Docker (Engine)** | 인프라 | 컨테이너 런타임 | BE·ARQ 워커·MySQL·Redis·n8n·Caddy | 10 |
| **Docker Compose V2** | 도구 | 6 서비스 멀티 컨테이너 정의 + 환경 override(staging·prod) | `docker-compose.yml` | 10 |
| **Buildx** | 도구 | 멀티 아키 이미지 빌드 (amd64 + arm64) | CI | 10 |
| **GitHub Actions** | 인프라(서비스) | CI/CD — uv sync → pre-commit → pytest → buildx → trivy → GHCR push | `.github/workflows/be.yml` | 10 |
| **Trivy** | 도구(Go) | 컨테이너 이미지 보안 스캔 (SARIF → GitHub Security) | CI | 10 |

---

## 10. Backend — 개발 편의 (BE 한정)

| 이름 | 종류 | 설명 | 적용 위치 | ref |
|------|------|------|---------|----|
| **ipython** | 라이브러리(Python) | 인터랙티브 REPL (자동완성·매직·히스토리) | dev 의존성 | 11 |
| **rich** | 라이브러리(Python) | dev 콘솔 출력 (structlog `ConsoleRenderer`와 결합) | dev 의존성 | 11 |

---

## 11. Frontend — 프레임워크·빌드·라우팅·상태

| 이름 | 종류 | 설명 | 적용 위치 | ref |
|------|------|------|---------|----|
| **React 19** | 라이브러리(TypeScript) | UI 프레임워크 — Actions·`use()`·React Compiler | FE 모든 화면 | fe 01 |
| **Vite 6** | 도구(JS) | dev esbuild HMR + prod Rollup 빌드 | FE 빌드·dev server | fe 01 |
| **React Router v7** | 라이브러리(TypeScript) | SPA 라우터 (declarative + data router, lazy import 코드 분할) | `src/routes/`·loader 가드 | fe 02 |
| **Zustand 5** | 라이브러리(TypeScript) | 클라이언트 상태 — auth(메모리·persist 금지) / preferences(persist) 물리적 분리 | `src/stores/auth.ts`·`src/stores/preferences.ts` | fe 02 |

---

## 12. Frontend — 서버 상태·HTTP·OpenAPI 코드젠

| 이름 | 종류 | 설명 | 적용 위치 | ref |
|------|------|------|---------|----|
| **TanStack Query v5** | 라이브러리(TypeScript) | 서버 상태 캐시·refetch·낙관적 업데이트·persistQueryClient(IndexedDB) | 모든 API 호출 hook | fe 03 |
| **ky 1.x** | 라이브러리(TypeScript) | fetch wrapper (~5KB) — `credentials: 'include'`·401 단일 refresh 인터셉터·내장 retry | `src/lib/http.ts` | fe 03 |
| **openapi-typescript 7.x** | 도구(JS) | BE FastAPI `/openapi.json` → `.d.ts` 타입 생성 (런타임 의존성 0) | `pnpm gen:api` → `src/types/api.d.ts` | fe 03 |

---

## 13. Frontend — UI·스타일·아이콘

| 이름 | 종류 | 설명 | 적용 위치 | ref |
|------|------|------|---------|----|
| **Tailwind CSS v4** | 라이브러리(JS·CSS 빌드 시 생성) | utility-first 스타일 (Lightning CSS·`@theme` 디자인 토큰·다크 모드) | FE 모든 컴포넌트 | fe 04 |
| **shadcn/ui** | 라이브러리(TypeScript·코드 보유) | Radix UI primitives + Tailwind 컴포넌트 (CLI로 코드 복사 — 패키지 의존성 없음) | `src/components/ui/` | fe 04 |
| **lucide-react** | 라이브러리(TypeScript) | 아이콘 (shadcn 표준 세트) | FE 전체 아이콘 | fe 04 |

---

## 14. Frontend — 폼·검증

| 이름 | 종류 | 설명 | 적용 위치 | ref |
|------|------|------|---------|----|
| **React Hook Form 7** | 라이브러리(TypeScript) | 비제어 폼 (re-render 최소·`useFieldArray`·shadcn `<Form>` 정합) | 온보딩·메뉴·재고·발주 폼 | fe 05 |
| **zod 3** | 라이브러리(TypeScript) | 스키마 검증 (`z.infer`·`z.discriminatedUnion`·`z.refine`·BE Pydantic v2 1:1 매핑) | `src/schemas/` | fe 05 |
| **@hookform/resolvers/zod** | 라이브러리(TypeScript) | RHF ↔ zod 어댑터 | `useForm({ resolver: zodResolver(schema) })` | fe 05 |

---

## 15. Frontend — PWA·Web Push·인앱 알림

| 이름 | 종류 | 설명 | 적용 위치 | ref |
|------|------|------|---------|----|
| **vite-plugin-pwa** | 도구(JS) | Vite 빌드 시 manifest·SW 자동 생성 (`injectManifest` 모드 — push·notificationclick 커스텀) | `vite.config.ts` `VitePWA({strategies:'injectManifest'})` | fe 06 |
| **Workbox** | 라이브러리(TypeScript·vite-plugin-pwa 내장) | precaching + 런타임 캐시 전략 (CacheFirst·StaleWhileRevalidate) | `src/sw.ts` | fe 06 |
| **PushManager / Notification (브라우저 표준)** | 표준 API | Web Push 구독·notificationclick 처리 (VAPID 공개 키 환경변수 inline) | `src/lib/web-push.ts`·`src/sw.ts` | fe 06 |
| **인앱 알림 폴링 정책** | 코드 정책 | TanStack Query `refetchInterval: 5분 고정` + `refetchIntervalInBackground: false` + 수동 새로고침 버튼 (사용자 설정 미노출) | `hooks/use-notifications.ts` | fe 06 |

---

## 16. Frontend — 차트

| 이름 | 종류 | 설명 | 적용 위치 | ref |
|------|------|------|---------|----|
| **Recharts 2.x** | 라이브러리(TypeScript) | React 컴포넌트형 차트 (SVG, 선·도넛·막대) — shadcn chart 통합 | 대시보드 7종 차트 | fe 07 |

---

## 16-1. Frontend — 에러 모니터링·관측가능성

| 이름 | 종류 | 설명 | 적용 위치 | ref |
|------|------|------|---------|----|
| **@sentry/react** | 라이브러리(TypeScript) | 브라우저 에러·성능 SDK — ErrorBoundary + React Router instrumentation + breadcrumb 자동 수집 | `src/lib/sentry.ts` + `<Sentry.ErrorBoundary>` | fe 11 |
| **@sentry/vite-plugin** | 도구(JS) | 빌드 시 소스맵 자동 업로드 + release 자동 태깅 + `deleteFilesAfterUpload`(public 노출 차단) | `vite.config.ts` | fe 11 |
| **Sentry (SaaS)** | 인프라(서비스) | BE 정합 에러·성능 SaaS — 동일 release(`git-<sha-short>`)로 BE↔FE 상관관계 | BE `sentry-sdk[fastapi]`와 동일 조직·프로젝트 | fe 11 + 07 |

---

## 17. Frontend — 테스트·코드 품질·타입 검사

| 이름 | 종류 | 설명 | 적용 위치 | ref |
|------|------|------|---------|----|
| **Vitest 2** | 라이브러리(TypeScript) | 테스트 러너 (Vite config 공유·esbuild·coverage v8) | 단위·통합 테스트 | fe 09 |
| **@testing-library/react 16** | 라이브러리(TypeScript) | 컴포넌트 테스트 (React 19·접근성 쿼리) | 컴포넌트 테스트 | fe 09 |
| **@testing-library/jest-dom** | 라이브러리(TypeScript) | DOM matcher (`toBeInTheDocument` 등) | 동상 | fe 09 |
| **@testing-library/user-event 14** | 라이브러리(TypeScript) | 사용자 이벤트 비동기 시뮬레이션 | 동상 | fe 09 |
| **MSW 2.x** | 라이브러리(TypeScript) | Service Worker(브라우저) + Node(`setupServer`) API mock | `src/test/msw/` | fe 09 |
| **Playwright (Node) 1.x** | 라이브러리(TypeScript) | E2E (Chromium 단일·BE Playwright와 엔진 공유) | `e2e/` 데모 시나리오 Step 1~6 | fe 09 |
| **Biome 1.x** | 도구(Rust) | 린터 + 포매터 + import 정렬 통합 (단일 도구) | pre-commit·CI | fe 09 |
| **prettier-plugin-tailwindcss** | 도구(JS) | Tailwind 클래스 정렬 보조 | `pnpm format:tw` | fe 09 |
| **tsc** | 도구(TypeScript) | 정적 타입 검사 (`tsc --noEmit`) | CI | fe 09 |
| **vite-plugin-checker** | 도구(JS) | dev 환경 tsc 실시간 검사 (Vite overlay) | `vite.config.ts` | fe 09 |

---

## 18. Frontend — 패키지·배포

| 이름 | 종류 | 설명 | 적용 위치 | ref |
|------|------|------|---------|----|
| **pnpm 9.x** | 도구(JS) | 패키지 매니저 (content-addressable store·`pnpm-lock.yaml`) | 로컬·CI | fe 10 |

---

## 19. 정합·교차 참조

### 19.1 BE ↔ FE 짝맞춤 항목

| BE | FE | 정합 지점 |
|----|----|---------|
| `pywebpush` + VAPID | `PushManager.subscribe` + `applicationServerKey` | VAPID 공개 키 환경변수 inline (`VITE_VAPID_PUBLIC_KEY`) |
| `Pydantic v2` 검증 | `zod 3` 스키마 | 동일 검증 규칙 1:1 — FE 1차 검증 + BE 2차 검증 |
| FastAPI `/openapi.json` | `openapi-typescript` 코드젠 | BE 스키마 변경 시 `pnpm gen:api` 재실행 (CI drift 검증) |
| `Authlib` BE OAuth 콜백 | FE 인가 URL 단순 redirect + 첫 진입 refresh | FE는 코드·토큰 미노출 |
| `python-jose` JWT Access Token | Zustand `useAuthStore.accessToken` (메모리만) | persist 절대 금지 — store 물리적 분리 |
| HttpOnly Cookie Refresh + `allow_credentials: True` | ky `credentials: 'include'` | CORS 정합 |
| `fastapi-limiter` `GET /api/notifications` 60/min | TanStack Query `refetchInterval: 5분 고정` (사용자 설정 미노출) | 한도 보호 + 수동 새로고침 버튼으로 즉시성 보완 |
| `sentry-sdk[fastapi]` (BE) | `@sentry/react` + `@sentry/vite-plugin` (FE) | 동일 Sentry 플랫폼·동일 release(`git-<sha-short>`) → BE↔FE 상관관계 |
| `Playwright (Python)` 쿠팡 자동화 | `Playwright (Node)` E2E | 같은 엔진·Chromium 단일 |
| `ruff` + `mypy` (BE) | `Biome` + `tsc` (FE) | 동등 위계 — pre-commit·CI 표준 |
| `pytest-cov` 60% (BE) | `Vitest coverage` 60% (FE) | 동일 목표 |
| `Docker Compose V2` 6 서비스 | `caddy` 컨테이너에 FE `dist/` 포함 | atomic 이미지 배포 |
| `GitHub Actions` BE 8단계 | FE 8단계 (`.github/workflows/fe.yml`) | 동등 위계 |

### 19.2 인프라 컨테이너 6종 (`09_service_design.md` §11.1)

| 컨테이너 | 이미지 | 역할 |
|---------|------|------|
| `be` | 자체 빌드 (Gunicorn + uvicorn.workers) | FastAPI BE 본체 |
| `arq-worker` | 자체 빌드 (`arq <module>.WorkerSettings`) | 잡 큐 + cron_jobs |
| `mysql` | `mysql:8` | DB |
| `redis` | `redis:7-alpine` | 캐시 + 잡 큐 브로커 + Rate Limit |
| `n8n` | `n8nio/n8n` | AI 파이프라인 오케스트레이션 |
| `caddy` | 자체 빌드 (`Dockerfile.caddy` — `caddy:2-alpine` + FE `dist/` COPY) | 리버스 프록시 + HTTPS + PWA 정적 서빙 |

> AI Server는 별도 배포 (`13_performance.md` §2.4).

---

## 20. ref 약어

| 약어 | 파일 |
|------|------|
| 01~14 | `docs/research/backend/01_*.md` ~ `14_*.md` |
| fe 01~10 | `docs/research/frontend/01_*.md` ~ `10_*.md` |
