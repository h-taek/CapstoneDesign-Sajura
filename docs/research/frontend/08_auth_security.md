# 인증·보안 (OAuth 흐름·토큰 정책·CSP)

> **카테고리**: OAuth 흐름의 FE 책임, Access Token / Refresh Token FE 저장 방식, Content Security Policy(CSP) 디렉티브 조사
> **연결 spec**:
> - `03_be.md` §7.1 (Backend OAuth Authlib 처리)·§7.3 (토큰 정책)·§10 (TLS·CSP)
> - `03_be.md` §13.2 (CORS `allow_credentials: True`)·§15 (Caddy 정적 서빙)
> - `docs/research/backend/03_reverse_proxy.md` §4.1 (Caddy `header` 디렉티브 보안 헤더)

---

## 1. OAuth 흐름 (FE 책임)

- FE가 OAuth 코드를 받아 교환하면 코드가 브라우저에 노출된다. BE가 콜백을 처리하면 FE는 인가 URL로 리다이렉트만 한다.
- Access Token을 URL fragment·쿼리로 넘기면 브라우저 히스토리·Referer로 누출될 수 있다.
- user 정보를 JWT decode로 얻으면 토큰 클레임이 바뀔 때 FE도 바뀌어야 한다. `GET /api/auth/me`로 조회하면 그 영향이 BE에서 흡수된다.

---

## 2. Token 저장 (FE 측)

- 메모리(Zustand store)에 둔 Access Token은 새로고침하면 사라진다. Refresh Cookie가 유효하면 `POST /api/auth/refresh` 1회 호출로 다시 받는다.
- Zustand store에 persist를 켜면 값이 LocalStorage에 저장된다.
- HttpOnly Cookie는 JavaScript로 읽을 수 없다. `fetch`/`ky`의 `credentials: 'include'`로 자동 송수신되며, CORS에서는 `allow_credentials: True`와 명시적 `allow_origins`가 필요하다.
- Refresh Token 값이 FE 코드에 나타나면 DevTools·Sentry breadcrumb에 노출될 수 있다.

---

## 3. CSP (Content Security Policy)

### 3.1 후보 옵션

| # | 옵션 | 특징 |
|---|------|------|
| 1 | `script-src 'self'` (nonce 미사용) | 빌드 산출 JS만 허용 |
| 2 | `script-src 'self' 'nonce-<random>'` | inline script에 nonce 부여. Caddy의 요청별 동적 nonce 주입과 Vite 빌드의 nonce 인식이 필요 |
| 3 | `style-src 'self'` (strict) | Tailwind 빌드 CSS만 허용. Radix·Recharts의 동적 inline style이 차단된다 |
| 4 | `style-src 'self' 'unsafe-inline'` | inline style 허용 |

### 3.2 라이브러리별 CSP 영향 분석

| 라이브러리 | inline script | inline style | 외부 origin |
|----------|:-------------:|:------------:|:----------:|
| React 19 | X (자체 inline script 없음) | △ (`style` prop 사용 가능) | X |
| Vite (production 빌드) | X (모든 JS 외부 파일) | X | X |
| Tailwind v4 | X | X (빌드 시 CSS 파일) | X |
| shadcn/ui (Radix 기반) | X | ◎ (Radix Floating UI inline `style.transform` 등) | X |
| Recharts | X | ◎ (SVG inline `style` 속성) | X |
| TanStack Query DevTools | X (production 미포함) | ◎ (dev 한정) | X |
| Service Worker (vite-plugin-pwa) | X | X | (Workbox internal) |

표의 라이브러리 중 production에서 inline script를 쓰는 것은 없다. shadcn/ui(Radix)와 Recharts는 inline style을 쓴다.

---

## 4. 후보 세부 정보

### 4.1 BE 콜백 처리 + FE 리다이렉트
- **장점**: OAuth 코드 노출·교환 책임을 FE에서 분리 — XSS·DevTools 누출 회피
- **단점**: 콜백 후 FE 첫 진입에 refresh 1회 호출이 추가된다

### 4.2 Zustand 메모리 + persist 분리
- **장점**: Access Token이 LocalStorage·IndexedDB에 저장되지 않음을 store 구조로 보장
- **단점**: 새로고침 시 refresh 1회 호출 비용

### 4.3 ky `credentials: 'include'`
- **장점**: Cookie 자동 송수신·FE 코드에 Refresh Token 미등장
- **단점**: CORS `allow_credentials: True` + `allow_origins` 명시 필수

### 4.4 CSP `'self'` + `'unsafe-inline'` (style만)
- **장점**: nonce 주입 없이 Radix·Recharts inline style이 동작한다
- **단점**: `style-src 'unsafe-inline'`는 inline style 기반 XSS 페이로드 일부를 허용한다. nonce·hash 기반으로 강화할 수 있다

---

## 5. 비교 요약 표

| 분류 | 후보 | 특징 |
|------|------|------|
| OAuth 콜백 | BE 처리 + FE 리다이렉트 | FE에 OAuth 코드 미노출 |
| Access Token | Zustand 메모리 | 새로고침 시 휘발·LocalStorage 미저장 |
| Refresh Token | HttpOnly Cookie | JavaScript 접근 불가·`credentials: 'include'` 자동 송수신 |
| CSP script | `'self'` | 빌드 산출 JS만 허용 |
| CSP script | `'nonce-<random>'` | inline script 허용·요청별 nonce 주입 필요 |
| CSP style | `'self' 'unsafe-inline'` | Radix·Recharts inline style 동작 |
| CSP style | `'self'` strict | Radix·Recharts inline style 차단 |
