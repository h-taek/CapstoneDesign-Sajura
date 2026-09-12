# 에러 모니터링·관측가능성 (FE)

> **카테고리**: FE 측 에러·성능 추적 도구, PII scrubbing 정책, 소스맵 업로드 정책, sampleRate·이벤트 한도 정책 결정
> **연결 spec**: `13_performance.md` §5 (BE Sentry 결정·구조화 로깅), `09_service_design.md` §1 sentry-sdk[fastapi] 행 (BE 정합)
> **연결 research**: `docs/research/backend/07_cache_observability.md` §3 (BE Sentry 결정 — 동일 SaaS 플랫폼 공유)

---

## 0. 카테고리 구성 & 결정 항목

| 하위 카테고리 | 후보 수 | 결정 항목 수 |
|------------|--------|------------|
| §1 에러 모니터링 SaaS | 5 | 1 (Sentry) |
| §2 라이브러리 구성 | — | 2 (`@sentry/react` + `@sentry/vite-plugin`) |
| §3 PII scrubbing 정책 | — | 1 (beforeSend 마스킹 + `sendDefaultPii: false`) |
| §4 소스맵 업로드 정책 | — | 1 (Sentry 전용 업로드 후 dist 제거) |
| §5 sampleRate·이벤트 한도 정책 | — | 1 (error 100% + traces 5%) |
| §6 통합 결정 | — | §6 참조 |

### 본 research가 결정하는 항목

| 항목 | 결정 | 결정 근거 위치 |
|------|------|--------------|
| 에러 모니터링 SaaS | **Sentry** (BE와 동일 플랫폼 공유 — `07_cache_observability.md` §3 정합) | §1.4 |
| FE 라이브러리 | **`@sentry/react` 8.x + `@sentry/vite-plugin` 2.x** | §2 |
| PII scrubbing | `sendDefaultPii: false` + `beforeSend`에서 Authorization·Cookie·이메일·전화 마스킹 | §3 |
| 소스맵 업로드 | Sentry 전용 업로드 + `sourcemaps.deleteFilesAfterUpload: true` (public 노출 차단) | §4 |
| sampleRate | `sampleRate: 1.0`(에러 100%) + `tracesSampleRate: 0.05`(트랜잭션 5%) | §5 |

---

## 1. 에러 모니터링 SaaS

### 1.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | Sentry | 에러·성능·release | BE 결정 정합·React 1급 |
| 2 | LogRocket | 세션 리플레이 중심 | 세션 영상 — PII 리스크 큼 |
| 3 | Bugsnag | 에러 중심 | 마인드셰어 작음 |
| 4 | Rollbar | 에러 중심 | 동상 |
| 5 | 자체 구축 (structlog/Loki/Grafana) | 인프라 | BE 보존 후보와 동일 — MVP 운영 부담 큼 |

### 1.2 1차 벤치마크 — 사주라 MVP 필수 기능

| # | 후보 | BE 결정 정합 | React 1급 SDK | Source map 업로드 | PII scrubbing | 무료 한도 | 마인드셰어 | 결과 |
|---|------|:---:|:---:|:---:|:---:|:---:|:---:|:---|
| 1 | Sentry | ◎ | ◎ (`@sentry/react`·`ErrorBoundary`·React Router 통합) | ◎ (`@sentry/vite-plugin`) | ◎ (`beforeSend`·`sendDefaultPii`) | △ (5k events/월) | ◎ | ✅ **통과** |
| 2 | LogRocket | ⛔ | ◎ | △ | ⛔ (세션 영상 자체가 PII 위험) | △ | O | ⛔ |
| 3 | Bugsnag | ⛔ | O | O | O | △ | △ | ⛔ |
| 4 | Rollbar | ⛔ | O | O | O | △ | △ | ⛔ |
| 5 | 자체 구축 | (BE 보존 후보와 동일) | — | — | — | — | ⛔ | ⛔ (운영 부담) |

### 1.3 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| BE 결정 정합 | **필수** | BE Sentry와 동일 플랫폼·동일 release 태깅 → 운영 시 BE↔FE 에러 상관관계 추적 |
| React 1급 SDK | **필수** | `ErrorBoundary`·React Router 통합·breadcrumb 자동 수집 |
| Source map 업로드 자동 | **필수** | production 빌드는 minified — 소스맵 없이는 stack trace 해독 불가 |
| PII scrubbing | **필수** | `12_security.md` §3 개인정보 보호 — 이메일·매장명·토큰 누출 차단 |

**탈락 사유:**

- **#2 LogRocket** — 세션 영상 자체가 점주 화면 캡처 → 이메일·매장명·매출 데이터가 영상에 노출. PII 리스크가 사주라 보안 정책과 정면 충돌.
- **#3 Bugsnag / #4 Rollbar** — 기능은 충분하나 BE 결정(Sentry)과 분리되어 release 태깅·이벤트 상관관계 불가. 운영 도구 2개 분리 부담.
- **#5 자체 구축** — Loki·Grafana·Tempo 등 자체 운영은 1인 운영 환경에 과함. BE `07_cache_observability.md` §2.5에서도 보존 후보로 분류.

### 1.4 최종 선발

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **에러 모니터링 SaaS** | **Sentry** ✅ | BE `sentry-sdk[fastapi]`와 동일 플랫폼. 동일 release 태깅(`git-<sha-short>`)으로 BE↔FE 에러 상관관계 추적. `@sentry/react` ErrorBoundary·React Router 통합·breadcrumb 자동 수집. PII scrubbing·소스맵 업로드 표준 지원 |

---

## 2. 라이브러리 구성

### 2.1 결정

| 라이브러리 | 역할 | 버전 |
|----------|------|------|
| `@sentry/react` | 브라우저 에러·성능 SDK + ErrorBoundary + React Router instrumentation | ^8 |
| `@sentry/vite-plugin` | 빌드 시 소스맵 자동 업로드 + release 자동 생성·태깅 | ^2 |

### 2.2 초기화 코드

```ts
// src/lib/sentry.ts
import * as Sentry from '@sentry/react';
import { createBrowserRouter, useLocation, useNavigationType,
         createRoutesFromChildren, matchRoutes } from 'react-router';

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT,    // 'staging' | 'prod'
    release: import.meta.env.VITE_APP_VERSION,                // git-<sha-short>
    sendDefaultPii: false,                                    // §3.1
    sampleRate: 1.0,                                          // §5.1 에러 100%
    tracesSampleRate: 0.05,                                   // §5.2 트랜잭션 5%
    replaysSessionSampleRate: 0,                              // 세션 리플레이 미사용 (PII)
    replaysOnErrorSampleRate: 0,                              // 동상
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.reactRouterV7BrowserTracingIntegration({
        useEffect: React.useEffect,
        useLocation, useNavigationType,
        createRoutesFromChildren, matchRoutes,
      }),
    ],
    beforeSend: scrubPII,                                     // §3.2
    beforeBreadcrumb: scrubBreadcrumb,                        // §3.3
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',                   // 브라우저 노이즈
      /^NetworkError when attempting to fetch resource/,      // 사용자 네트워크 단절
    ],
  });
}
```

```tsx
// src/main.tsx (ErrorBoundary 설치)
import { Sentry } from './lib/sentry';

createRoot(rootEl).render(
  <Sentry.ErrorBoundary fallback={<ErrorPage />} showDialog={false}>
    <App />
  </Sentry.ErrorBoundary>,
);
```

| 옵션 | 값 | 사유 |
|------|---|------|
| `sendDefaultPii: false` | — | Sentry 기본 PII 수집(IP·user-agent 일부) 비활성 — `12_security.md` §3 정합 |
| `replaysSessionSampleRate: 0` | — | 세션 리플레이 미사용 — 점주 화면 캡처로 매출·매장 정보 누출 차단 |
| `ignoreErrors` | 노이즈 패턴 | 이벤트 한도 보호 |

---

## 3. PII scrubbing 정책

### 3.1 차단 항목

| 분류 | 항목 | 출처 |
|------|------|------|
| 토큰·자격증명 | `Authorization` 헤더, `Cookie` 헤더, `access_token`, `refresh_token` | HTTP request·response·breadcrumb |
| 개인정보 | 이메일, 사업자등록번호, 전화번호 | 폼 입력값·API 응답·URL 쿼리 |
| 매장 식별 | `store_id`(UUID 일부) — Sentry user 컨텍스트는 `user_id` 해시만 사용 | API 응답 |
| 매출·재고 | 금액·수량 — stack에 들어가지 않도록 logging에서 사전 차단 | console.log·breadcrumb |

### 3.2 `beforeSend` 마스킹

```ts
function scrubPII(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  // 1. request 헤더 마스킹
  if (event.request?.headers) {
    for (const key of ['Authorization', 'Cookie', 'cookie', 'authorization']) {
      if (key in event.request.headers) event.request.headers[key] = '[REDACTED]';
    }
  }
  // 2. URL 쿼리 마스킹
  if (event.request?.url) {
    event.request.url = event.request.url
      .replace(/code=[^&]+/g, 'code=[REDACTED]')              // OAuth 코드
      .replace(/token=[^&]+/g, 'token=[REDACTED]');
  }
  // 3. 메시지·예외 메시지에서 이메일·전화 패턴 마스킹
  const maskString = (s: string) => s
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[EMAIL]')
    .replace(/\b010-\d{4}-\d{4}\b/g, '[PHONE]')
    .replace(/\b\d{3}-\d{2}-\d{5}\b/g, '[BIZNO]');
  if (event.message) event.message = maskString(event.message);
  event.exception?.values?.forEach((e) => {
    if (e.value) e.value = maskString(e.value);
  });
  return event;
}
```

### 3.3 `beforeBreadcrumb` 마스킹

```ts
function scrubBreadcrumb(crumb: Sentry.Breadcrumb): Sentry.Breadcrumb | null {
  // console.log·console.error 등에 토큰·민감 정보 들어가면 차단
  if (crumb.category === 'console' && typeof crumb.message === 'string') {
    if (/(token|password|secret|api_key)/i.test(crumb.message)) return null;
  }
  // fetch breadcrumb에서 Authorization 헤더 마스킹
  if (crumb.category === 'fetch' && crumb.data?.request_headers) {
    delete crumb.data.request_headers.Authorization;
    delete crumb.data.request_headers.Cookie;
  }
  return crumb;
}
```

---

## 4. 소스맵 업로드 정책

### 4.1 결정

| 항목 | 결정 | 사유 |
|------|------|------|
| 빌드 시 소스맵 생성 | `vite.config.ts` `build.sourcemap: true` (`01_framework_build.md` §2.5 이미 명시) | Sentry 업로드 필요 |
| 소스맵 업로드 대상 | Sentry (`@sentry/vite-plugin`) | Sentry에서 stack trace 해독 |
| **public dist 노출 차단** | `sourcemaps.deleteFilesAfterUpload: true` | **업로드 후 `dist/`에서 `.map` 파일 자동 삭제 → 외부 공개 차단** |
| Release 태깅 | `git-<sha-short>` (BE 정합) | BE↔FE 상관관계 |

### 4.2 vite.config.ts 패치

```ts
// vite.config.ts 발췌 (01 §2.5에 다음 plugin 추가)
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    VitePWA({ /* ... 06 §1.5 */ }),
    // CI 빌드 단계에서만 활성 — SENTRY_AUTH_TOKEN이 있을 때
    process.env.SENTRY_AUTH_TOKEN && sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      release: { name: process.env.VITE_APP_VERSION },
      sourcemaps: {
        assets: './dist/**',
        deleteFilesAfterUpload: true,    // ← public 노출 차단
      },
    }),
  ],
  build: { sourcemap: true /* ... */ },
});
```

| 환경변수 | 비고 |
|---------|------|
| `SENTRY_AUTH_TOKEN` | CI secret — Sentry에 소스맵 push 권한 (org-level token) |
| `SENTRY_ORG` / `SENTRY_PROJECT` | Sentry 조직·프로젝트 식별 |
| `VITE_APP_VERSION` | `git-<sha-short>` — release 태깅 |

> dev·로컬 빌드에는 `SENTRY_AUTH_TOKEN` 미설정 → plugin 비활성 → 소스맵 그대로 유지(로컬 디버깅 용)

---

## 5. sampleRate·이벤트 한도 정책

### 5.1 에러 sampleRate

| 설정 | 값 | 사유 |
|------|---|------|
| `sampleRate` (에러 이벤트 비율) | **1.0 (100%)** | 사주라 50매장 MVP — 에러 빈도가 낮아 100% 캡처해도 한도 여유 |

### 5.2 트랜잭션 sampleRate

| 설정 | 값 | 사유 |
|------|---|------|
| `tracesSampleRate` (성능 트랜잭션 비율) | **0.05 (5%)** | 성능 트레이싱은 표본만 — 5% × 50매장 × 100 트랜잭션/일 = 250 events/일·약 7,500 events/월 |

### 5.3 이벤트 한도 시뮬레이션

Sentry 무료 플랜: **5,000 events/월**.

| 시나리오 | 월 예상 이벤트 | 비고 |
|---------|--------------|------|
| 에러 (정상 운영) | ~500 (50매장 × 10 errors/매장·월) | 한도의 10% |
| 트랜잭션 5% 샘플 | ~7,500 | **무료 한도 초과 가능** |
| 합계 | ~8,000 | **유료 플랜 필요 또는 tracesSampleRate 추가 조정** |

### 5.4 한도 초과 대응

| 단계 | 조치 |
|------|------|
| 1 | `tracesSampleRate` 0.05 → 0.02로 추가 인하 |
| 2 | `ignoreErrors` 노이즈 패턴 추가 |
| 3 | Sentry Team 플랜 결제 (월 $26 — 100k events) |

> 이벤트 한도는 운영 시작 후 1개월 관찰 후 조정.

---

## 6. 통합 최종 결정 (spec 반영)

### 6.1 결정 항목 (5건)

| 항목 | 결정 | spec 반영 위치 |
|------|------|--------------|
| 에러 모니터링 SaaS | **Sentry** (BE 정합) | `13_performance.md` §5 FE Sentry 1행 추가 |
| FE 라이브러리 | **`@sentry/react` ^8 + `@sentry/vite-plugin` ^2** | FE spec 신설 시 명시 |
| PII scrubbing | `sendDefaultPii: false` + `beforeSend`·`beforeBreadcrumb` 마스킹 | 동상 |
| 소스맵 업로드 | Sentry 전용 + `deleteFilesAfterUpload: true` | 동상 |
| sampleRate | error 100% + traces 5% (관찰 후 조정) | 동상 |

### 6.2 결정에 따라 다른 카테고리에 미치는 영향

| 영향 | 영향 받는 카테고리 |
|------|----------------|
| FE Sentry SaaS → CSP `connect-src 'self' https://*.ingest.sentry.io` 추가 | `08_auth_security.md` §3.4 + backend 03·05 Caddyfile 정합 갱신 |
| 소스맵 업로드 → `SENTRY_AUTH_TOKEN`·`SENTRY_ORG`·`SENTRY_PROJECT` CI secret 추가 | `10_deployment.md` §4.4 환경변수 목록 |
| Release 태깅 `git-<sha-short>` | BE Sentry release(`docs/research/backend/07_cache_observability.md` §3.3) 와 동일 → BE↔FE 상관관계 |

---

## 7. 후보 세부 정보

### 7.1 `@sentry/react` ^8 ✅
- **사용처**: 모든 컴포넌트 에러 + React Router 트랜잭션 추적
- **장점**: ErrorBoundary·`Sentry.withProfiler`·breadcrumb 자동·React Router v7 통합
- **단점**: 번들 ~30 KB gzip — dynamic import로 lazy 가능
- **세부사항**: MIT. `@sentry/react@^8`

### 7.2 `@sentry/vite-plugin` ^2 ✅
- **사용처**: 빌드 시 소스맵 자동 업로드·release 자동 생성·`deleteFilesAfterUpload`
- **장점**: Vite 1급·CI 자동화·release 동기
- **단점**: SENTRY_AUTH_TOKEN 필요 — secret 관리 부담 작음
- **세부사항**: MIT. `@sentry/vite-plugin@^2`

### 7.3 탈락 후보 요약

| 후보 | 탈락 사유 |
|------|---------|
| LogRocket | 세션 리플레이 PII 위험 — 사주라 보안 정책 충돌 |
| Bugsnag / Rollbar | BE Sentry와 분리 — 상관관계 불가·운영 도구 2분리 부담 |
| 자체 구축 (Loki/Grafana) | 1인 운영 부담 — BE 보존 후보와 동일 |

---

## 8. 비교 요약 표

| 분류 | 후보 | 결과 | 핵심 사유 |
|------|------|------|---------|
| SaaS | Sentry | ✅ | BE 정합·React 1급·release 동기 |
| SaaS | LogRocket | ⛔ | 세션 리플레이 PII 위험 |
| SaaS | Bugsnag / Rollbar | ⛔ | BE 분리 — 상관관계 불가 |
| 자체 구축 | Loki/Grafana | ⛔ | 1인 운영 부담 |
| 라이브러리 | `@sentry/react` + `@sentry/vite-plugin` | ✅ | 표준 조합 |
| PII | sendDefaultPii false + beforeSend 마스킹 | ✅ | 보안 정책 정합 |
| 소스맵 | Sentry 업로드 + dist 삭제 | ✅ | public 노출 차단 |
| sampleRate | error 100% + traces 5% | ✅ | 한도 여유 + 1개월 관찰 후 조정 |
