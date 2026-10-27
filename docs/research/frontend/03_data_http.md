# 서버 상태·HTTP 클라이언트·OpenAPI 코드젠

> **카테고리**: 서버 상태 캐시·refetch·낙관적 업데이트 라이브러리, HTTP 호출 라이브러리, BE OpenAPI 스키마 기반 타입 코드젠 도구 비교
> **연결 spec**: `03_be.md` §1 (FastAPI 자동 OpenAPI·orjson), `03_be.md` §13 (CORS `allow_credentials: True`), `02_implementation_design.md` §3 (22개 endpoint), `03_be.md` §7.3 (Access Token 메모리·Refresh HttpOnly Cookie·Rotation)

---

## 1. 서버 상태 캐시

### 1.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | TanStack Query v5 | 표준 서버 상태 라이브러리 | 사실상 React 표준 |
| 2 | SWR | Vercel 서버 상태 | 가벼움 |
| 3 | RTK Query (Redux Toolkit) | Redux 통합 | Redux Toolkit 일부 |

### 1.2 1차 벤치마크 — 필수 기능

| # | 후보 | 캐시·refetch | 낙관적 업데이트 | infinite query | offline·persist | DevTools |
|---|------|:---:|:---:|:---:|:---:|:---:|
| 1 | TanStack Query v5 | ◎ | ◎ (`mutation.onMutate` rollback) | ◎ | ◎ (persistQueryClient + IndexedDB) | ◎ |
| 2 | SWR | O | △ (수동) | O | △ | △ |
| 3 | RTK Query | ◎ | ◎ | O | △ | ◎ |

### 1.3 후보별 차이

- SWR — 가볍지만 낙관적 업데이트의 rollback을 수동으로 표현해야 한다.
- RTK Query — Redux Toolkit에 통합된 도구로 Redux store를 전제한다.

---

## 2. HTTP 클라이언트

### 2.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | fetch (네이티브) | 브라우저 표준 | 0 KB, wrapping 필요 |
| 2 | axios | XHR 기반 | 마인드셰어 압도, 인터셉터 풍부 |
| 3 | ky | fetch wrapper | TypeScript first, hooks 기반 |
| 4 | TanStack Query 내장 fetcher | (라이브러리 미내장) | 별도 fetcher 필요 — 분류 외 |

### 2.2 1차 벤치마크 — 필수 기능

| # | 후보 | 인터셉터 | 자동 재시도 | TS 1급 | 번들 크기 (gzip) | fetch 기반 |
|---|------|:---:|:---:|:---:|:---:|:---:|
| 1 | fetch (네이티브) | X (수동 wrapping) | X | △ (Response 타입) | 0 | ◎ |
| 2 | axios | ◎ (request/response) | X (별도 axios-retry) | O | ~13 KB | X (XHR) |
| 3 | ky | ◎ (`beforeRequest`/`afterResponse`/`beforeRetry`) | ◎ (내장) | ◎ | ~5 KB | ◎ |

### 2.3 후보별 차이

- fetch (네이티브) — 번들이 0 KB이나 인터셉터·재시도·timeout·credentials 옵션 정형화를 모두 직접 wrapping해야 한다.
- axios — XHR 기반이며 번들 크기가 fetch 기반 ky의 약 2.5배다. 자동 재시도에 axios-retry 의존성이 따로 필요하다. 마인드셰어·트러블슈팅 자료가 많고 `onUploadProgress`로 업로드 진행 상태를 표시할 수 있다.

---

## 3. OpenAPI 코드젠

### 3.1 전체 후보 목록

| # | 후보 | 분류 | 출력 |
|---|------|------|------|
| 1 | openapi-typescript | 타입만 생성 | `paths` + `components.schemas` 타입 |
| 2 | openapi-fetch | 런타임 클라이언트 + openapi-typescript 타입 | fetch wrapper + type-safe paths |
| 3 | orval | 코드 + hooks 생성 | TanStack Query / SWR / axios hooks 자동 생성 |
| 4 | swagger-typescript-api | 코드 + 클라이언트 생성 | axios/fetch 클라이언트 클래스 |
| 5 | openapi-zod-client | zod 스키마 생성 | zodios 기반 |

### 3.2 1차 벤치마크 — 필수 기능

| # | 후보 | 출력 가벼움 | 런타임 의존성 | TanStack Query 통합 | ky와 결합 가능 | 학습 비용 |
|---|------|:---:|:---:|:---:|:---:|:---:|
| 1 | openapi-typescript | ◎ (`.d.ts`만) | 없음 | (수동) | ◎ | ◎ (낮음) |
| 2 | openapi-fetch | O | openapi-fetch 런타임 | (수동) | △ (ky 대체) | O |
| 3 | orval | △ (큰 출력물) | TanStack Query · axios 강제 | ◎ | X (axios 가정) | △ (출력 학습) |
| 4 | swagger-typescript-api | △ | 자체 클라이언트 | △ | X | △ |
| 5 | openapi-zod-client | O | zodios | △ | X | △ |

### 3.3 후보별 차이

- orval — TanStack Query hooks까지 자동 생성하며 출력물이 크다. axios를 가정한다.
- swagger-typescript-api — 자체 클라이언트 클래스를 생성한다.
- openapi-zod-client — zodios 기반으로 zod 스키마를 생성하며 zodios의 별도 멘탈 모델이 필요하다.

---

## 4. 후보 세부 정보

### 4.1 TanStack Query v5
- **장점**: 사실상 React 서버 상태 표준, DevTools, persist + IndexedDB, mutation rollback, query invalidation 표준, suspense·error boundary 통합
- **단점**: query key 컨벤션·무효화 매핑 학습 필요
- **세부사항**: MIT. `@tanstack/react-query@^5` + `@tanstack/react-query-devtools` + `@tanstack/react-query-persist-client`

### 4.2 ky 1.x
- **장점**: fetch 기반 ~5 KB, hooks(`beforeRequest`/`afterResponse`/`beforeRetry`), 내장 retry, `.json<T>()` generic, `credentials: 'include'` 옵션, AbortController 표준
- **단점**: 마인드셰어가 axios 대비 작음 — 표준 인터셉터 시나리오는 자료 충분, 비표준 시나리오에서는 직접 구현 부담
- **세부사항**: MIT. `ky@^1`

### 4.3 openapi-typescript 7.x
- **장점**: 런타임 의존성 0, 출력 가벼움, `components['schemas']['X']` 직접 인덱싱, paths 타입 매핑 정확
- **단점**: 클라이언트·hooks는 별도 작성
- **세부사항**: MIT. `openapi-typescript@^7`

### 4.4 axios
- **장점**: 마인드셰어·인터셉터 사례 풍부, `onUploadProgress`/`onDownloadProgress`
- **단점**: XHR 기반·번들 크기 2.5배, 자동 재시도는 axios-retry 추가 의존성
- **세부사항**: MIT

### 4.5 openapi-fetch
- **장점**: path·method 입력 타입 안전
- **단점**: 인터셉터 미들웨어 패턴이 ky 대비 단순
- **세부사항**: MIT

---

## 5. 비교 요약 표

| 분류 | 후보 | 특징 |
|------|------|------|
| 서버 상태 | TanStack Query v5 | React 표준·낙관적 업데이트·persist·DevTools |
| 서버 상태 | SWR | 가벼움·낙관적 업데이트 수동 |
| 서버 상태 | RTK Query | Redux Toolkit 통합 |
| HTTP | ky 1.x | fetch 기반·~5 KB·hooks·내장 retry |
| HTTP | axios | XHR 기반·~13 KB·업로드 진행률 |
| HTTP | fetch 네이티브 | 0 KB·직접 wrapping |
| 코드젠 | openapi-typescript 7.x | `.d.ts`만 생성·런타임 의존성 0 |
| 코드젠 | openapi-fetch | type-safe 런타임 클라이언트 |
| 코드젠 | orval | 출력 큼·axios 가정 |
| 코드젠 | swagger-typescript-api | 자체 클라이언트 클래스 |
| 코드젠 | openapi-zod-client | zodios 기반 zod 스키마 |
