# 에러 모니터링·관측가능성 (FE)

> **카테고리**: FE 측 에러·성능 추적 도구, Sentry SDK 옵션, 소스맵 업로드, 이벤트 한도 조사
> **연결 spec**: `03_be.md` §14.4 (BE Sentry·구조화 로깅), `03_be.md` §1 sentry-sdk[fastapi] 행
> **연결 research**: `docs/research/backend/07_cache_observability.md` §3 (BE Sentry 비교)

---

## 1. 에러 모니터링 SaaS

### 1.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | Sentry | 에러·성능·release | React 1급 |
| 2 | LogRocket | 세션 리플레이 중심 | 세션 영상 — PII 리스크 큼 |
| 3 | Bugsnag | 에러 중심 | 마인드셰어 작음 |
| 4 | Rollbar | 에러 중심 | 동상 |
| 5 | 자체 구축 (structlog/Loki/Grafana) | 인프라 | 직접 운영 |

### 1.2 1차 벤치마크 — 필수 기능

| # | 후보 | React 1급 SDK | Source map 업로드 | PII scrubbing | 무료 한도 | 마인드셰어 |
|---|------|:---:|:---:|:---:|:---:|:---:|
| 1 | Sentry | ◎ (`@sentry/react`·`ErrorBoundary`·React Router 통합) | ◎ (`@sentry/vite-plugin`) | ◎ (`beforeSend`·`sendDefaultPii`) | △ (5k events/월) | ◎ |
| 2 | LogRocket | ◎ | △ | X (세션 영상 자체가 PII 위험) | △ | O |
| 3 | Bugsnag | O | O | O | △ | △ |
| 4 | Rollbar | O | O | O | △ | △ |
| 5 | 자체 구축 | — | — | — | — | X |

### 1.3 후보별 차이

- LogRocket — 세션 영상이 사용자 화면을 그대로 캡처해 화면에 보이는 이메일·매장명·매출 데이터가 영상에 담긴다.
- Bugsnag·Rollbar — 에러 추적 기능은 갖췄다. BE와 다른 SaaS를 쓰면 release 태깅·이벤트 상관관계를 한 곳에서 볼 수 없다.
- 자체 구축 — Loki·Grafana·Tempo 등을 직접 운영해야 한다.

---

## 2. Sentry FE SDK

### 2.1 라이브러리

| 라이브러리 | 역할 |
|----------|------|
| `@sentry/react` | 브라우저 에러·성능 SDK + ErrorBoundary + React Router instrumentation |
| `@sentry/vite-plugin` | 빌드 시 소스맵 자동 업로드 + release 자동 생성·태깅 |

### 2.2 주요 옵션

| 옵션 | 동작 |
|------|------|
| `sendDefaultPii` | Sentry 기본 PII 수집(IP·user-agent 일부) 여부 |
| `sampleRate` | 에러 이벤트 전송 비율 |
| `tracesSampleRate` | 성능 트랜잭션 전송 비율 |
| `replaysSessionSampleRate` · `replaysOnErrorSampleRate` | 세션 리플레이 수집 비율 |
| `beforeSend` | 전송 직전 이벤트를 수정하거나 버린다 |
| `beforeBreadcrumb` | breadcrumb를 수정하거나 `null` 반환으로 버린다 |
| `ignoreErrors` | 메시지 패턴(문자열·정규식)이 일치하는 에러를 버린다 |
| `release` · `environment` | release·환경 태그 |

---

## 3. 소스맵 업로드

- production 빌드는 minified라 소스맵 없이는 stack trace를 해독할 수 없다.
- Vite는 `build.sourcemap: true`일 때 소스맵을 만든다.
- `@sentry/vite-plugin`은 `SENTRY_AUTH_TOKEN`(org-level token)·`SENTRY_ORG`·`SENTRY_PROJECT`로 Sentry에 소스맵을 올린다.
- `sourcemaps.deleteFilesAfterUpload: true`면 업로드 후 `dist/`에서 `.map` 파일을 지운다. 지우지 않으면 `.map`이 정적 자산과 함께 외부에 공개된다.

---

## 4. 이벤트 한도

Sentry 무료 플랜은 5,000 events/월이다. Team 플랜은 월 $26에 100k events다.

50매장 기준 추정치:

| 항목 | 가정 | 월 예상 이벤트 |
|------|------|--------------|
| 에러 | 매장당 월 10건, 100% 전송 | ~500 (무료 한도의 10%) |
| 트랜잭션 | 매장당 일 100건, 5% 전송 | ~7,500 (무료 한도 초과) |
| 합계 | — | ~8,000 |

---

## 5. 후보 세부 정보

### 5.1 `@sentry/react` ^8
- **장점**: ErrorBoundary·`Sentry.withProfiler`·breadcrumb 자동·React Router v7 통합
- **단점**: 번들 ~30 KB gzip — dynamic import로 lazy 가능
- **세부사항**: MIT. `@sentry/react@^8`

### 5.2 `@sentry/vite-plugin` ^2
- **장점**: Vite 1급·CI 자동화·release 동기
- **단점**: SENTRY_AUTH_TOKEN 필요
- **세부사항**: MIT. `@sentry/vite-plugin@^2`

---

## 6. 비교 요약 표

| 분류 | 후보 | 특징 |
|------|------|------|
| SaaS | Sentry | React 1급 SDK·소스맵 업로드·release 태깅 |
| SaaS | LogRocket | 세션 리플레이 — 화면 내용이 영상에 담김 |
| SaaS | Bugsnag / Rollbar | 에러 중심 SaaS |
| 자체 구축 | Loki/Grafana | 직접 운영 |
| 라이브러리 | `@sentry/react` + `@sentry/vite-plugin` | 브라우저 SDK + 빌드 시 소스맵 업로드 |
