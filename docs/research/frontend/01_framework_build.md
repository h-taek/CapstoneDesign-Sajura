# UI 프레임워크·빌드·언어

> **카테고리**: UI 프레임워크(React 가정 ratify), 빌드/번들러 도구, 언어(TypeScript) 선정
> **연결 spec**: `03_mvp_scope.md` §3 (React + PWA 명시), `09_service_design.md` §11 (Caddy 정적 서빙 — `caddy:alpine`이 BE 컨테이너 옆에서 PWA 산출물 호스팅), `04_feature_spec.md` §12 (화면 IA)

---

## 0. 카테고리 구성 & 결정 항목

| 하위 카테고리 | 후보 수 | 결정 항목 수 |
|------------|--------|------------|
| §1 UI 프레임워크 | 4 | 1 (React ratify) |
| §2 빌드·번들러 | 7 | 1 (개발 + 운영 빌드 도구) |
| §3 언어 | 2 | 1 (TypeScript 채택) |
| §4 통합 결정 | — | §4 참조 |

### 본 research가 결정하는 항목

| 항목 | 결정 | 결정 근거 위치 |
|------|------|--------------|
| UI 프레임워크 | **React 19** (mvp_scope ratify) | §1.4 |
| 빌드·번들러 | **Vite 6 + Rollup(production)** | §2.4 |
| 언어 | **TypeScript 5.x (strict)** | §3.4 |

---

## 1. UI 프레임워크

### 1.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | React 19 | 컴포넌트형 SPA | 03_mvp_scope.md §3에서 명시 — ratify 대상 |
| 2 | Vue 3 | 컴포넌트형 SPA | |
| 3 | Svelte 5 (SvelteKit) | 컴파일형 | |
| 4 | SolidJS | 컴파일형 reactive | |

### 1.2 1차 벤치마크 — 사주라 MVP 필수 기능

| # | 후보 | 생태계(차트/폼/PWA) | TypeScript 1급 | 팀 친숙도 | PWA 통합 도구 | 결과 |
|---|------|:---:|:---:|:---:|:---:|:---|
| 1 | React 19 | ◎ (Recharts·ECharts wrapper·RHF·TanStack 모두 React 1급) | ◎ | ◎ (03_mvp_scope.md §3 명시) | ◎ (vite-plugin-pwa·Workbox React 예제 풍부) | ✅ **통과** |
| 2 | Vue 3 | O | O | ⛔ (선언 자체에 없음) | O | ⛔ |
| 3 | Svelte 5 | △ (TanStack Query Svelte 어댑터 베타) | O | ⛔ | △ | ⛔ |
| 4 | SolidJS | △ | O | ⛔ | △ | ⛔ |

### 1.3 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| mvp_scope ratify | **필수** | `03_mvp_scope.md` §3에 React 명시 — 본 research가 변경할 사항 아님 |
| 생태계 폭 (차트·폼·PWA·TanStack Query) | **필수** | 1인 운영 팀 — 필요한 라이브러리가 React 1급으로 존재해야 함 |
| TypeScript 1급 | **필수** | BE pydantic v2 ↔ FE zod 통합 + OpenAPI 코드젠 |

- **#2 Vue 3 / #3 Svelte 5 / #4 SolidJS** — 기술적으로 모두 React 동등 또는 우위 영역이 있으나, 03_mvp_scope.md §3에서 React가 명시되어 있고 사주라 팀 친숙도가 React 기준임. 변경 시 모든 라이브러리 결정 재실행 비용이 크고, 변경에 따른 기능적 이득이 작음.

### 1.4 최종 선발

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| UI 프레임워크 | **React 19** ✅ | 03_mvp_scope.md §3 ratify. 사주라 MVP는 점주용 운영 도구로 SEO 불필요·단일 origin SPA + PWA → React가 가장 적합. React 19의 Actions·`use()`·자동 메모이제이션은 사주라 화면 복잡도(IA `04_feature_spec.md` §12)에 충분 |

---

## 2. 빌드·번들러

### 2.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | Vite 6 | 메타 프레임워크 (dev: esbuild + prod: Rollup) | 활발 |
| 2 | Next.js 15 | React 메타 프레임워크 | SSR·RSC·App Router |
| 3 | Remix v2 | React 메타 프레임워크 | SSR·중첩 라우팅 |
| 4 | Astro 5 | 정적 사이트 중심 | islands 아키텍처 |
| 5 | Create React App | 레거시 SPA 생성기 | **2023 deprecated** |
| 6 | Parcel 2 | 번들러 | zero config |
| 7 | Webpack 5 | 번들러 | CRA 내장 |

### 2.2 1차 벤치마크 — 사주라 MVP 필수 기능

| # | 후보 | dev HMR 속도 | SPA + PWA 표준 | vite-plugin-pwa 호환 | TS 1급 | 1인 운영 단순성 | 결과 |
|---|------|:---:|:---:|:---:|:---:|:---:|:---|
| 1 | Vite 6 | ◎ (ESM dev server, ms 단위) | ◎ | ◎ (공식 플러그인) | ◎ | ◎ | ✅ **통과** |
| 2 | Next.js 15 | O (Turbopack β) | ⛔ (SSR 기본·정적 export는 부분 지원) | △ (next-pwa 비공식) | ◎ | ⛔ (RSC 학습·서버 의존) | ⛔ |
| 3 | Remix v2 | O | ⛔ (SSR 기본) | ⛔ | ◎ | ⛔ | ⛔ |
| 4 | Astro 5 | O | △ (SPA 아님 — 정적 + island) | △ | O | ⛔ (점주용 SPA 부적합) | ⛔ |
| 5 | CRA | △ | ◎ | △ | O | ⛔ (deprecated, 보안 패치 정지) | ⛔ |
| 6 | Parcel 2 | O | O | △ (활발도 약함) | O | △ | ⛔ |
| 7 | Webpack 5 | ⛔ (rebuild 수 초) | O | △ (workbox-webpack-plugin) | O | ⛔ (설정 부담) | ⛔ |

### 2.3 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| dev HMR 빠름 (< 200ms) | **필수** | 점주용 화면 IA(`04_feature_spec.md` §12)가 10개 이상으로 다수 — 개발 사이클 가속 |
| SPA + PWA 표준 | **필수** | `03_mvp_scope.md` §3 PWA + Caddy 정적 서빙(`09_service_design.md` §11) |
| vite-plugin-pwa 또는 동등 PWA 플러그인 | **필수** | Workbox precaching + Service Worker 자동 생성 — `06_pwa_push.md`와 직결 |
| 1인 운영 단순성 | **필수** | 사주라 운영 환경은 BE 1인 + FE 다수지만 도구는 단순할수록 유지보수 비용 작음 |

**탈락 사유:**

- **#2 Next.js 15** — RSC·SSR·App Router 모두 사주라 MVP에 불필요. 점주용 운영 도구는 인증 후 사용하므로 SEO 미요구. SSR 도입 시 BE FastAPI(`01_web_framework.md` 결정)와 별도 Node 서버가 필요해 운영 컨테이너 1개 추가 — `09_service_design.md` §11 6 서비스 구성을 7개로 부풀림. RSC는 BE FastAPI와 정합 어려움(서버 측 React 실행 환경 분리).
- **#3 Remix v2** — Next.js와 동일한 SSR·서버 의존 사유로 탈락.
- **#4 Astro 5** — islands 아키텍처는 콘텐츠 사이트(블로그·문서) 중심으로 사주라 점주 대시보드와 동작 모델 다름. 모든 화면이 인터랙티브한 사주라 IA에 부적합.
- **#5 CRA** — 2023 deprecated, 보안 패치 중단. 선택 자체가 위험.
- **#6 Parcel 2** — zero config는 장점이나 PWA 플러그인 활발도가 Vite 대비 약함. 운영 사례·트러블슈팅 자료 부족.
- **#7 Webpack 5** — dev HMR rebuild 수 초 — 화면 10개 규모에서 누적 비용 큼. 설정 파일 직접 작성 부담.

### 2.4 최종 선발

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **빌드·번들러** | **Vite 6** ✅ | dev: esbuild로 ms 단위 HMR / prod: Rollup로 tree-shake·code split. SPA + PWA + React + TypeScript 표준 조합. vite-plugin-pwa 공식 활발(Workbox precaching·런타임 캐시 정의 한 파일). 1인 운영 환경에 단순성·성능 모두 만족 |

### 2.5 운영 옵션 권장값

```ts
// vite.config.ts (스켈레톤)
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    VitePWA({
      // 상세 옵션: docs/research/frontend/06_pwa_push.md
      registerType: 'autoUpdate',
      strategies: 'generateSW',
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: true,         // Sentry source map 업로드 정합 (backend 07 §3.3)
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          tanstack: ['@tanstack/react-query', '@tanstack/react-router'],
          charts: ['recharts'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8000',   // dev에서 BE Uvicorn으로 프록시
    },
  },
});
```

| 옵션 | 값 | 사유 |
|------|---|------|
| `build.target` | `es2022` | PWA 대상 — iOS Safari 16.4+·Chrome 모바일 최신 (Web Push 정합) |
| `build.sourcemap` | `true` | Sentry release source map 업로드 정합 |
| `rollupOptions.manualChunks` | react · tanstack · charts 분리 | 캐시 적중률·초기 로드 시간 |
| `server.proxy` | `/api` → BE Uvicorn | dev 환경 CORS 회피 |

### 2.6 보존 후보 (Next.js)

Next.js는 SSR·SEO·이미지 최적화·미들웨어 등 풍부한 기능을 제공한다. 사주라 2단계 이상에서 다음 조건 충족 시 재평가 후보.

**재평가 트리거:**

| 지표 | 임계치 |
|------|------|
| 공개 마케팅·랜딩 페이지 SEO 필요 | 도입 |
| 화면 단위 코드 분할 부족으로 초기 번들 > 1MB | 1주 지속 |
| 매장 1000+ → Edge·CDN 캐시 필요 | 도입 |

→ 1개 이상 충족 시 마케팅 페이지만 Next.js 별도 분리 검토 (사주라 본체 React+Vite는 유지).

---

## 3. 언어

### 3.1 전체 후보 목록

| # | 후보 | 비고 |
|---|------|------|
| 1 | TypeScript 5.x | 정적 타입 + 추론 |
| 2 | JavaScript (ES2022+) + JSDoc | 타입 어노테이션 JSDoc |

### 3.2 1차 벤치마크

| # | 후보 | 정적 타입 | OpenAPI 코드젠 호환 | zod 통합 | React 생태계 표준 | 결과 |
|---|------|:---:|:---:|:---:|:---:|:---|
| 1 | TypeScript 5.x | ◎ | ◎ (openapi-typescript·orval 등 모두 TS 출력) | ◎ (z.infer<typeof Schema>) | ◎ | ✅ **통과** |
| 2 | JS + JSDoc | △ | △ (TS d.ts를 JSDoc으로 변환 추가 단계) | △ | △ | ⛔ |

### 3.3 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| BE Pydantic v2 모델 ↔ FE zod 동등 타입 | **필수** | API 계약 정합 — `07_api_spec.md` 22개 endpoint의 요청/응답 DTO를 FE에서 안전하게 사용 |
| OpenAPI 코드젠 호환 | **필수** | BE Swagger UI 자동 문서(`09_service_design.md` §1 FastAPI 내장 ReDoc) 기반 코드 생성 |
| IDE 자동완성·리팩토링 안전성 | **필수** | 화면 10개·서비스 클래스 15개 규모에서 타입이 보호 |

**탈락 사유:**

- **#2 JS + JSDoc** — 타입 도구는 가능하나 OpenAPI 코드젠·zod 통합·React 생태계 최신 라이브러리(TanStack Router·React 19 Actions) 모두 TS 1급으로 가정 작성됨. JSDoc 채택 시 추가 변환 단계와 누수 위험 발생.

### 3.4 최종 선발

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **언어** | **TypeScript 5.x (strict 모드)** ✅ | `strict: true`·`noUncheckedIndexedAccess: true`·`exactOptionalPropertyTypes: true` 권장. zod 스키마에서 `z.infer<typeof Schema>`로 타입 자동 추출하여 폼·HTTP 응답 검증 결과를 React 컴포넌트 props까지 일관 전달 |

### 3.5 tsconfig 권장 옵션

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

| 옵션 | 사유 |
|------|------|
| `strict: true` | BE mypy `--strict`(09 §2)와 정합 — 양쪽 모두 엄격 |
| `noUncheckedIndexedAccess` | 배열·객체 인덱싱 결과를 `T \| undefined`로 좁힘 — 런타임 오류 감소 |
| `exactOptionalPropertyTypes` | `prop?: T`와 `prop: T \| undefined` 구분 — DTO 정합 |
| `moduleResolution: Bundler` | Vite + 모던 패키지 해석 |
| `lib: WebWorker` | Service Worker 타입 — `06_pwa_push.md` |

---

## 4. 통합 최종 결정 (spec 반영)

### 4.1 결정 항목 (3건 신규)

| 항목 | 결정 | spec 반영 위치 |
|------|------|--------------|
| UI 프레임워크 | **React 19** | `03_mvp_scope.md` §3 (기존 명시 — ratify) / FE spec 신설 시 명시 |
| 빌드·번들러 | **Vite 6 + Rollup** | FE spec 신설 시 명시 (현재 `09_service_design.md` §11 Caddy 정적 서빙에 산출물 위치만 영향) |
| 언어 | **TypeScript 5.x (strict)** | FE spec 신설 시 명시 |

> 본 카테고리 결정 중 schema/api/service 변경은 없다. FE 전용 spec 폴더(`docs/spec/07_frontend/`) 신설 시점에 본 결정들이 일괄 기재된다.

### 4.2 결정에 따라 다른 카테고리에 미치는 영향

| 영향 | 영향 받는 카테고리 |
|------|----------------|
| Vite 채택 → vite-plugin-pwa 표준 채택 | `06_pwa_push.md` §1 |
| Vite 채택 → Vitest 자연 채택(같은 esbuild·설정 공유) | `09_testing_quality.md` §1 |
| TypeScript 채택 → zod ↔ z.infer 통합 | `05_form_validation.md` §1 |
| TypeScript 채택 → openapi-typescript / orval 코드젠 가능 | `03_data_http.md` §3 |

---

## 5. 후보 세부 정보

### 5.1 React 19 ✅
- **사용처**: 모든 화면 컴포넌트 (`04_feature_spec.md` §12 화면 10개)
- **장점**: Actions(`useActionState`·`useFormStatus`)로 폼 제출 흐름 단순화, `use()` hook으로 promise·context 직접 소비, automatic compiler memo(React Compiler) 점진 도입 가능
- **단점**: React 19는 2024년 12월 안정화 — 일부 라이브러리(Storybook 8 등)는 호환 지원 진행 중
- **세부사항**: MIT 라이선스. `react@19.0.0` + `react-dom@19.0.0`

### 5.2 Vite 6 ✅
- **사용처**: 개발 dev server + production 빌드
- **장점**: dev에서 ESM 네이티브 + esbuild 트랜스파일로 1초 미만 부팅·ms 단위 HMR. production은 Rollup로 tree-shake·code split 안정. 플러그인 API 풍부(vite-plugin-pwa·vite-tsconfig-paths·vite-plugin-checker 등 1급)
- **단점**: 빌드 시 Rollup 단일 스레드 한계 — 대규모(파일 5000+) 빌드에서는 turbopack 대비 느릴 수 있음. 사주라 규모(파일 200~500)에서는 무관
- **세부사항**: MIT. `vite@^6.0.0` + `@vitejs/plugin-react@^4`

### 5.3 TypeScript 5.x ✅
- **사용처**: 전체 소스
- **장점**: `strict` + `noUncheckedIndexedAccess`로 런타임 오류 사전 차단. `satisfies` 연산자로 DTO 매핑 안전. zod `z.infer` + `infer` 키워드로 동적 추론 강력
- **단점**: 빌드 단계에 tsc 또는 vite-plugin-checker로 별도 타입 검사 필요(esbuild는 트랜스파일만 수행) — CI에 명시
- **세부사항**: Apache 2.0. `typescript@^5.6`

### 5.4 Next.js 🟡 (보존)
- **사용처**: 2단계 마케팅·랜딩 SEO 필요 시
- **장점**: SSR·RSC·이미지 최적화·미들웨어·Vercel 친화
- **단점**: 사주라 점주용 SPA + PWA 모델에 SSR 불필요·서버 컨테이너 추가 부담
- **세부사항**: MIT. Vercel

### 5.5 탈락 후보 요약

| 후보 | 분류 | 탈락 사유 |
|------|------|---------|
| Vue 3 / Svelte 5 / SolidJS | UI 프레임워크 | 03_mvp_scope.md §3 React 명시 — 변경 비용 큼 |
| Remix v2 | 빌드 | SSR 기본·BE FastAPI와 별도 Node 서버 필요 |
| Astro 5 | 빌드 | islands 아키텍처는 사주라 점주 대시보드 인터랙티브 모델에 부적합 |
| CRA | 빌드 | 2023 deprecated |
| Parcel 2 | 빌드 | vite-plugin-pwa 동등 활발도 약함 |
| Webpack 5 | 빌드 | HMR rebuild 수 초·설정 부담 |
| JS + JSDoc | 언어 | OpenAPI·zod·React 생태계가 TS 1급 기준 |

---

## 6. 비교 요약 표

| 분류 | 후보 | 결과 | 핵심 사유 |
|------|------|------|---------|
| UI 프레임워크 | React 19 | ✅ | mvp_scope ratify + 생태계 폭 + 팀 친숙도 |
| UI 프레임워크 | Vue / Svelte / Solid | ⛔ | mvp_scope 변경 비용 |
| 빌드 | Vite 6 | ✅ | dev HMR ms·prod Rollup·vite-plugin-pwa 공식 |
| 빌드 | Next.js 15 | 🟡 보존 | SSR 사주라 불필요·SEO 필요 시 재평가 |
| 빌드 | Remix v2 | ⛔ | SSR 기본 |
| 빌드 | Astro 5 | ⛔ | island 모델 부적합 |
| 빌드 | CRA / Parcel / Webpack | ⛔ | deprecated / 활발도 / HMR 느림 |
| 언어 | TypeScript 5.x | ✅ | strict·zod·OpenAPI·React 생태계 1급 |
| 언어 | JS + JSDoc | ⛔ | 도구 통합 비용 |
