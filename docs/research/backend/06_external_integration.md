# 외부 연동 (HTTP 클라이언트 · 브라우저 자동화 · 알림)

> **카테고리**: 외부 API 호출·재시도·차단기, 쿠팡 브라우저 자동화·정적 파싱, 알림 채널(Slack·Web Push·이메일·인앱) 라이브러리 결정
> **연결 spec**: `docs/spec/09_service_design.md` §1, `docs/spec/04_feature_spec.md` §9·§11, `docs/spec/12_security.md`

---

## 0. 카테고리 구성 & 결정 항목

| 하위 카테고리 | 후보 수 | 결정 항목 수 |
|------------|--------|------------|
| §1 HTTP 클라이언트 (재시도·차단기 포함) | 6 | 3 (HTTP 클라이언트 / 재시도 / 차단기) |
| §2 브라우저 자동화 (쿠팡) | 8 | 2 (자동화 본체 / 정적 파싱) |
| §3 알림 (Slack · Web Push · 이메일 · 인앱) | 8 | 4 (Slack / Web Push / 이메일 / 인앱) |
| §4 통합 결정 (spec 반영) | — | §4 참조 |

> 외부 공공 API(국세청·기상청·세담터·천문연·홍익대 학사일력 등)는 **호출 라이브러리**가 본 카테고리의 결정 대상이며 통신은 httpx로 통일된다. 어떤 API를 사용할지(데이터 소스 선택)는 ML 입력 변수 결정 사항으로 AI 영역.

### 본 research가 결정하는 라이브러리 (spec 반영)

| 라이브러리 | 카테고리 | 결정 근거 위치 | spec 반영 위치 |
|----------|---------|--------------|--------------|
| httpx | HTTP 클라이언트 | §1.2 + §1.4 | `09_service_design.md` §1 (기존) |
| tenacity | 재시도 | §1.2 + §1.4 | `09_service_design.md` §1 (신규) |
| aiobreaker | 차단기 | §1.2 + §1.4 | `09_service_design.md` §1 (신규) |
| Playwright | 브라우저 자동화 | §2.2 + §2.4 | `09_service_design.md` §1 (기존) |
| BeautifulSoup4 + lxml | 정적 파싱 | §2.2 + §2.4 | `09_service_design.md` §1 (신규) |
| slack_sdk | Slack 운영 알림 | §3.2 + §3.4 | `09_service_design.md` §1 (신규) |
| pywebpush | Web Push (점주) | §3.2 + §3.4 | `09_service_design.md` §1 (신규) + `08_schema.md` `push_subscriptions` 신설 |
| fastapi-mail | 이메일 (탈퇴 증빙) | §3.2 + §3.4 | `09_service_design.md` §1 (신규) |

> 인앱 알림(점주 푸시 동반)은 BE가 `notifications` 테이블에 INSERT하고 Frontend가 조회하는 흐름이며 별도 라이브러리 미사용. `08_schema.md` `notifications` 신설.

---

## 1. HTTP 클라이언트 · 재시도 · 차단기

### 1.1 전체 후보 목록

HTTP 클라이언트 3개 + 재시도 2개 + 차단기 1개 = **총 6개**.

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | httpx | HTTP 클라이언트 | async/sync 일체 |
| 2 | aiohttp | HTTP 클라이언트 | async-only |
| 3 | requests | HTTP 클라이언트 | sync-only |
| 4 | tenacity | 재시도 | 데코레이터·context 양식 |
| 5 | backoff | 재시도 | 데코레이터 |
| 6 | aiobreaker | 차단기 | async circuit breaker |

### 1.2 1차 벤치마크 — 필수 기능

| # | 후보 | async | HTTP/2 | 연결 풀·타임아웃 | FastAPI 통합 | requests API 호환 | 결과 |
|---|------|:-----:|:------:|:--------------:|:-----------:|:---------------:|:----|
| 1 | httpx | ◎ | O(옵션) | ◎ | ◎ | ◎ | ✅ **통과 (HTTP 클라이언트)** |
| 2 | aiohttp | ◎ | △ | O | O | ⛔(비표준 API) | ⛔ |
| 3 | requests | ⛔ | ⛔ | O | △(sync) | ◎ | ⛔ |

| # | 후보 | async·sync 양식 | 지수 백오프 | jitter | 재시도 조건(예외/응답) | 결과 |
|---|------|:-------------:|:----------:|:------:|:------------------:|:----|
| 4 | tenacity | ◎(decorator + context) | ◎ | ◎ | ◎(stop·wait·retry 분리) | ✅ **통과 (재시도)** |
| 5 | backoff | △(decorator만) | ◎ | O | △(예외 한정) | ⛔ |

| # | 후보 | async | 상태 관리 | half-open 회복 | 결과 |
|---|------|:-----:|:--------:|:------------:|:----|
| 6 | aiobreaker | ◎ | 메모리 | ◎ | ✅ **통과 (차단기)** |

### 1.3 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| async/await | **필수** | `02_app_server.md` §4.1 I/O bound, `09_service_design.md` §1 async 일관성 |
| 연결 풀·타임아웃 세밀 제어 | **필수** | AI Server / 국세청 / 외부 공공 API 호출 SLA 보장 |
| 지수 백오프 + jitter | **필수** | `04_feature_spec.md` §10 파이프라인 3회 재시도 |
| 차단기 half-open 회복 | **필수** | AI Server 다운 시 cascade 실패 방지 후 자동 회복 |
| FastAPI 통합 | **필수** | `01_web_framework.md` §4 결정과 정합 |

**탈락 사유:**

- **#2 aiohttp** — async 빠르나 API가 requests/httpx 표준에서 벗어남. 컨텍스트 매니저 강제·세션 모델 차이로 보일러플레이트 증가. httpx가 동일 async 성능 + requests 호환 API 제공해 우위.
- **#3 requests** — 동기 전용. 운영 API 경로(async) 부적합. Alembic 스크립트 등 sync 환경에서도 httpx의 sync 클라이언트(`httpx.Client`)로 통일 가능 → requests 추가 도입 가치 없음.
- **#5 backoff** — 데코레이터 양식만 지원. context manager 미지원으로 코드 블록 단위 재시도 표현 제약. tenacity가 동일 데코레이터 + context + 더 풍부한 조건(stop·wait·retry 분리)을 제공해 우위.

### 1.4 최종 선발

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **HTTP 클라이언트** | **httpx (async)** ✅ | `httpx.AsyncClient`로 AI Server·국세청·외부 공공 API 통합 호출. requests 호환 API로 sync 스크립트(Alembic·시드)는 `httpx.Client`로 단일 라이브러리 운영. 연결 풀·timeout(connect/read/write/pool 분리)·transport 커스텀(인터셉트) 지원 |
| **재시도** | **tenacity** ✅ | `@retry`·`Retrying`·`AsyncRetrying` 데코레이터·context 양식 일체. `stop_after_attempt(3)` + `wait_exponential_jitter(initial=1, max=10)` 패턴으로 `04_feature_spec.md` §10 "3회 재시도" 정확 매핑. retry 조건(예외 타입·HTTP 상태) 세밀 분리 |
| **차단기** | **aiobreaker** ✅ | async circuit breaker. `CLOSED → OPEN → HALF_OPEN` 자동 회복. AI Server 호출(`AIServerClient`)에 적용해 다운 시 빠른 503 반환, half-open 시점에 1건 시도 회복 |

---

## 2. 브라우저 자동화 (쿠팡)

### 2.1 전체 후보 목록

자동화 본체 5개 + 정적 파싱·크롤링 3개 = **총 8개**.

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | Playwright | 자동화 본체 | Microsoft, async API |
| 2 | Selenium | 자동화 본체 | 표준 WebDriver |
| 3 | Pyppeteer | 자동화 본체 | Puppeteer 포팅 |
| 4 | undetected-chromedriver | 봇 우회 | Selenium 확장 |
| 5 | playwright-stealth | 봇 우회 | Playwright 플러그인 |
| 6 | browserless | 분리 컨테이너 | Chromium 분리 |
| 7 | BeautifulSoup4 + lxml | 정적 파싱 | HTML 파서 |
| 8 | Scrapy | 크롤링 프레임워크 | throttling·파이프라인 |

### 2.2 1차 벤치마크 — 필수 기능

| # | 후보 | async API | auto-wait·셀렉터 | 네트워크 인터셉트 | Docker 친화 | 활발한 유지보수 | 결과 |
|---|------|:--------:|:--------------:|:--------------:|:----------:|:-----------:|:----|
| 1 | Playwright | ◎ | ◎ | ◎(`route`·`request`) | ◎(공식 이미지) | ◎(Microsoft) | ✅ **통과 (자동화 본체)** |
| 2 | Selenium | ⛔(sync 우선) | △ | △(별도 proxy) | O | O | ⛔ |
| 3 | Pyppeteer | △ | △ | O | △ | ⛔(유지보수 정체) | ⛔ |
| 4 | undetected-chromedriver | ⛔(sync) | — | — | △ | O | ⛔ |
| 5 | playwright-stealth | (플러그인) | — | — | — | △ | ⛔ |
| 6 | browserless | (분리) | — | — | ◎ | O | 🟡 **보존 (BE 이미지 크기 검토)** |

| # | 후보 | HTML 파서 | 표현력(CSS·XPath) | 가벼움 | Playwright 결합 | 결과 |
|---|------|:--------:|:---------------:|:------:|:--------------:|:----|
| 7 | BeautifulSoup4 + lxml | ◎ | ◎ | ◎(<10MB) | ◎(Playwright `content()` → BS4) | ✅ **통과 (정적 파싱)** |
| 8 | Scrapy | △(자체 selector) | O | ⛔(프레임워크 무거움) | △ | ⛔ |

### 2.3 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| async API | **필수** | `09_service_design.md` §1 async 일관성 |
| auto-wait · 셀렉터 | **필수** | 쿠팡 페이지 동적 렌더링·SPA 패턴 |
| 네트워크 인터셉트 | **필수** | 단가 조회 시 XHR 응답 직접 수집 가능 |
| Docker 친화 | **필수** | `02_app_server.md` 환경(Mac mini + Docker) |
| 봇 우회 | 사용 안 함 | 사주라는 점주 본인 계정 자동화 — 우회 불필요. 약관 위반 리스크 회피 |
| 정적 HTML 파싱 표현력 | 중요 | Playwright HTML을 BS4 셀렉터로 깔끔 파싱 |

**탈락 사유:**

- **#2 Selenium** — async 미지원이 결정적. 자료 풍부하나 Playwright의 안정성·셀렉터 표현력 우위가 명확. 사주라 BE async 일관성 깨짐.
- **#3 Pyppeteer** — 유지보수 거의 정체 (Puppeteer Python 비공식 포팅). Playwright가 동일 패턴 + Microsoft 공식 + 활발한 유지보수.
- **#4 undetected-chromedriver** — 봇 탐지 우회 도구. 사주라는 점주 본인 계정 자동화이므로 우회 불필요. 약관 위반 리스크.
- **#5 playwright-stealth** — 동일 사유. 봇 우회 미사용 정책.
- **#8 Scrapy** — 대량 크롤링 프레임워크. 사주라 단가 조회는 발주 품목당 1회로 빈도·규모 작아 과한 수준.

### 2.4 최종 선발

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **자동화 본체** | **Playwright (async, Chromium)** ✅ | `async_playwright()` + Chromium 단일 브라우저. auto-wait·셀렉터·네트워크 인터셉트 지원. `04_feature_spec.md` §9 쿠팡 자동화·단가 조회 표준 |
| **정적 파싱** | **BeautifulSoup4 + lxml** ✅ | Playwright `page.content()` HTML → `BeautifulSoup(html, 'lxml')` 셀렉터로 가벼운 파싱. lxml 파서가 빠르고 정확 |

> Firefox/WebKit 미사용. Chromium 단일로 운영 → Docker 이미지 크기 절감, 셀렉터 호환성 단일 검증.

### 2.5 보존 후보 (browserless)

browserless는 Chromium을 BE 컨테이너에서 분리하는 패턴으로, BE 이미지 크기·메모리 격리에 이점이 있다. 다만 MVP는 다음 사유로 단일 컨테이너 운영:
- Mac mini M2 Pro 16GB에서 Playwright 워커당 peak 700~900 MB로 컨테이너 분리 이점 작음(`02_app_server.md` §4.1)
- 운영 컨테이너 5개(BE/MySQL/Redis/n8n/Caddy)에 1개 추가는 운영 단순성 손해

**재평가 트리거:**

| 지표 | 임계치 |
|------|------|
| BE 이미지 크기 | > 2 GB |
| BE 컨테이너 메모리 peak | > 3 GB |
| Playwright 동시 호출 수 | ≥ 매장당 평균 5 req/min |

→ 2개 이상 1주 지속 시 browserless 분리 검토.

---

## 3. 알림 (Slack · Web Push · 이메일 · 인앱)

### 3.1 전체 후보 목록

Slack 2개 + 푸시 3개 + 이메일 2개 + 모바일 메시지 1개 = **총 8개**.

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | slack_sdk | Slack | 공식 SDK |
| 2 | slack-bolt | Slack | 양방향 봇 |
| 3 | FCM | 푸시 | Google Cloud Messaging |
| 4 | pywebpush | 푸시 | VAPID Web Push 표준 직접 구현 |
| 5 | OneSignal SDK | 푸시 | SaaS |
| 6 | fastapi-mail | 이메일 | SMTP 추상 |
| 7 | SendGrid / Mailgun SDK | 이메일 | 게이트웨이 SaaS |
| 8 | 카카오 알림톡 API | 모바일 메시지 | 한국 SMB 친숙 |

### 3.2 1차 벤치마크 — 필수 기능 (채널별)

**Slack** — 파이프라인 실패(개발팀) 알림 (`04_feature_spec.md` §11)

| # | 후보 | Webhook 단방향 | async | 운영 부담 | 결과 |
|---|------|:------------:|:-----:|:-------:|:----|
| 1 | slack_sdk | ◎ | ◎(AsyncWebhookClient) | 낮음 | ✅ **통과 (Slack)** |
| 2 | slack-bolt | (양방향) | O | 중간(앱 등록·이벤트 처리) | ⛔ (양방향 봇 불필요) |

**Web Push** — 점주 푸시 알림 (`04_feature_spec.md` §11, PWA)

| # | 후보 | VAPID 표준 | iOS Safari | Google 비종속 | 운영 부담 | 결과 |
|---|------|:--------:|:--------:|:----------:|:-------:|:----|
| 3 | FCM | (자체 토큰) | △ | ⛔ | 중간 | ⛔ |
| 4 | pywebpush | ◎ | O(16.4+) | ◎ | 낮음(라이브러리 + VAPID 키) | ✅ **통과 (Web Push)** |
| 5 | OneSignal | △(자체 SDK) | O | ⛔(SaaS) | 매니지드 | ⛔ |

**이메일** — 회원 탈퇴 증빙·파기 통보 (`12_security.md` §8)

| # | 후보 | SMTP 추상 | Jinja 템플릿 | FastAPI 통합 | MVP 비용 | 결과 |
|---|------|:--------:|:-----------:|:-----------:|:-------:|:----|
| 6 | fastapi-mail | ◎ | ◎ | ◎ | 0 (SMTP) | ✅ **통과 (이메일)** |
| 7 | SendGrid / Mailgun | (게이트웨이) | △ | △ | 유료 | ⛔ (MVP 발송량 작음) |

**모바일 메시지** — 알림톡

| # | 후보 | 결과 |
|---|------|:----|
| 8 | 카카오 알림톡 | 🟡 **보존 (운영 정착 시 검토)** |

### 3.3 판정 기준 및 탈락 사유

| 채널 | 필수도 | 근거 |
|------|-------|------|
| Slack (개발팀) | **필수** | `04_feature_spec.md` §11 파이프라인 실패 알림 |
| Web Push (점주) | **필수** | `04_feature_spec.md` §11 + `03_mvp_scope.md` §3 "앱 내 알림(푸시 + 인앱)" |
| 이메일 (탈퇴 증빙) | **필수** | `12_security.md` §8 "파기 완료 시 이메일로 증빙 발송" |
| 인앱 알림 (점주) | **필수** | `04_feature_spec.md` §11 |
| 카카오 알림톡 | 사용 안 함 (MVP) | 비용·심사 부담. PWA Web Push로 모바일 즉시성 일부 대체 |

**탈락 사유:**

- **#2 slack-bolt** — 양방향 봇(슬래시 커맨드·인터랙티브)이 강점이나 사주라는 단방향 실패 알림만 사용. slack_sdk + Webhook으로 충분.
- **#3 FCM** — Google 종속(서비스 계정 키), iOS Web Push 지원 변동. PWA 환경에선 VAPID 표준 직접 사용이 자유도 우위.
- **#5 OneSignal** — SaaS 매니지드 편의는 있으나 외부 의존·비용·개인정보 처리 동의 별도 필요. pywebpush가 1인 운영 환경에 더 적합.
- **#7 SendGrid/Mailgun** — 도달율·통계 강점이나 MVP 이메일 발송량(탈퇴 증빙·파기 통보로 한정)이 매우 작아 SMTP 충분. 비용 회피.
- **#8 카카오 알림톡** — 도달율 높으나 비즈니스 채널 계약·템플릿 사전 심사·메시지당 비용 발생. MVP는 PWA Web Push로 모바일 즉시성 일부 대체.

### 3.4 최종 선발

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **Slack 운영 알림** | **slack_sdk** ✅ | `slack_sdk.webhook.async_client.AsyncWebhookClient` 단방향 Webhook으로 파이프라인 실패 알림. async 호환 |
| **Web Push (점주)** | **pywebpush** ✅ | VAPID 표준 직접 구현. Google 비종속·SaaS 비종속. iOS Safari 16.4+ 지원. 라이브러리 + VAPID 공개/비밀 키 쌍 + `push_subscriptions` 테이블로 운영 |
| **이메일** | **fastapi-mail** ✅ | SMTP 기반·FastAPI 친화 인터페이스·Jinja 템플릿. 탈퇴 증빙·파기 통보 메일에 충분 |
| **인앱 알림** | (라이브러리 없음) | BE Service가 `notifications` 테이블에 INSERT, Frontend가 `GET /api/notifications`로 조회 |

### 3.5 알림 발송 흐름 (확정)

> 알림 도메인은 BE에 응집된다. `NotificationService.create_and_push`(`09_service_design.md` §4)가 인앱(`notifications` INSERT) + Web Push(pywebpush)를 일관 처리한다. n8n은 AI 파이프라인 종료 시점에 BE API를 호출하여 알림을 트리거할 뿐, DB 직접 INSERT를 수행하지 않는다.

| 알림 상황 | 트리거 | 처리 |
|---------|------|------|
| 이상치 5% 이상 감지 | BE `SaleService` (CSV 업로드 처리 시점) | `NotificationService.create_and_push` 호출 |
| 재고 부족 ("재고 확인 필요") | BE `InventoryService` (FIFO 차감 후) | `NotificationService.create_and_push` 호출 |
| 소비기한 D-3 / D-1 / 초과 | BE `InventoryService.check_expiry_batch` (ARQ cron 매일 02:00) | `NotificationService.create_and_push` 호출 |
| 예측 완료 + 추천발주안 생성 | n8n AI 파이프라인 종료 시 BE 내부 API 호출 | BE가 `NotificationService.create_and_push` 호출 |
| 파이프라인 단계 실패 (3회 재시도 후) | n8n | slack_sdk Webhook (개발팀 채널) — BE 경유하지 않음 (개발팀 알림이라 도메인 무관) |
| 회원 탈퇴 30일 유예 후 파기 증빙 | BE `AuthService` ARQ 예약 작업 | fastapi-mail SMTP |

> 핵심 원칙:
> - **점주 대상 알림**(인앱·Web Push)은 항상 BE `NotificationService.create_and_push`로 일관 처리
> - **개발팀 알림**(Slack)만 n8n에서 직접 발송 — AI 파이프라인 실패 알림은 BE 도메인과 무관
> - n8n은 DB `notifications` 테이블을 직접 INSERT하지 않는다 (`08_schema.md` §5 n8n_user 권한)

### 3.6 보존 후보 (카카오 알림톡)

**재평가 트리거:**

| 지표 | 임계치 |
|------|------|
| Web Push 구독률 | < 30% (점주 중) |
| Web Push 도달율 (전송 → 클릭) | < 10% |
| 매장 수 | ≥ 300 (2단계) |

→ 2개 이상 발생 시 카카오 알림톡 도입 검토. 비즈니스 채널 등록·템플릿 심사 절차 필요.

---

## 4. 통합 최종 결정 (spec 반영)

본 research가 결정한 라이브러리는 `09_service_design.md` §1에 반영된다. 라이브러리 채택에 따라 필요해진 schema·API·서비스 정의는 각 spec 파일에서 정의된다 — 본 문서는 영향 범위만 명시한다.

### 4.1 라이브러리 결정 (6개 신규 + 2개 기존)

| 라이브러리 | 역할 | spec 반영 위치 |
|----------|------|--------------|
| **tenacity** | 외부 API 호출 재시도. `stop_after_attempt(3)` + `wait_exponential_jitter` | `09_service_design.md` §1 |
| **aiobreaker** | AI Server 호출 차단기. CLOSED→OPEN→HALF_OPEN 자동 회복 | `09_service_design.md` §1 |
| **BeautifulSoup4 (lxml 파서)** | Playwright `page.content()` HTML 파싱 | `09_service_design.md` §1 |
| **slack_sdk** | 파이프라인 실패 알림. `AsyncWebhookClient` 단방향 | `09_service_design.md` §1 |
| **pywebpush** | 점주 Web Push 알림. VAPID 표준 | `09_service_design.md` §1 |
| **fastapi-mail** | 탈퇴 증빙·파기 통보 이메일 (SMTP + Jinja) | `09_service_design.md` §1 |
| `httpx` (기존) | AI Server·국세청·외부 공공 API + sync 스크립트 | `09_service_design.md` §1 |
| `Playwright (async)` (기존) | 쿠팡 자동화·단가 조회 | `09_service_design.md` §1 |

### 4.2 결정에 따라 spec에서 정의되는 항목 (참조)

| 영향 영역 | 정의 위치 |
|---------|---------|
| `notifications` 테이블 (인앱 알림 저장) | `08_schema.md` §3.22 |
| `push_subscriptions` 테이블 (VAPID 구독 정보) | `08_schema.md` §3.23 |
| n8n_user 권한 — `notifications` SELECT/INSERT | `08_schema.md` §5 |
| 알림 5개 endpoint (구독 등록/해제·목록 조회·읽음 처리) | `07_api_spec.md` §10 |
| `NotificationService` 클래스·메서드 | `09_service_design.md` §3·§4 |

> 본 research는 라이브러리 결정·운영 흐름 합의의 source-of-truth다. DB 컬럼·API 계약·서비스 시그니처는 spec이 source-of-truth이며 본 문서가 중복 정의하지 않는다.

---

## 5. 후보 세부 정보

### 5.1 httpx ✅
- **사용처**: `AIServerClient` · 국세청 진위확인 · 외부 공공 API · sync 스크립트(Alembic·시드, `httpx.Client`)
- **장점**: requests 호환 API, async/sync 동시, HTTP/2 옵션, 연결 풀·타임아웃 세밀 제어(`connect`/`read`/`write`/`pool` 분리), transport 커스텀(인터셉트·로그)
- **단점**: 매우 큰 동시성에서는 aiohttp 대비 약간 느림(사주라 RPS 가정에서 무의미)
- **세부사항**: 라이선스 BSD. `httpx.AsyncClient` + `Limits(max_connections=, max_keepalive_connections=)`

### 5.2 tenacity ✅
- **사용처**: 외부 API 호출 재시도. `AIServerClient`·`SiteScrapingService`·국세청
- **장점**: 데코레이터 + context 양식 일체, `stop_after_attempt`·`wait_exponential_jitter`·`retry_if_exception_type`·`retry_if_result` 등 풍부한 조건, async 1급(`AsyncRetrying`)
- **단점**: 단순 재시도에는 다소 무거울 수 있음 (사주라는 다양한 조건 필요해 무관)
- **세부사항**: 라이선스 Apache 2.0. `pip install tenacity`

### 5.3 aiobreaker ✅
- **사용처**: AI Server 호출 차단기. `AIServerClient.call_with_breaker`
- **장점**: async circuit breaker, 메모리 상태(`CLOSED`/`OPEN`/`HALF_OPEN`), 자동 회복, 예외 필터링
- **단점**: 단일 노드 메모리 상태(분산 시 Redis 기반 구현 필요 — 사주라 단일 BE 노드라 무관)
- **세부사항**: 라이선스 MIT. `pip install aiobreaker`

### 5.4 Playwright (async) ✅
- **사용처**: 쿠팡 장바구니 자동 담기·단가 조회
- **장점**: Chromium·Firefox·WebKit 통합 제어, auto-wait·셀렉터 강력, 네트워크 인터셉트·trace 디버깅, async API, 공식 Docker 이미지 `mcr.microsoft.com/playwright/python`
- **단점**: 컨테이너 이미지 크기 큼(Chromium 200MB+), 쿠팡 셀렉터 변경 시 깨짐 → `04_feature_spec.md` §7.2 재시도 없음·즉시 수동 안내 정책
- **세부사항**: 라이선스 Apache 2.0. Microsoft. `playwright install chromium` 필요

### 5.5 BeautifulSoup4 + lxml ✅
- **사용처**: Playwright `page.content()` HTML → 쿠팡 단가·재고 표시 셀렉터 파싱
- **장점**: 가벼움(<10MB), 표현력 풍부(CSS·find·XPath via lxml), 안정적 표준
- **단점**: 동적 페이지 단독 처리 불가 → Playwright와 결합 사용
- **세부사항**: BeautifulSoup4 MIT, lxml BSD

### 5.6 slack_sdk ✅
- **사용처**: 파이프라인 실패 알림. n8n이 Webhook URL로 단방향 POST
- **장점**: 공식 SDK, Block Kit·Webhook·Web API 모두 지원, async 클라이언트(`AsyncWebhookClient`)
- **단점**: 양방향 봇은 별도 (사주라는 단방향 사용)
- **세부사항**: 라이선스 MIT

### 5.7 pywebpush ✅
- **사용처**: 점주 PWA Web Push 알림
- **장점**: VAPID 표준 직접 구현 (Google 비종속), iOS Safari 16.4+ 지원, 라이브러리 가벼움
- **단점**: 토큰 만료·구독 갱신 직접 처리 (만료 endpoint 410 → `push_subscriptions` 삭제)
- **세부사항**: 라이선스 MIT. VAPID 공개/비밀 키 쌍 발급 후 환경변수로 주입

### 5.8 fastapi-mail ✅
- **사용처**: 회원 탈퇴 증빙·파기 통보 메일
- **장점**: FastAPI 친화 인터페이스, Jinja 템플릿, async 발송, SMTP 표준
- **단점**: 게이트웨이(SendGrid/Mailgun) 직접 통합은 별도
- **세부사항**: 라이선스 MIT

### 5.9 browserless 🟡 (보존)
- **사용처**: Chromium 분리 컨테이너
- **장점**: BE 이미지 가벼움, 동시 세션 제어·queue 제공
- **단점**: 별도 서비스 운영 부담, 라이선스 정책 변경 이력
- **세부사항**: Apache 2.0 / 상용 혼합

### 5.10 카카오 알림톡 🟡 (보존)
- **사용처**: 운영 정착 시 점주 모바일 메시지 즉시성 강화
- **장점**: 도달율 높음, 비즈니스 메시지 신뢰
- **단점**: 비즈니스 채널 계약·템플릿 사전 심사·메시지당 비용
- **세부사항**: 카카오 비즈메시지 또는 솔라피·NHN Cloud Notification 등 중개사 경유

### 5.11 탈락 후보 요약

| 후보 | 분류 | 탈락 사유 |
|------|------|---------|
| aiohttp | HTTP | httpx 우위 (API 표준·sync 호환·생태계) |
| requests | HTTP | sync 전용 — httpx.Client로 대체 가능 |
| backoff | 재시도 | tenacity 우위 (context manager + 풍부한 조건) |
| Selenium | 자동화 | async 미지원·Playwright 안정성 열위 |
| Pyppeteer | 자동화 | 유지보수 정체 |
| undetected-chromedriver | 봇 우회 | 우회 불필요·약관 위반 리스크 |
| playwright-stealth | 봇 우회 | 동일 사유 |
| Scrapy | 크롤링 | 대량 크롤링 프레임워크 — MVP 단가 조회 규모에 과함 |
| slack-bolt | Slack | 양방향 봇 불필요 |
| FCM | 푸시 | Google 종속·iOS Web Push 변동 |
| OneSignal | 푸시 | SaaS 비용·외부 의존 |
| SendGrid / Mailgun | 이메일 | SMTP로 충분 — MVP 발송량 작음 |

---

## 6. 비교 요약 표

| 분류 | 후보 | 결과 | 핵심 사유 |
|------|------|------|---------|
| HTTP 클라이언트 | httpx | ✅ | async/sync·HTTP/2·requests 호환 |
| HTTP 클라이언트 | aiohttp / requests | ⛔ | API 비표준 / sync 전용 |
| 재시도 | tenacity | ✅ | 데코레이터 + context + 풍부한 조건 |
| 재시도 | backoff | ⛔ | context 미지원·조건 한정 |
| 차단기 | aiobreaker | ✅ | async·HALF_OPEN 회복 |
| 자동화 본체 | Playwright (Chromium) | ✅ | async·auto-wait·네트워크 인터셉트 |
| 자동화 본체 | Selenium / Pyppeteer | ⛔ | async 미지원 / 유지보수 정체 |
| 봇 우회 | undetected / stealth | ⛔ | 우회 불필요·약관 위반 |
| 컨테이너 분리 | browserless | 🟡 보존 | BE 이미지 크기 트리거 |
| 정적 파싱 | BeautifulSoup4 + lxml | ✅ | 가벼움·표현력 |
| 크롤링 | Scrapy | ⛔ | MVP 규모 초과 |
| Slack | slack_sdk | ✅ | Webhook 단방향·async |
| Slack | slack-bolt | ⛔ | 양방향 봇 불필요 |
| Web Push | pywebpush | ✅ | VAPID 표준·Google 비종속 |
| Web Push | FCM / OneSignal | ⛔ | Google 종속 / SaaS 의존 |
| 이메일 | fastapi-mail | ✅ | SMTP·FastAPI 친화·Jinja |
| 이메일 | SendGrid / Mailgun | ⛔ | 게이트웨이 비용 — SMTP로 충분 |
| 모바일 메시지 | 카카오 알림톡 | 🟡 보존 | Web Push 구독률·도달율 트리거 |
