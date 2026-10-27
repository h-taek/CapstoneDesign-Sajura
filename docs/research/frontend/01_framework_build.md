# UI 프레임워크·빌드·언어

> **카테고리**: UI 프레임워크, 빌드/번들러 도구, 언어 비교
> **연결 spec**: `02_implementation_design.md` §1.3 (React + PWA 명시), `03_be.md` §15 (Caddy 정적 서빙 — `caddy:alpine`이 BE 컨테이너 옆에서 PWA 산출물 호스팅), `04_fe.md` §4 (화면 IA)

---

## 1. UI 프레임워크

### 1.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | React 19 | 컴포넌트형 SPA | |
| 2 | Vue 3 | 컴포넌트형 SPA | |
| 3 | Svelte 5 (SvelteKit) | 컴파일형 | |
| 4 | SolidJS | 컴파일형 reactive | |

### 1.2 1차 벤치마크 — 필수 기능

| # | 후보 | 생태계(차트/폼/PWA) | TypeScript 1급 | PWA 통합 도구 |
|---|------|:---:|:---:|:---:|
| 1 | React 19 | ◎ (Recharts·ECharts wrapper·RHF·TanStack 모두 React 1급) | ◎ | ◎ (vite-plugin-pwa·Workbox React 예제 풍부) |
| 2 | Vue 3 | O | O | O |
| 3 | Svelte 5 | △ (TanStack Query Svelte 어댑터 베타) | O | △ |
| 4 | SolidJS | △ | O | △ |

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

### 2.2 1차 벤치마크 — 필수 기능

| # | 후보 | dev HMR 속도 | SPA + PWA 표준 | vite-plugin-pwa 호환 | TS 1급 | 운영 단순성 |
|---|------|:---:|:---:|:---:|:---:|:---:|
| 1 | Vite 6 | ◎ (ESM dev server, ms 단위) | ◎ | ◎ (공식 플러그인) | ◎ | ◎ |
| 2 | Next.js 15 | O (Turbopack β) | X (SSR 기본·정적 export는 부분 지원) | △ (next-pwa 비공식) | ◎ | X (RSC 학습·서버 의존) |
| 3 | Remix v2 | O | X (SSR 기본) | X | ◎ | X |
| 4 | Astro 5 | O | △ (SPA 아님 — 정적 + island) | △ | O | X (정적 + island 모델) |
| 5 | CRA | △ | ◎ | △ | O | X (deprecated, 보안 패치 정지) |
| 6 | Parcel 2 | O | O | △ (활발도 약함) | O | △ |
| 7 | Webpack 5 | X (rebuild 수 초) | O | △ (workbox-webpack-plugin) | O | X (설정 부담) |

### 2.3 후보별 차이

- Next.js 15 — RSC·SSR·App Router 중심이다. SSR·RSC를 쓰면 서버 측 React 실행 환경(별도 Node 서버)이 필요하다.
- Remix v2 — SSR이 기본이며 서버가 필요하다.
- Astro 5 — islands 아키텍처로 콘텐츠 사이트(블로그·문서) 중심이다.
- CRA — 2023년 deprecated됐고 보안 패치가 중단됐다.
- Parcel 2 — zero config이나 PWA 플러그인 활발도가 Vite보다 약하고 운영 사례·트러블슈팅 자료가 적다.
- Webpack 5 — dev HMR rebuild에 수 초가 걸리고 설정 파일을 직접 작성해야 한다.

---

## 3. 언어

### 3.1 전체 후보 목록

| # | 후보 | 비고 |
|---|------|------|
| 1 | TypeScript 5.x | 정적 타입 + 추론 |
| 2 | JavaScript (ES2022+) + JSDoc | 타입 어노테이션 JSDoc |

### 3.2 1차 벤치마크

| # | 후보 | 정적 타입 | OpenAPI 코드젠 호환 | zod 통합 | React 생태계 표준 |
|---|------|:---:|:---:|:---:|:---:|
| 1 | TypeScript 5.x | ◎ | ◎ (openapi-typescript·orval 등 모두 TS 출력) | ◎ (z.infer<typeof Schema>) | ◎ |
| 2 | JS + JSDoc | △ | △ (TS d.ts를 JSDoc으로 변환 추가 단계) | △ | △ |

### 3.3 후보별 차이

- JS + JSDoc — OpenAPI 코드젠·zod·최신 React 생태계 라이브러리(TanStack Router·React 19 Actions)가 TS 기준으로 작성돼 있다. JSDoc으로 쓰려면 추가 변환 단계가 필요하다.

---

## 4. 후보 세부 정보

### 4.1 React 19
- **장점**: Actions(`useActionState`·`useFormStatus`)로 폼 제출 흐름 단순화, `use()` hook으로 promise·context 직접 소비, automatic compiler memo(React Compiler) 점진 도입 가능
- **단점**: React 19는 2024년 12월 안정화 — 일부 라이브러리(Storybook 8 등)는 호환 지원 진행 중
- **세부사항**: MIT 라이선스. `react@19.0.0` + `react-dom@19.0.0`

### 4.2 Vite 6
- **장점**: dev에서 ESM 네이티브 + esbuild 트랜스파일로 1초 미만 부팅·ms 단위 HMR. production은 Rollup로 tree-shake·code split 안정. 플러그인 API 풍부(vite-plugin-pwa·vite-tsconfig-paths·vite-plugin-checker 등 1급)
- **단점**: 빌드 시 Rollup 단일 스레드 한계 — 대규모(파일 5000+) 빌드에서는 turbopack 대비 느릴 수 있음
- **세부사항**: MIT. `vite@^6.0.0` + `@vitejs/plugin-react@^4`

### 4.3 TypeScript 5.x
- **장점**: `strict` + `noUncheckedIndexedAccess`로 런타임 오류 사전 차단. `satisfies` 연산자로 DTO 매핑 안전. zod `z.infer` + `infer` 키워드로 동적 추론 강력
- **단점**: 빌드 단계에 tsc 또는 vite-plugin-checker로 별도 타입 검사 필요(esbuild는 트랜스파일만 수행)
- **세부사항**: Apache 2.0. `typescript@^5.6`

### 4.4 Next.js
- **장점**: SSR·RSC·이미지 최적화·미들웨어·Vercel 친화
- **단점**: SSR 사용 시 서버 컨테이너 필요
- **세부사항**: MIT. Vercel

---

## 5. 비교 요약 표

| 분류 | 후보 | 특징 |
|------|------|------|
| UI 프레임워크 | React 19 | 차트·폼·PWA·TanStack 생태계 React 1급 |
| UI 프레임워크 | Vue / Svelte / Solid | 생태계 O~△·Svelte TanStack Query 어댑터 베타 |
| 빌드 | Vite 6 | dev HMR ms·prod Rollup·vite-plugin-pwa 공식 |
| 빌드 | Next.js 15 | SSR·RSC·App Router·서버 필요 |
| 빌드 | Remix v2 | SSR 기본 |
| 빌드 | Astro 5 | 정적 + island 모델 |
| 빌드 | CRA / Parcel / Webpack | deprecated / PWA 플러그인 활발도 약함 / HMR 수 초 |
| 언어 | TypeScript 5.x | strict·zod·OpenAPI·React 생태계 1급 |
| 언어 | JS + JSDoc | d.ts 변환 추가 단계 |
