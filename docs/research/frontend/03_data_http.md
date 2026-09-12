# 서버 상태·HTTP 클라이언트·OpenAPI 코드젠

> **카테고리**: 서버 상태 캐시·refetch·낙관적 업데이트 라이브러리, HTTP 호출 라이브러리, BE OpenAPI 스키마 기반 타입 코드젠 도구 결정
> **연결 spec**: `09_service_design.md` §1 (FastAPI 자동 OpenAPI·orjson), `09_service_design.md` §10 (CORS `allow_credentials: True`), `07_api_spec.md` (22개 endpoint), `12_security.md` §2.3 (Access Token 메모리·Refresh HttpOnly Cookie·Rotation)

---

## 0. 카테고리 구성 & 결정 항목

| 하위 카테고리 | 후보 수 | 결정 항목 수 |
|------------|--------|------------|
| §1 서버 상태 캐시 | 3 | 1 (TanStack Query) |
| §2 HTTP 클라이언트 | 4 | 1 (HTTP 호출) |
| §3 OpenAPI 코드젠 | 5 | 1 (타입 생성 도구) |
| §4 통합 결정 | — | §4 참조 |

### 본 research가 결정하는 항목

| 항목 | 결정 | 결정 근거 위치 |
|------|------|--------------|
| 서버 상태 캐시 | **TanStack Query v5** | §1.4 |
| HTTP 클라이언트 | **ky 1.x** (fetch wrapper) | §2.4 |
| OpenAPI 코드젠 | **openapi-typescript 7.x** (타입만 생성) | §3.4 |

---

## 1. 서버 상태 캐시

### 1.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | TanStack Query v5 | 표준 서버 상태 라이브러리 | 사실상 React 표준 |
| 2 | SWR | Vercel 서버 상태 | 가벼움 |
| 3 | RTK Query (Redux Toolkit) | Redux 통합 | Redux Toolkit 채택 시 자연 사용 |

### 1.2 1차 벤치마크 — 사주라 MVP 필수 기능

| # | 후보 | 캐시·refetch | 낙관적 업데이트 | infinite query | offline·persist | DevTools | 결과 |
|---|------|:---:|:---:|:---:|:---:|:---:|:---|
| 1 | TanStack Query v5 | ◎ | ◎ (`mutation.onMutate` rollback) | ◎ | ◎ (persistQueryClient + IndexedDB) | ◎ | ✅ **통과** |
| 2 | SWR | O | △ (수동) | O | △ | △ | ⛔ |
| 3 | RTK Query | ◎ | ◎ | O | △ | ◎ | ⛔ (Redux 미채택 — `02_routing_state.md` §2.4) |

### 1.3 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| 캐시·자동 refetch (window focus·reconnect) | **필수** | 점주 화면 전환 시 최신 데이터 자동 갱신 — 수동 새로고침 부담 제거 |
| 낙관적 업데이트 | **필수** | 메뉴 등록·재고 수정·발주 승인 등 사용자 액션 즉시 반영 |
| offline·persist | 중요 | PWA — 약한 네트워크에서 캐시된 마지막 응답 사용 가능 |
| DevTools | 중요 | 1인 운영 디버깅 효율 |

**탈락 사유:**

- **#2 SWR** — 가벼움은 장점이나 낙관적 업데이트 표현이 수동에 가까움. 사주라 추천발주 수정 흐름(`04_feature_spec.md` §6.4)에서 rollback이 필요해 표준 API가 있는 TanStack Query 우위.
- **#3 RTK Query** — Redux Toolkit 통합 의도 — `02_routing_state.md` §2에서 Zustand 채택으로 Redux 미사용 → 자연 탈락.

### 1.4 최종 선발

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **서버 상태 캐시** | **TanStack Query v5** ✅ | React 서버 상태 사실상 표준. `useQuery`·`useMutation`·`useInfiniteQuery` 3개 hook으로 사주라 22개 endpoint 모두 표현. mutation `onMutate`/`onError` rollback으로 낙관적 업데이트 표준 패턴. persistQueryClient + IndexedDB로 PWA offline 캐시. DevTools 강력 |

### 1.5 권장 QueryClient 설정

```ts
// app/query-client.ts
import { QueryClient } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,           // 1분
      gcTime: 5 * 60_000,          // 5분
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: (failureCount, error) => {
        // 401·403은 재시도 금지 (auth 인터셉터가 처리)
        if (isAuthError(error)) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

persistQueryClient({
  queryClient,
  persister: createSyncStoragePersister({ storage: window.localStorage }),
  maxAge: 24 * 60 * 60_000,       // 24시간 — backend §9 forecast 캐시 TTL과 정합
  // dehydrate에서 민감 query는 제외 — 사용자별 데이터는 logout 시 clear
});
```

| 옵션 | 값 | 사유 |
|------|---|------|
| `staleTime` | 60s | 사주라 점주 화면 전환 빈도(분 단위)에 적합 |
| `gcTime` | 5m | 짧은 화면 이탈 후 재방문 시 캐시 적중 |
| `retry` 401·403 차단 | — | auth 인터셉터(§2.5)가 단일 책임으로 처리 |
| `maxAge` 24h | — | `09_service_design.md` §9 forecast/recommend 캐시 TTL과 정합 |

### 1.6 쿼리 키 컨벤션

```ts
export const queryKeys = {
  forecast: (storeId: string, targetDate: string) =>
    ['forecast', storeId, targetDate] as const,
  recommend: (storeId: string) =>
    ['recommend', storeId] as const,
  inventory: {
    list: (storeId: string, filters?: InventoryFilters) =>
      ['inventory', storeId, filters] as const,
    detail: (itemId: string) => ['inventory', 'detail', itemId] as const,
  },
  // ... endpoint별 정의
};
```

> BE Redis 캐시 키 패턴(`09_service_design.md` §9 `forecast:{store_id}:{target_date}`)과 동일 구조로 일관 → 캐시 무효화 추적 용이.

---

## 2. HTTP 클라이언트

### 2.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | fetch (네이티브) | 브라우저 표준 | 0 KB, wrapping 필요 |
| 2 | axios | XHR 기반 | 마인드셰어 압도, 인터셉터 풍부 |
| 3 | ky | fetch wrapper | TypeScript first, hooks 기반 |
| 4 | TanStack Query 내장 fetcher | (라이브러리 미내장) | 별도 fetcher 필요 — 분류 외 |

### 2.2 1차 벤치마크 — 사주라 MVP 필수 기능

| # | 후보 | 인터셉터 | 자동 재시도 | TS 1급 | 번들 크기 (gzip) | fetch 기반 | 결과 |
|---|------|:---:|:---:|:---:|:---:|:---:|:---|
| 1 | fetch (네이티브) | ⛔ (수동 wrapping) | ⛔ | △ (Response 타입) | 0 | ◎ | ⛔ (wrapping 비용) |
| 2 | axios | ◎ (request/response) | ⛔ (별도 axios-retry) | O | ~13 KB | ⛔ (XHR) | 🟡 **보존** |
| 3 | ky | ◎ (`beforeRequest`/`afterResponse`/`beforeRetry`) | ◎ (내장) | ◎ | ~5 KB | ◎ | ✅ **통과** |

### 2.3 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| 인터셉터 (auth 헤더·401 처리) | **필수** | Access Token 자동 첨부 + 401 시 refresh + 원요청 재시도 (`12_security.md` §2.3) |
| 자동 재시도 | **필수** | 모바일 PWA — 네트워크 일시 단절 자동 복구 |
| `credentials: 'include'` 지원 | **필수** | Refresh Token HttpOnly Cookie 자동 송수신 (`09_service_design.md` §10.2 `allow_credentials: True`) |
| 번들 크기 작음 | 중요 | PWA 초기 로드 |
| TypeScript 1급 | **필수** | OpenAPI 타입과 통합 (`§3`) |

**탈락 사유:**

- **#1 fetch (네이티브)** — 0 KB는 매력적이나 인터셉터·재시도·timeout·credentials 옵션 정형화 등을 모두 직접 wrapping해야 함. 최종 코드량이 ky보다 많아짐.
- **#2 axios** — 마인드셰어 압도, 트러블슈팅 자료 풍부. 그러나 XHR 기반으로 fetch 기반 ky 대비 번들 크기 2.5배. 자동 재시도는 axios-retry 추가 의존성 필요. fetch가 표준 흐름.

### 2.4 최종 선발

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **HTTP 클라이언트** | **ky 1.x** ✅ | fetch wrapper로 브라우저 표준 동작·번들 ~5 KB. `beforeRequest`·`afterResponse`·`beforeRetry` hooks 3개로 auth·로깅·재시도를 명시적으로 표현. TypeScript first(`.json<T>()` generic 표준). `credentials: 'include'` 옵션으로 Refresh Cookie 자동 처리. 내장 retry로 axios-retry 등 추가 의존성 불필요 |

### 2.5 권장 ky 인스턴스 (auth 인터셉터)

```ts
// lib/http.ts
import ky from 'ky';
import { useAuthStore } from '@/stores/auth';

let refreshPromise: Promise<void> | null = null;

async function refreshAccessToken(): Promise<void> {
  // 동시 다발 401에서 단일 refresh 호출로 합치기
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',          // HttpOnly Cookie 송수신
    });
    if (!res.ok) {
      useAuthStore.getState().clearToken();
      window.location.href = '/login';
      throw new Error('refresh failed');
    }
    const { access_token } = await res.json();
    useAuthStore.getState().setToken(access_token);
  })();
  try {
    await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export const http = ky.create({
  prefixUrl: '/api',
  credentials: 'include',
  timeout: 30_000,
  retry: {
    limit: 2,
    methods: ['get'],                   // mutation은 재시도 안 함 (idempotency 보장 없음)
    statusCodes: [408, 502, 503, 504],
  },
  hooks: {
    beforeRequest: [
      (request) => {
        const token = useAuthStore.getState().accessToken;
        if (token) request.headers.set('Authorization', `Bearer ${token}`);
      },
    ],
    afterResponse: [
      async (request, options, response) => {
        if (response.status !== 401) return response;
        // 단일 refresh 시도, 성공 시 원요청 재시도
        try {
          await refreshAccessToken();
        } catch {
          return response;             // refresh 실패 — 401 그대로 반환
        }
        const token = useAuthStore.getState().accessToken;
        request.headers.set('Authorization', `Bearer ${token}`);
        return ky(request);
      },
    ],
  },
});
```

| 인터셉터 단계 | 책임 |
|------------|------|
| `beforeRequest` | Access Token Authorization 헤더 첨부 (Zustand store에서 메모리 조회) |
| `afterResponse` 401 | 단일 refresh 호출 — 동시 다발 401에서 refreshPromise 합치기, 성공 시 원 요청 재시도 |
| `retry` GET 한정 | mutation idempotency 미보장으로 자동 재시도 차단 |

### 2.6 보존 후보 (axios)

마인드셰어 압도·인터셉터 사례·진행 상태 표시(`onUploadProgress`) 강점. 다음 트리거 충족 시 마이그레이션 검토.

**재평가 트리거:**

| 지표 | 임계치 |
|------|------|
| 업로드 진행률 UI 필요 (CSV 대용량 파일) | 화면 3개+ |
| ky로 표현 불가능한 인터셉터 시나리오 발생 | 사례 2건+ |
| ky 라이브러리 유지보수 정체 | 6개월 commit 없음 |

→ 1개 이상 충족 시 axios 마이그레이션 검토. (사주라 CSV 업로드는 `/api/sales/upload`이나 평균 1MB·9000건 — `04_data_layer.md` §3 가정으로 진행률 UI 필요도 낮음)

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

### 3.2 1차 벤치마크 — 사주라 MVP 필수 기능

| # | 후보 | 출력 가벼움 | 런타임 의존성 | TanStack Query 통합 | ky와 결합 가능 | 1인 운영 학습 비용 | 결과 |
|---|------|:---:|:---:|:---:|:---:|:---:|:---|
| 1 | openapi-typescript | ◎ (`.d.ts`만) | 없음 | (수동) | ◎ | ◎ (낮음) | ✅ **통과** |
| 2 | openapi-fetch | O | openapi-fetch 런타임 | (수동) | △ (ky 대체) | O | 🟡 **보존** |
| 3 | orval | △ (큰 출력물) | TanStack Query · axios 강제 | ◎ | ⛔ (axios 가정) | △ (출력 학습) | ⛔ |
| 4 | swagger-typescript-api | △ | 자체 클라이언트 | △ | ⛔ | △ | ⛔ |
| 5 | openapi-zod-client | O | zodios | △ | ⛔ | △ | ⛔ (zodios 멘탈 모델 추가) |

### 3.3 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| BE OpenAPI 스키마 → FE 타입 동기 | **필수** | FastAPI 자동 생성 OpenAPI 활용 — 22개 endpoint 타입 수동 관리 비용 회피 |
| 출력 가벼움·런타임 의존성 최소 | **필수** | 1인 운영 — 큰 출력물 관리 부담 회피 |
| ky 결합 가능 | **필수** | §2.4 ky 결정 후 — axios 강제 도구 회피 |

**탈락 사유:**

- **#3 orval** — TanStack Query hooks까지 자동 생성하는 강점은 endpoint 100+ 규모에서 효과 큼. 사주라 22개에서는 출력물 관리·학습 비용이 이득 초과. axios 가정으로 ky와 부정합.
- **#4 swagger-typescript-api** — 자체 클라이언트 클래스 생성으로 ky 인터셉터 정합 어려움.
- **#5 openapi-zod-client** — zodios는 별도 멘탈 모델 추가. zod 스키마 자동 생성 매력적이나 사주라는 OpenAPI 타입은 코드젠으로, zod 검증은 수동 작성하는 분리 정책 채택(zod는 사용자 입력 검증·BE 응답 sanity check에 한정 — `05_form_validation.md`).

### 3.4 최종 선발

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **OpenAPI 코드젠** | **openapi-typescript 7.x** ✅ | `.d.ts` 파일 1개로 BE OpenAPI 전체 타입 표현. 런타임 의존성 0. ky `.json<T>()`의 generic에 `components['schemas']['UserDTO']` 등 직접 주입 가능. 1인 운영 환경에서 출력물·학습 비용 최소 |

### 3.5 권장 워크플로우

```bash
# package.json
"scripts": {
  "gen:api": "openapi-typescript http://localhost:8000/openapi.json -o ./src/types/api.d.ts"
}
```

```ts
// 사용 예
import type { components } from '@/types/api';
import { http } from '@/lib/http';

type UserDTO = components['schemas']['UserDTO'];

export async function fetchMe(): Promise<UserDTO> {
  return await http.get('auth/me').json<UserDTO>();
}
```

| 단계 | 처리 |
|------|------|
| BE 스키마 변경 | 개발자 수동 `pnpm gen:api` 실행 (또는 pre-commit hook으로 자동화 검토) |
| CI 검증 | `gen:api` 산출이 commit과 일치하는지 확인 — 불일치 시 PR 차단 |
| 컴파일 | `api.d.ts` import → TS strict가 타입 검증 |

### 3.6 보존 후보 (openapi-fetch)

런타임 type-safe client가 매력적이나 사주라는 ky 인터셉터 흐름(auth·재시도·로깅)을 이미 표준화 — ky 대체 시 인터셉터 패턴 재구축 비용 발생.

**재평가 트리거:**

| 지표 | 임계치 |
|------|------|
| 수동 ky.get/post path 입력 오타 버그 | 분기 3건+ |
| ky 인터셉터 흐름과 동등하게 openapi-fetch 미들웨어 표현 가능 | 사례 확인 |

→ 두 조건 충족 시 openapi-fetch 마이그레이션 검토.

---

## 4. 통합 최종 결정 (spec 반영)

### 4.1 결정 항목 (3건)

| 항목 | 결정 | spec 반영 위치 |
|------|------|--------------|
| 서버 상태 캐시 | **TanStack Query v5** | FE spec 신설 시 명시 |
| HTTP 클라이언트 | **ky 1.x** | FE spec 신설 시 명시. `09_service_design.md` §10.2 CORS `allow_credentials: True` 정합 확인 (변경 없음) |
| OpenAPI 코드젠 | **openapi-typescript 7.x** | FE spec 신설 시 명시. BE FastAPI `/openapi.json` 자동 노출(이미 활성) |

> 본 카테고리 결정은 BE 측 변경 유발 없음. CORS·credentials·401 응답 형식은 이미 `09_service_design.md` §10·`12_security.md` §2.3에서 정의됨.

### 4.2 결정에 따라 다른 카테고리에 미치는 영향

| 영향 | 영향 받는 카테고리 |
|------|----------------|
| ky `credentials: 'include'` → CORS `allow_credentials: True` 정합 확인 | `08_auth_security.md` |
| openapi-typescript → CI에서 코드젠 산출 일치 검증 | `09_testing_quality.md` (pre-commit/CI 단계), `10_deployment.md` |
| TanStack Query persist → IndexedDB · localStorage 정책 | `06_pwa_push.md` (offline 캐시 정합) |

---

## 5. 후보 세부 정보

### 5.1 TanStack Query v5 ✅
- **사용처**: 22개 endpoint 모두 `useQuery`/`useMutation`/`useInfiniteQuery`
- **장점**: 사실상 React 서버 상태 표준, DevTools, persist + IndexedDB, mutation rollback, query invalidation 표준, suspense·error boundary 통합
- **단점**: query key 컨벤션·무효화 매핑 학습 필요 — 1회 정착 후 비용 작음
- **세부사항**: MIT. `@tanstack/react-query@^5` + `@tanstack/react-query-devtools` + `@tanstack/react-query-persist-client`

### 5.2 ky 1.x ✅
- **사용처**: 모든 HTTP 호출 (`http.get·post·put·delete·patch`)
- **장점**: fetch 기반 ~5 KB, hooks(`beforeRequest`/`afterResponse`/`beforeRetry`), 내장 retry, `.json<T>()` generic, `credentials: 'include'` 옵션, AbortController 표준
- **단점**: 마인드셰어가 axios 대비 작음 — 표준 인터셉터 시나리오는 자료 충분, 비표준 시나리오에서는 직접 구현 부담
- **세부사항**: MIT. `ky@^1`

### 5.3 openapi-typescript 7.x ✅
- **사용처**: BE OpenAPI → FE 타입 `.d.ts` 생성
- **장점**: 런타임 의존성 0, 출력 가벼움, `components['schemas']['X']` 직접 인덱싱, paths 타입 매핑 정확
- **단점**: 클라이언트는 별도 작성(ky)·hooks도 별도 작성 — 사주라 22개 endpoint 규모에서 무관
- **세부사항**: MIT. `openapi-typescript@^7`

### 5.4 axios 🟡 (보존)
- **사용처**: ky로 표현 불가능한 인터셉터 시나리오 또는 업로드 진행률 UI 필요 시
- **장점**: 마인드셰어·인터셉터 사례 풍부, `onUploadProgress`/`onDownloadProgress`
- **단점**: XHR 기반·번들 크기 2.5배, 자동 재시도는 axios-retry 추가 의존성
- **세부사항**: MIT

### 5.5 openapi-fetch 🟡 (보존)
- **사용처**: ky 대체 type-safe 런타임 클라이언트
- **장점**: path·method 입력 타입 안전
- **단점**: 인터셉터 미들웨어 패턴 ky 대비 단순 — 표준화 비용
- **세부사항**: MIT

### 5.6 탈락 후보 요약

| 후보 | 분류 | 탈락 사유 |
|------|------|---------|
| SWR | 서버 상태 | 낙관적 업데이트 수동·DevTools 약함 |
| RTK Query | 서버 상태 | Redux 미채택 |
| fetch 네이티브 | HTTP | wrapping 비용 |
| orval | 코드젠 | 출력물 큼·axios 가정 |
| swagger-typescript-api | 코드젠 | 자체 클라이언트 — ky 정합 어려움 |
| openapi-zod-client | 코드젠 | zodios 멘탈 모델 추가 |

---

## 6. 비교 요약 표

| 분류 | 후보 | 결과 | 핵심 사유 |
|------|------|------|---------|
| 서버 상태 | TanStack Query v5 | ✅ | React 표준·낙관적 업데이트·persist·DevTools |
| 서버 상태 | SWR | ⛔ | 낙관적 업데이트 수동 |
| 서버 상태 | RTK Query | ⛔ | Redux 미채택 |
| HTTP | ky 1.x | ✅ | fetch 기반·~5 KB·hooks·내장 retry |
| HTTP | axios | 🟡 보존 | 업로드 진행률 UI 트리거 |
| HTTP | fetch 네이티브 | ⛔ | wrapping 비용 |
| 코드젠 | openapi-typescript 7.x | ✅ | 런타임 의존성 0·ky generic 결합 |
| 코드젠 | openapi-fetch | 🟡 보존 | path 입력 오타 트리거 |
| 코드젠 | orval | ⛔ | 출력 큼·axios 강제 |
| 코드젠 | swagger-typescript-api | ⛔ | 자체 클라이언트 클래스 |
| 코드젠 | openapi-zod-client | ⛔ | zodios 멘탈 모델 추가 |
