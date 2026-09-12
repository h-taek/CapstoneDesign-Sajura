# 인증·보안 (OAuth 흐름·토큰 정책·CSP)

> **카테고리**: OAuth 흐름의 FE 책임, Access Token / Refresh Token FE 저장 정책, Content Security Policy(CSP) 정책 결정
> **연결 spec**:
> - `12_security.md` §2.1 (Backend OAuth Authlib 처리)·§2.3 (토큰 정책)·§4 (TLS·CSP)
> - `09_service_design.md` §10.2 (CORS `allow_credentials: True`)·§11 (Caddy 정적 서빙)
> - `docs/research/backend/03_reverse_proxy.md` §4.1 (Caddy `header` 디렉티브 보안 헤더 — CSP 본 research가 확정)
> - `docs/research/backend/05_auth_security.md` §3.5 (Caddy 보안 헤더 권장 블록 — CSP는 본 research에서 PWA 정합 확정)

---

## 0. 카테고리 구성 & 결정 항목

| 하위 카테고리 | 후보 수 | 결정 항목 수 |
|------------|--------|------------|
| §1 OAuth 흐름 (FE 책임) | — | 1 (Backend 인가 URL 리다이렉트 패턴 ratify) |
| §2 Token 저장 정책 (FE 측) | — | 2 (Access Token 메모리·Refresh Cookie 비접근) |
| §3 CSP 정책 | 3 옵션 | 1 (Caddy CSP 헤더 — Tailwind·shadcn·Recharts 정합) |
| §4 통합 결정 | — | §4 참조 |

### 본 research가 결정하는 항목

| 항목 | 결정 | 결정 근거 위치 |
|------|------|--------------|
| OAuth FE 책임 | BE 인가 URL 리다이렉트 + 콜백은 BE 처리·FE는 첫 화면 진입 시 `/api/auth/me`로 사용자 정보 동기 | §1.3 |
| Access Token 저장 | **Zustand store 메모리** (persist 절대 금지) — `02_routing_state.md` §2.6 정합 | §2.1 |
| Refresh Token 처리 | FE는 절대 접근 안 함 — HttpOnly Cookie + `credentials: 'include'`로 자동 송수신 (`03_data_http.md` §2.5 ky 인터셉터 정합) | §2.2 |
| CSP 정책 | **Caddy `header` CSP — `style-src 'self' 'unsafe-inline'` 유지, `script-src 'self'` (nonce 미도입)** | §3.4 |

---

## 1. OAuth 흐름 (FE 책임)

### 1.1 BE 결정 가정 (요약)

- `12_security.md` §2.1 — Google/카카오 OAuth는 BE Authlib이 처리, FE는 인가 URL로 리다이렉트만 수행
- `04_feature_spec.md` §1.1 — Backend 콜백에서 사용자 정보 조회·JWT 발급
- `09_service_design.md` §10.2 — CORS `allow_credentials: True` (Refresh Cookie 송수신)

### 1.2 FE 흐름 결정

| 단계 | FE 처리 |
|------|---------|
| 1. 로그인 화면 | Google·카카오 버튼 클릭 → `window.location.href = '/api/auth/login/google'` 단순 리다이렉트 |
| 2. BE 콜백 종료 | BE가 Access Token JSON 응답 + Refresh Token Cookie 설정 후 FE 진입 URL로 302 리다이렉트 |
| 3. FE 첫 진입 | Access Token이 메모리에 없으므로, `POST /api/auth/refresh` 1회 호출(Refresh Cookie 자동 전송) → 새 Access Token 수신 → Zustand store에 저장 |
| 4. 사용자 정보 동기 | `GET /api/auth/me` 호출 → user_id·email·store_id·onboarding_completed 수신 → store 갱신 |
| 5. 라우터 가드 | `onboarding_completed=false` 시 `/onboarding/*` 강제 이동 (`02_routing_state.md` §1.5 라우트 구조 정합) |

### 1.3 결정 사유

| 항목 | 결정 | 사유 |
|------|------|------|
| OAuth 콜백 처리 위치 | BE 단독 (FE는 redirect만) | `12_security.md` §2.1 결정 — FE에서 OAuth 코드 노출·교환 책임 회피 |
| Access Token 전달 | BE 콜백 응답 → FE 진입 시 refresh로 동기 | URL fragment·쿼리에 토큰 노출 회피 (브라우저 히스토리·Referer 누출) |
| user 정보 첫 조회 | `GET /api/auth/me` | JWT decode 대신 BE API — 토큰 클레임 변경 영향 흡수 |

> **신규 BE 요구 없음**. 현재 `07_api_spec.md` §2에 `POST /api/auth/refresh`·`GET /api/auth/me` 모두 존재.

---

## 2. Token 저장 정책 (FE 측)

### 2.1 Access Token

| 항목 | 결정 | 사유 |
|------|------|------|
| 저장 위치 | Zustand `useAuthStore` (메모리 — `02_routing_state.md` §2.6) | `12_security.md` §2.3 정합 — LocalStorage 저장 금지 |
| persist 미사용 | `02_routing_state.md` §2.6에서 auth store를 preferences store와 물리적 분리 | persist 활성화 시 LocalStorage 노출 사고 방지 |
| 만료 시 동작 | 401 → ky 인터셉터(`03_data_http.md` §2.5)가 단일 refresh 후 원요청 재시도 | 동시 다발 401 단일화 |
| 페이지 새로고침 | 메모리 휘발 → 첫 진입 §1.2 단계 3 흐름 재실행 | Refresh Cookie 유효 시 자연 복구 |

### 2.2 Refresh Token

| 항목 | 결정 | 사유 |
|------|------|------|
| 저장 위치 | **FE 접근 불가** — BE가 HttpOnly·Secure·SameSite=Lax Cookie로 설정·회수 | `12_security.md` §2.3 정합 — JavaScript 접근 불가 |
| FE 전송 | `fetch`/`ky`의 `credentials: 'include'`로 자동 송수신 (`03_data_http.md` §2.5) | CORS `allow_credentials: True` (`09_service_design.md` §10.2) 정합 |
| FE 표시 코드 | 없음 — Refresh Token 값이 FE 코드에 등장하지 않아야 함 | DevTools·Sentry breadcrumb 노출 회피 |
| Rotation | BE가 Cookie 갱신 — FE는 무관 | `12_security.md` §2.3 Rotation 정책 |

### 2.3 로그아웃·강제 로그아웃

| 시나리오 | FE 처리 |
|---------|--------|
| 일반 로그아웃 | `POST /api/auth/logout` → BE가 Cookie 폐기 → FE는 `useAuthStore.clearToken()` + 라우터 `/login` 이동 |
| 강제 로그아웃 (모든 디바이스) | `POST /api/auth/logout-all` (`12_security.md` §2.3 강제 로그아웃 정책) → 동일 처리 + 사용자 안내 |
| Refresh 실패 (401) | `useAuthStore.clearToken()` + `window.location.href = '/login'` (ky 인터셉터 — `03_data_http.md` §2.5) |

### 2.4 다중 디바이스 (참고)

`14_security_open_items.md` §6에서 각 디바이스 자체 토큰 자연 동작 명시. FE는 디바이스별로 독립 Refresh Cookie를 갖고 각각의 Rotation 흐름을 따른다 — FE 코드에 디바이스 식별 로직 불필요.

---

## 3. CSP (Content Security Policy)

### 3.1 결정 환경

CSP 헤더는 Caddy v2 `header` 디렉티브로 설정 (`docs/research/backend/03_reverse_proxy.md` §4.1·`05_auth_security.md` §3.5). 본 research는 PWA + Tailwind + shadcn/ui + Recharts 조합에서 안전한 CSP 디렉티브를 결정한다.

### 3.2 후보 옵션

| # | 옵션 | 특징 | 평가 |
|---|------|------|------|
| 1 | `script-src 'self'` (nonce 미사용) | 빌드 산출 JS만 허용 | ✅ 사주라 적합 |
| 2 | `script-src 'self' 'nonce-<random>'` | inline script에 nonce 부여 (Caddy + 동적 nonce 주입 필요) | ⛔ MVP에 과함 |
| 3 | `style-src 'self'` (strict) | Tailwind 빌드 CSS만 허용 | ⛔ Radix·Recharts 동적 inline style로 불가 |
| 4 | `style-src 'self' 'unsafe-inline'` | inline style 허용 | ✅ Radix·Recharts·shadcn 정합 |

### 3.3 라이브러리별 CSP 영향 분석

| 라이브러리 | inline script | inline style | 외부 origin |
|----------|:-------------:|:------------:|:----------:|
| React 19 | ⛔ (자체 inline script 없음) | △ (`style` prop 사용 가능) | ⛔ |
| Vite (production 빌드) | ⛔ (모든 JS 외부 파일) | ⛔ | ⛔ |
| Tailwind v4 | ⛔ | ⛔ (빌드 시 CSS 파일) | ⛔ |
| shadcn/ui (Radix 기반) | ⛔ | ◎ (Radix Floating UI inline `style.transform` 등) | ⛔ |
| Recharts | ⛔ | ◎ (SVG inline `style` 속성) | ⛔ |
| TanStack Query DevTools | ⛔ (production 미포함) | ◎ (dev 한정) | ⛔ |
| Service Worker (vite-plugin-pwa) | ⛔ | ⛔ | (Workbox internal) |

→ **결론**: `script-src 'self'`로 inline script 차단 가능. `style-src 'self' 'unsafe-inline'`은 Radix·Recharts 호환 필수로 유지.

### 3.4 최종 CSP 결정

```caddyfile
# Caddyfile (사주라 정적 + BE 프록시 일관) — 03 §4.1 확장
header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    X-Frame-Options "DENY"
    X-Content-Type-Options "nosniff"
    Referrer-Policy "strict-origin-when-cross-origin"
    Permissions-Policy "geolocation=(), microphone=(), camera=(), payment=()"
    Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://*.ingest.sentry.io; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests"
}
```

| 디렉티브 | 값 | 사유 |
|---------|---|------|
| `default-src 'self'` | — | 기본 같은 origin |
| `script-src 'self'` | — | Vite 빌드 산출 JS만, inline·CDN 차단 |
| `style-src 'self' 'unsafe-inline'` | — | Tailwind CSS 파일 + Radix·Recharts inline style 호환 |
| `img-src 'self' data: blob:` | — | 아이콘·SVG·base64·blob URL |
| `font-src 'self' data:` | — | Pretendard 로컬 호스팅·일부 inline font |
| `connect-src 'self' https://*.ingest.sentry.io` | — | API·Web Push push service는 SW 컨텍스트로 별도(CSP 영향 무). FE Sentry SaaS 통신 허용 (`11_observability.md` §1.4) |
| `worker-src 'self'` | — | Service Worker 자체 origin |
| `manifest-src 'self'` | — | PWA manifest |
| `frame-ancestors 'none'` | — | 다른 사이트 iframe 차단 (clickjacking) |
| `base-uri 'self'` / `form-action 'self'` | — | base·form 조작 차단 |
| `upgrade-insecure-requests` | — | HTTP 자원 자동 HTTPS 업그레이드 |

### 3.5 nonce 도입 평가 (보존)

`script-src` nonce는 inline script 허용 시 표준 보안 패턴이나, 사주라 Vite production 빌드는 inline script 없음(`script-src 'self'`로 충분). nonce 도입 시 Caddy 동적 nonce 주입 + Vite 빌드 nonce 인식 모두 필요 — 운영 부담 큼.

**재평가 트리거:**

| 지표 | 임계치 |
|------|------|
| inline script 필요 라이브러리 도입 | 발생 |
| 3rd-party 분석·태그(Google Analytics 등) 도입 | 발생 |
| 보안 감사 권고 | 외부 감사 결과 |

→ 1개 충족 시 nonce 도입 검토.

---

## 4. 통합 최종 결정 (spec 반영)

### 4.1 결정 항목 (4건)

| 항목 | 결정 | spec 반영 위치 |
|------|------|--------------|
| OAuth FE 책임 | BE 인가 URL 리다이렉트 + 첫 진입 refresh + `/api/auth/me` | FE spec 신설 시 명시 (BE 변경 없음) |
| Access Token 저장 | Zustand `useAuthStore` 메모리 (persist 금지) | FE spec 신설 시 명시 (`12_security.md` §2.3 ratify) |
| Refresh Token 처리 | FE 접근 불가·`credentials: 'include'` 자동 송수신 | 동상 |
| CSP 헤더 | `script-src 'self'`·`style-src 'self' 'unsafe-inline'` 등 §3.4 블록 | `docs/research/backend/03_reverse_proxy.md` §4.1·`05_auth_security.md` §3.5에 본 결정 반영 |

### 4.2 backend research 정합 갱신

| 갱신 대상 | 변경 |
|---------|------|
| `docs/research/backend/03_reverse_proxy.md` §4.1 Caddyfile | CSP를 본 §3.4 결정값으로 정합 (현재 CSP 블록은 "PWA 자산 경로 확정 후 추가" 표현이 §4.1에 남아 있다면 정정) |
| `docs/research/backend/05_auth_security.md` §3.5 | CSP 결정 위치 본 research로 위임 명시 — 이미 03과 동일 결정으로 정합 |

> 두 backend research는 이미 PROGRESS 6차에서 "'self' 기반 CSP" 결정으로 정합됨 — 본 research는 PWA·shadcn·Recharts 정합으로 디렉티브 상세를 확정.

### 4.3 결정에 따라 다른 카테고리에 미치는 영향

| 영향 | 영향 받는 카테고리 |
|------|----------------|
| Refresh Cookie SameSite=Lax → BE 응답 헤더 정책 확인 | BE `09_service_design.md` §10 미들웨어 — Cookie 설정은 AuthService 응답 직접 처리 (변경 없음) |
| `script-src 'self'` → 3rd-party 분석 도구 도입 시 정책 갱신 필요 | `10_deployment.md` 운영 항목 |

---

## 5. 후보·결정 세부 정보

### 5.1 OAuth FE 책임 분리 ✅
- **장점**: OAuth 코드 노출·교환 책임을 FE에서 분리 — XSS·DevTools 누출 회피
- **단점**: 콜백 후 FE 첫 진입에 refresh 1회 호출 비용 — ~수십 ms로 무관

### 5.2 Zustand 메모리 + persist 분리 ✅
- **장점**: Access Token이 LocalStorage·IndexedDB에 절대 저장되지 않음을 store 구조로 보장
- **단점**: 새로고침 시 refresh 1회 호출 비용 — 자연

### 5.3 ky `credentials: 'include'` ✅
- **장점**: Cookie 자동 송수신·FE 코드에 Refresh Token 미등장
- **단점**: CORS `allow_credentials: True` + `allow_origins` 명시 필수 (이미 `09_service_design.md` §10.2 결정)

### 5.4 Caddy CSP `'self' + 'unsafe-inline'` (style만) ✅
- **장점**: 운영 단순·Radix·Recharts 정합·nonce 운영 부담 회피
- **단점**: `style-src 'unsafe-inline'`는 inline style 기반 XSS 페이로드 일부 허용 — script가 막혀 있어 실 영향 제한적. 향후 nonce·hash 기반 강화 가능

### 5.5 탈락·보존 요약

| 후보 | 결과 | 사유 |
|------|------|------|
| `script-src 'self' 'nonce-<random>'` | 🟡 보존 | inline script 도입 시 / 3rd-party 분석 도입 시 |
| `style-src 'self'` (strict) | ⛔ | Radix·Recharts inline style 호환 불가 |

---

## 6. 비교 요약 표

| 분류 | 후보 | 결과 | 핵심 사유 |
|------|------|------|---------|
| OAuth FE 책임 | BE 리다이렉트 + refresh + me | ✅ | `12_security.md` §2.1 정합 — 코드 노출 회피 |
| Access Token | Zustand 메모리 | ✅ | `12_security.md` §2.3 정합 — persist 금지 |
| Refresh Token | HttpOnly Cookie 자동 송수신 | ✅ | FE 코드에 미등장 |
| CSP script | `'self'` (nonce 없음) | ✅ | Vite 빌드 inline script 없음 |
| CSP script | `'nonce-<random>'` | 🟡 보존 | inline script·3rd-party 트리거 |
| CSP style | `'self' 'unsafe-inline'` | ✅ | Radix·Recharts inline style 호환 |
| CSP style | `'self'` strict | ⛔ | 라이브러리 동작 깨짐 |
