# 라우팅·클라이언트 상태

> **카테고리**: 라우터 라이브러리, 클라이언트 사이드 상태 관리 라이브러리 결정
> **연결 spec**: `04_feature_spec.md` §12 (화면 IA — 라우트 구조 파생), `12_security.md` §2.3 (Access Token 메모리 저장 — 클라이언트 상태에 보관)

---

## 0. 카테고리 구성 & 결정 항목

| 하위 카테고리 | 후보 수 | 결정 항목 수 |
|------------|--------|------------|
| §1 라우터 | 4 | 1 (라우터 라이브러리) |
| §2 클라이언트 상태 | 7 | 1 (전역 상태 라이브러리) |
| §3 통합 결정 | — | §3 참조 |

> 서버 상태(API 응답 캐시·refetch·낙관적 업데이트)는 본 카테고리 범위 외 — `03_data_http.md` (TanStack Query)에서 결정. 폼 상태는 `05_form_validation.md` (React Hook Form).

### 본 research가 결정하는 항목

| 항목 | 결정 | 결정 근거 위치 |
|------|------|--------------|
| 라우터 | **React Router v7** (declarative + data router mode) | §1.4 |
| 클라이언트 상태 | **Zustand** | §2.4 |

---

## 1. 라우터

### 1.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | React Router v7 | 표준 라우터 | Remix와 통합되었으나 라이브러리 모드(SPA)로 사용 가능 |
| 2 | TanStack Router 1.x | 타입 안전 라우터 | 파일 기반 + 코드 기반, 강력한 type-safe params |
| 3 | Wouter | 경량 라우터 | < 2KB, 최소 기능 |
| 4 | React Router v6 | 이전 메이저 | v7로 마이그레이션 권장 |

### 1.2 1차 벤치마크 — 사주라 MVP 필수 기능

| # | 후보 | 중첩 라우팅 | 보호 라우트 | 코드 분할 (lazy) | 타입 안전 params | 마인드셰어·자료 | 결과 |
|---|------|:---:|:---:|:---:|:---:|:---:|:---|
| 1 | React Router v7 | ◎ | ◎ (loader·action·loader guard) | ◎ (`lazy` route export) | O (manual `useParams<...>()` 또는 generated) | ◎ (압도) | ✅ **통과** |
| 2 | TanStack Router | ◎ | ◎ (beforeLoad) | ◎ | ◎ (자동 추론) | △ (성장 중) | 🟡 **보존** |
| 3 | Wouter | ⛔ (flat) | △ (수동) | O | △ | △ | ⛔ |
| 4 | React Router v6 | ◎ | ◎ | O | O | ◎ | ⛔ (v7로 마이그레이션 권장) |

### 1.3 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| 중첩 라우팅 (`/inventory/:itemId/lots`) | **필수** | `04_feature_spec.md` §12.6 재고 상세 → 로트 |
| 보호 라우트 (인증·온보딩 가드) | **필수** | `04_feature_spec.md` §1.4 onboarding_completed 미완료 시 강제 이동 |
| 코드 분할 (lazy route) | **필수** | 화면 10개 — 초기 번들 분할로 PWA 첫 로드 가속 |
| 타입 안전 params | 중요 | TS strict 환경 — params 누락·오타 컴파일 차단 |

**탈락 사유:**

- **#3 Wouter** — 중첩 라우팅 미지원. 사주라 화면 IA에서 재고 상세·발주 상세·메뉴 상세 등 중첩이 자연스러우므로 구조 표현 불리.
- **#4 React Router v6** — v7이 출시된 이상 신규 프로젝트에서 v6 채택 불필요. 마이그레이션 비용 회피.

### 1.4 최종 선발

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **라우터** | **React Router v7 (declarative + data router mode)** ✅ | SPA 모드(`createBrowserRouter` + `RouterProvider`)로 Remix 의존 없이 사용. loader / action으로 라우트 진입 시 인증·온보딩 가드 표준 표현. `lazy` route export로 코드 분할 1줄 표현. 마인드셰어·자료·StackOverflow 누적이 압도적 — 1인 운영 환경 트러블슈팅 비용 최소 |

### 1.5 라우트 구조 권장 (사주라 IA)

```
/login                                # public
/onboarding                           # 인증 후 + onboarding_completed=false 가드
  /step/business-no
  /step/store-info
  /step/pos
  /step/initial-inventory
/                                     # 인증 + onboarding 완료 가드 (홈)
  /menu                               # 메뉴 관리
    /:menuId
  /inventory                          # 재고 관리
    /:itemId
      /lots
  /sales                              # 판매 데이터
  /forecast                           # 수요예측
  /orders                             # 추천발주
    /:orderId
  /dashboard                          # 대시보드
  /settings                           # 설정
    /pos
    /notifications
    /account
```

> 권장 패턴 — 가드는 부모 라우트의 loader에서 `redirect()`로 표현 (React Router v7 표준).

### 1.6 보존 후보 (TanStack Router)

타입 안전 params 자동 추론과 search params 스키마 검증이 강점. React Router v7과 동일 멘탈 모델이지만 타입 유추가 더 강력. 다음 트리거 충족 시 마이그레이션 검토.

**재평가 트리거:**

| 지표 | 임계치 |
|------|------|
| 라우트 수 | ≥ 50 (현재 사주라 ~25) |
| params 타입 오류로 인한 런타임 버그 | 분기당 3건+ |
| search params 스키마 검증 필요 (필터·정렬 다수) | 화면 5개+ |

→ 2개 이상 충족 시 TanStack Router 마이그레이션 검토.

---

## 2. 클라이언트 상태

### 2.1 사주라 클라이언트 상태 범위 (서버 상태 분리)

| 영역 | 저장 방식 |
|------|---------|
| **서버 상태** (API 응답·캐시·refetch) | TanStack Query (`03_data_http.md` §1) — 본 카테고리 범위 외 |
| **폼 상태** | React Hook Form (`05_form_validation.md`) — 본 카테고리 범위 외 |
| **클라이언트 전역 상태** | 본 카테고리 결정 |
| └ Access Token (메모리, `12_security.md` §2.3) | |
| └ 현재 사용자·매장 정보 (token decode 캐시) | |
| └ 알림 UI 표시 상태 (배지 카운트·드롭다운 open) | |
| └ 테마·언어 | |
| └ 알림 polling 주기 설정 | |

### 2.2 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | Zustand | 단순 store | < 1KB, 훅 기반 |
| 2 | Redux Toolkit | flux/redux | DevTools·미들웨어·RTK Query |
| 3 | Jotai | atomic | primitive atom 단위 |
| 4 | Recoil | atomic | **Meta 유지보수 정체** |
| 5 | React Context (내장) | 기본 | re-render 광범위 |
| 6 | MobX | observable | 데코레이터 패턴 |
| 7 | Valtio | proxy | atomic + proxy |

### 2.3 1차 벤치마크 — 사주라 MVP 필수 기능

| # | 후보 | 보일러플레이트 | TS 1급 | DevTools | persist 미들웨어 | 번들 크기 | 결과 |
|---|------|:---:|:---:|:---:|:---:|:---:|:---|
| 1 | Zustand | ◎ (store 함수 1개) | ◎ | O (devtools 미들웨어) | ◎ (persist 미들웨어) | ◎ (< 1KB gzip) | ✅ **통과** |
| 2 | Redux Toolkit | △ (slice·reducer·action) | ◎ | ◎ | ◎ (redux-persist) | △ (~10KB gzip) | ⛔ (사주라 규모 초과) |
| 3 | Jotai | O | ◎ | O | O (jotai/utils) | ◎ | 🟡 **보존** |
| 4 | Recoil | O | O | △ | O | O | ⛔ (유지보수 정체) |
| 5 | React Context | ◎ (내장) | ◎ | ⛔ | ⛔ (수동) | 0 | ⛔ (전역 상태에 re-render 비효율) |
| 6 | MobX | △ (데코레이터·observer) | △ (TS 데코레이터 설정 부담) | O | ⛔ (수동) | △ | ⛔ |
| 7 | Valtio | O | O | △ | O | O | ⛔ (마인드셰어 약함) |

### 2.4 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| 최소 보일러플레이트 | **필수** | 사주라 전역 상태 범위가 작음(인증·테마·알림 UI) — 무거운 도구 불필요 |
| TypeScript 1급 | **필수** | strict 환경 |
| persist 미들웨어 (선택) | 중요 | 테마·알림 polling 주기 등 사용자 설정은 localStorage 영속. 단, Access Token은 절대 persist 금지(`12_security.md` §2.3) |
| Redux DevTools 호환 | 선택 | 디버깅 편의 |

**탈락 사유:**

- **#2 Redux Toolkit** — slice·reducer·action·dispatch 패턴이 사주라 전역 상태 범위(5~7개 key)에 과함. RTK Query는 TanStack Query와 기능 중복 → 둘 중 하나만 선택해야 하는데, FE 생태계 표준성·React 외 호환은 TanStack Query 우위.
- **#4 Recoil** — Meta 유지보수 정체(2023 이후 commit 거의 없음). 기술 부채 위험.
- **#5 React Context (단독)** — 값 변경 시 consumer 전체 re-render. 사주라 알림 polling으로 자주 갱신되는 값에 부적합. 단, 정적 값(테마 토큰 등)에는 부분 사용 가능.
- **#6 MobX** — TS strict + 데코레이터 설정 부담. React 생태계 마인드셰어 약화.
- **#7 Valtio** — proxy 모델 우수하지만 마인드셰어가 Zustand·Jotai 대비 낮음. 1인 운영 트러블슈팅 자료 부족.

### 2.5 최종 선발

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **클라이언트 상태** | **Zustand 5** ✅ | store 함수 1개로 시작, `subscribe`·`getState` 같은 hook 외 API 풍부, persist·devtools·immer 미들웨어 조합 자유. 사주라 전역 상태 5~7개 key 규모에 보일러플레이트 최소. selector 패턴으로 re-render 정밀 제어 가능 |

### 2.6 권장 store 구성

```ts
// stores/auth.ts — Access Token 메모리 + user/store info
import { create } from 'zustand';

type AuthState = {
  accessToken: string | null;
  user: { id: string; email: string } | null;
  storeId: string | null;
  setToken: (token: string) => void;
  clearToken: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,           // 메모리만 — persist 절대 금지 (12_security.md §2.3)
  user: null,
  storeId: null,
  setToken: (token) => set({ accessToken: token }),
  clearToken: () => set({ accessToken: null, user: null, storeId: null }),
}));
```

```ts
// stores/preferences.ts — 테마 등 사용자 영속 설정
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type PreferencesState = {
  theme: 'light' | 'dark';
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'light',
    }),
    { name: 'saju-preferences' },   // localStorage key
  ),
);
```

> 핵심 분리: `auth` store는 **persist 미사용**(메모리만), `preferences` store는 persist 사용. 토큰을 절대 localStorage에 저장하지 않도록 store를 물리적으로 분리.

> 알림 폴링 주기는 **점주 설정 항목에서 제외**한다 — 사용자가 임의로 낮추면 BE rate limit(`GET /api/notifications` 60/min, `09_service_design.md` §10.4)을 초과할 수 있고, 즉시성은 Web Push가 담당하므로 폴링 주기 노출 가치가 작다. 폴링 주기는 코드 상수 5분 고정 (`06_pwa_push.md` §3.6).

### 2.7 보존 후보 (Jotai)

primitive atom 단위 상태 모델은 사주라 알림 카운트·필터 등 fine-grained 상태에 적합. 다음 트리거 충족 시 부분 도입 검토.

**재평가 트리거:**

| 지표 | 임계치 |
|------|------|
| 전역 상태 key 수 | ≥ 20 (현재 ~7) |
| Zustand selector로도 해결 안 되는 re-render 병목 | 화면 5개+ |
| atom 단위 의존성 그래프 필요 (파생 상태 다수) | — |

→ 2개 이상 충족 시 부분 도입(특정 도메인 atom만) 검토.

---

## 3. 통합 최종 결정 (spec 반영)

### 3.1 결정 항목 (2건)

| 항목 | 결정 | spec 반영 위치 |
|------|------|--------------|
| 라우터 | **React Router v7** | FE spec 신설 시 명시 (영향: 코드 구조만, schema/api/service 영향 없음) |
| 클라이언트 상태 | **Zustand 5** | FE spec 신설 시 명시 |

> Access Token 메모리 보관 정책(`12_security.md` §2.3)은 본 카테고리 결정으로 인해 변경 없음 — Zustand store에 단순히 `accessToken` 필드를 메모리로 유지하는 것으로 정합.

### 3.2 결정에 따라 다른 카테고리에 미치는 영향

| 영향 | 영향 받는 카테고리 |
|------|----------------|
| React Router v7 → lazy route로 vite manualChunks와 정합 | `01_framework_build.md` §2.5 |
| Zustand → persist 미들웨어로 사용자 설정만 영속 | `08_auth_security.md` (Access Token 분리 정책 재확인) |

---

## 4. 후보 세부 정보

### 4.1 React Router v7 ✅
- **사용처**: 전체 라우팅
- **장점**: 마인드셰어·자료 압도적. SPA 모드 + data router(`createBrowserRouter`) + loader/action으로 진입 가드·데이터 prefetch 표준 표현. `lazy` import로 코드 분할 1줄
- **단점**: 자동 타입 추론은 TanStack Router 대비 약함 (수동 generic 또는 generated types 필요)
- **세부사항**: MIT 라이선스. `react-router@^7`

### 4.2 Zustand 5 ✅
- **사용처**: 전역 클라이언트 상태 (auth · preferences · notification UI 등)
- **장점**: API 표면 최소(`create` + selector hook), 미들웨어 조합(persist·devtools·immer·subscribeWithSelector), Provider 불필요
- **단점**: 정적 분석 도구(action tracker 등)는 Redux Toolkit 대비 약함 — 사주라 규모에서 무관
- **세부사항**: MIT. `zustand@^5`

### 4.3 TanStack Router 🟡 (보존)
- **사용처**: 라우트 수 증가·params 타입 안전 강화 필요 시 마이그레이션
- **장점**: 자동 타입 추론·search params 스키마(zod 연동)·beforeLoad 가드
- **단점**: 마인드셰어 성장 중, 자료가 React Router 대비 적음
- **세부사항**: MIT

### 4.4 Jotai 🟡 (보존)
- **사용처**: atomic 상태 모델 필요 시 부분 도입
- **장점**: primitive atom + derived atom으로 fine-grained 의존성 표현
- **단점**: 멘탈 모델 학습 비용·디버깅 복잡도
- **세부사항**: MIT

### 4.5 탈락 후보 요약

| 후보 | 분류 | 탈락 사유 |
|------|------|---------|
| Wouter | 라우터 | 중첩 라우팅 미지원 |
| React Router v6 | 라우터 | v7로 마이그레이션 권장 |
| Redux Toolkit | 상태 | 사주라 전역 상태 규모에 과함·RTK Query는 TanStack Query와 중복 |
| Recoil | 상태 | 유지보수 정체 |
| React Context (단독) | 상태 | re-render 광범위 |
| MobX | 상태 | TS strict 환경 데코레이터 부담·마인드셰어 약화 |
| Valtio | 상태 | 마인드셰어 약함 |

---

## 5. 비교 요약 표

| 분류 | 후보 | 결과 | 핵심 사유 |
|------|------|------|---------|
| 라우터 | React Router v7 | ✅ | 마인드셰어·data router·lazy·자료 압도 |
| 라우터 | TanStack Router | 🟡 보존 | 타입 추론 강력 — 라우트 50+ 트리거 |
| 라우터 | Wouter | ⛔ | 중첩 미지원 |
| 라우터 | React Router v6 | ⛔ | v7로 대체 |
| 상태 | Zustand 5 | ✅ | 보일러플레이트 최소·persist 분리·번들 < 1KB |
| 상태 | Jotai | 🟡 보존 | atomic — 전역 상태 20+ 트리거 |
| 상태 | Redux Toolkit | ⛔ | 사주라 규모 초과·RTK Query 중복 |
| 상태 | Recoil | ⛔ | 유지보수 정체 |
| 상태 | Context (단독) | ⛔ | re-render 광범위 |
| 상태 | MobX / Valtio | ⛔ | 마인드셰어·운영 부담 |
