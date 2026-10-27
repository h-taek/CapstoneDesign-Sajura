# 외부 연동 (HTTP 클라이언트 · 브라우저 자동화 · 알림)

> **카테고리**: 외부 API 호출·재시도·차단기, 쿠팡 브라우저 자동화·정적 파싱, 알림 채널(Slack·Web Push·이메일·인앱) 라이브러리 비교
> **연결 spec**: `docs/spec/03_be.md` §1, `docs/spec/01_basic_design.md` §3.10·§3.12, `docs/spec/03_be.md`

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

| # | 후보 | async | HTTP/2 | 연결 풀·타임아웃 | FastAPI 통합 | requests API 호환 |
|---|------|:-----:|:------:|:--------------:|:-----------:|:---------------:|
| 1 | httpx | ◎ | O(옵션) | ◎ | ◎ | ◎ |
| 2 | aiohttp | ◎ | △ | O | O | X(비표준 API) |
| 3 | requests | X | X | O | △(sync) | ◎ |

| # | 후보 | async·sync 양식 | 지수 백오프 | jitter | 재시도 조건(예외/응답) |
|---|------|:-------------:|:----------:|:------:|:------------------:|
| 4 | tenacity | ◎(decorator + context) | ◎ | ◎ | ◎(stop·wait·retry 분리) |
| 5 | backoff | △(decorator만) | ◎ | O | △(예외 한정) |

| # | 후보 | async | 상태 관리 | half-open 회복 |
|---|------|:-----:|:--------:|:------------:|
| 6 | aiobreaker | ◎ | 메모리 | ◎ |

### 1.3 후보별 차이

- aiohttp — async를 지원하나 API가 requests/httpx 표준과 다르다. 컨텍스트 매니저 사용이 강제되고 세션 모델이 달라 보일러플레이트가 늘어난다.
- requests — 동기 전용이다. httpx는 sync 클라이언트(`httpx.Client`)를 함께 제공한다.
- backoff — 데코레이터 양식만 지원하고 context manager를 지원하지 않는다. tenacity는 데코레이터·context 양식과 stop·wait·retry 분리 조건을 함께 제공한다.

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

| # | 후보 | async API | auto-wait·셀렉터 | 네트워크 인터셉트 | Docker 친화 | 활발한 유지보수 |
|---|------|:--------:|:--------------:|:--------------:|:----------:|:-----------:|
| 1 | Playwright | ◎ | ◎ | ◎(`route`·`request`) | ◎(공식 이미지) | ◎(Microsoft) |
| 2 | Selenium | X(sync 우선) | △ | △(별도 proxy) | O | O |
| 3 | Pyppeteer | △ | △ | O | △ | X(유지보수 정체) |
| 4 | undetected-chromedriver | X(sync) | — | — | △ | O |
| 5 | playwright-stealth | (플러그인) | — | — | — | △ |
| 6 | browserless | (분리) | — | — | ◎ | O |

| # | 후보 | HTML 파서 | 표현력(CSS·XPath) | 가벼움 | Playwright 결합 |
|---|------|:--------:|:---------------:|:------:|:--------------:|
| 7 | BeautifulSoup4 + lxml | ◎ | ◎ | ◎(<10MB) | ◎(Playwright `content()` → BS4) |
| 8 | Scrapy | △(자체 selector) | O | X(프레임워크 무거움) | △ |

### 2.3 후보별 차이

- Selenium — async를 지원하지 않는다(sync 우선). 네트워크 인터셉트에 별도 proxy가 필요하다.
- Pyppeteer — Puppeteer의 비공식 Python 포팅이며 유지보수가 정체돼 있다.
- undetected-chromedriver, playwright-stealth — 봇 탐지 우회 도구다. 쿠팡 약관 위반 소지가 있다.
- Scrapy — 대량 크롤링용 프레임워크이며 자체 selector를 쓴다.

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

**Slack**

| # | 후보 | Webhook 단방향 | async | 운영 부담 |
|---|------|:------------:|:-----:|:-------:|
| 1 | slack_sdk | ◎ | ◎(AsyncWebhookClient) | 낮음 |
| 2 | slack-bolt | (양방향) | O | 중간(앱 등록·이벤트 처리) |

**Web Push**

| # | 후보 | VAPID 표준 | iOS Safari | Google 비종속 | 운영 부담 |
|---|------|:--------:|:--------:|:----------:|:-------:|
| 3 | FCM | (자체 토큰) | △ | X | 중간 |
| 4 | pywebpush | ◎ | O(16.4+) | ◎ | 낮음(라이브러리 + VAPID 키) |
| 5 | OneSignal | △(자체 SDK) | O | X(SaaS) | 매니지드 |

**이메일**

| # | 후보 | SMTP 추상 | Jinja 템플릿 | FastAPI 통합 | 비용 |
|---|------|:--------:|:-----------:|:-----------:|:-------:|
| 6 | fastapi-mail | ◎ | ◎ | ◎ | 0 (SMTP) |
| 7 | SendGrid / Mailgun | (게이트웨이) | △ | △ | 유료 |

### 3.3 후보별 차이

- slack-bolt — 양방향 봇(슬래시 커맨드·인터랙티브)용이며 앱 등록·이벤트 처리가 필요하다. 단방향 Webhook은 slack_sdk로 보낼 수 있다.
- FCM — Google 서비스 계정 키에 종속되고 자체 토큰을 쓴다. iOS Web Push 지원이 변동돼 왔다.
- OneSignal — SaaS 매니지드 서비스로 자체 SDK를 쓴다. 외부 의존·비용이 생기고 개인정보 처리 동의가 별도로 필요하다.
- SendGrid·Mailgun — 도달률·통계를 제공하는 유료 게이트웨이다.
- 카카오 알림톡 — 도달률이 높으나 비즈니스 채널 계약과 템플릿 사전 심사가 필요하고 메시지당 비용이 든다.

---

## 4. 후보 세부 정보

### 4.1 httpx
- **장점**: requests 호환 API, async/sync 동시, HTTP/2 옵션, 연결 풀·타임아웃 세밀 제어(`connect`/`read`/`write`/`pool` 분리), transport 커스텀(인터셉트·로그)
- **단점**: 매우 큰 동시성에서는 aiohttp 대비 약간 느림
- **세부사항**: 라이선스 BSD. `httpx.AsyncClient` + `Limits(max_connections=, max_keepalive_connections=)`

### 4.2 tenacity
- **장점**: 데코레이터 + context 양식 일체, `stop_after_attempt`·`wait_exponential_jitter`·`retry_if_exception_type`·`retry_if_result` 등 풍부한 조건, async 1급(`AsyncRetrying`)
- **단점**: 단순 재시도에는 다소 무거울 수 있음
- **세부사항**: 라이선스 Apache 2.0. `pip install tenacity`

### 4.3 aiobreaker
- **장점**: async circuit breaker, 메모리 상태(`CLOSED`/`OPEN`/`HALF_OPEN`), 자동 회복, 예외 필터링
- **단점**: 단일 노드 메모리 상태(분산 시 Redis 기반 구현 필요)
- **세부사항**: 라이선스 MIT. `pip install aiobreaker`

### 4.4 Playwright (async)
- **장점**: Chromium·Firefox·WebKit 통합 제어, auto-wait·셀렉터 강력, 네트워크 인터셉트·trace 디버깅, async API, 공식 Docker 이미지 `mcr.microsoft.com/playwright/python`
- **단점**: 컨테이너 이미지 크기 큼(Chromium 200MB+), 대상 사이트 셀렉터 변경 시 깨짐
- **세부사항**: 라이선스 Apache 2.0. Microsoft. `playwright install chromium` 필요

### 4.5 BeautifulSoup4 + lxml
- **장점**: 가벼움(<10MB), 표현력 풍부(CSS·find·XPath via lxml), 안정적 표준
- **단점**: 동적 페이지 단독 처리 불가 → Playwright와 결합 사용
- **세부사항**: BeautifulSoup4 MIT, lxml BSD

### 4.6 slack_sdk
- **장점**: 공식 SDK, Block Kit·Webhook·Web API 모두 지원, async 클라이언트(`AsyncWebhookClient`)
- **단점**: 양방향 봇은 별도
- **세부사항**: 라이선스 MIT

### 4.7 pywebpush
- **장점**: VAPID 표준 직접 구현 (Google 비종속), iOS Safari 16.4+ 지원, 라이브러리 가벼움
- **단점**: 토큰 만료·구독 갱신 직접 처리 (만료 endpoint는 410 응답)
- **세부사항**: 라이선스 MIT. VAPID 공개/비밀 키 쌍 필요

### 4.8 fastapi-mail
- **장점**: FastAPI 친화 인터페이스, Jinja 템플릿, async 발송, SMTP 표준
- **단점**: 게이트웨이(SendGrid/Mailgun) 직접 통합은 별도
- **세부사항**: 라이선스 MIT

### 4.9 browserless
- **장점**: Chromium을 BE 컨테이너에서 분리해 BE 이미지 가벼움·메모리 격리, 동시 세션 제어·queue 제공
- **단점**: 별도 서비스 운영 부담, 라이선스 정책 변경 이력
- **세부사항**: Apache 2.0 / 상용 혼합

### 4.10 카카오 알림톡
- **장점**: 도달율 높음, 비즈니스 메시지 신뢰
- **단점**: 비즈니스 채널 계약·템플릿 사전 심사·메시지당 비용
- **세부사항**: 카카오 비즈메시지 또는 솔라피·NHN Cloud Notification 등 중개사 경유

---

## 5. 비교 요약 표

| 분류 | 후보 | 특징 |
|------|------|------|
| HTTP 클라이언트 | httpx | async/sync·HTTP/2·requests 호환 API |
| HTTP 클라이언트 | aiohttp / requests | 비표준 API / sync 전용 |
| 재시도 | tenacity | 데코레이터 + context·stop/wait/retry 분리 조건 |
| 재시도 | backoff | 데코레이터 전용·예외 조건 한정 |
| 차단기 | aiobreaker | async·HALF_OPEN 자동 회복 |
| 자동화 본체 | Playwright | async·auto-wait·네트워크 인터셉트 |
| 자동화 본체 | Selenium / Pyppeteer | sync 우선 / 유지보수 정체 |
| 봇 우회 | undetected-chromedriver / playwright-stealth | 봇 탐지 우회·약관 위반 소지 |
| 컨테이너 분리 | browserless | Chromium 분리·동시 세션 queue |
| 정적 파싱 | BeautifulSoup4 + lxml | 10MB 미만·CSS/XPath |
| 크롤링 | Scrapy | 대량 크롤링 프레임워크 |
| Slack | slack_sdk | Webhook 단방향·async 클라이언트 |
| Slack | slack-bolt | 양방향 봇 |
| Web Push | pywebpush | VAPID 표준·Google 비종속 |
| Web Push | FCM / OneSignal | Google 종속 / SaaS |
| 이메일 | fastapi-mail | SMTP·FastAPI 친화·Jinja |
| 이메일 | SendGrid / Mailgun | 유료 게이트웨이 |
| 모바일 메시지 | 카카오 알림톡 | 채널 계약·템플릿 심사·메시지당 비용 |
