# 테스트·코드 품질·문서화

> **카테고리**: 단위/통합 테스트 러너, 컴포넌트 테스트 도구, API mock, E2E 테스트, 린터·포매터, 정적 타입 검사, 컴포넌트 문서화 결정
> **연결 spec**: `13_performance.md` §1.1 (API SLA — E2E 시나리오 기준), `07_api_spec.md` (mock 대상 endpoint), `docs/research/backend/09_testing_quality.md` (BE 테스트 도구 — 정합 검토)

---

## 0. 카테고리 구성 & 결정 항목

| 하위 카테고리 | 후보 수 | 결정 항목 수 |
|------------|--------|------------|
| §1 단위/통합 테스트 (러너 + DOM + mock) | 7 | 3 (러너 + 컴포넌트 + API mock) |
| §2 E2E 테스트 | 3 | 1 (Playwright) |
| §3 린터·포매터 | 4 | 1 (Biome) |
| §4 정적 타입 검사 | 2 | 1 (tsc + vite-plugin-checker) |
| §5 컴포넌트 문서화 | 2 | 1 (보존 — MVP 미채택) |
| §6 통합 결정 | — | §6 참조 |

### 본 research가 결정하는 항목

| 항목 | 결정 | 결정 근거 위치 |
|------|------|--------------|
| 테스트 러너 | **Vitest 2.x** | §1.4 |
| 컴포넌트 테스트 | **@testing-library/react + @testing-library/jest-dom + @testing-library/user-event** | §1.4 |
| API mock | **MSW 2.x** (Mock Service Worker) | §1.4 |
| E2E 테스트 | **Playwright (Node) 1.x — Chromium 단일** | §2.4 |
| 린터·포매터 | **Biome 1.x** (ESLint + Prettier 통합) | §3.4 |
| 정적 타입 검사 | **tsc + vite-plugin-checker** | §4.4 |
| 컴포넌트 문서화 | **Storybook 보존** (Q3 이후 컴포넌트 30+ 트리거) | §5.4 |

---

## 1. 단위/통합 테스트

### 1.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | Vitest 2.x | 러너 | Vite 통합, esbuild 기반 |
| 2 | Jest 29 | 러너 | 표준, Babel/SWC 트랜스파일 별도 |
| 3 | @testing-library/react | DOM | 사실상 React 표준 |
| 4 | Enzyme | DOM | **React 18+ 호환 안 됨** |
| 5 | MSW 2.x | API mock (Service Worker / Node interceptor) | 표준 |
| 6 | Nock | API mock (Node 인터셉트) | Node 환경 한정 |
| 7 | Sinon | mock·spy·stub | 범용 |

### 1.2 1차 벤치마크 — 사주라 MVP 필수 기능

**테스트 러너:**

| # | 후보 | Vite 통합 | TS 1급 | 속도 | watch·HMR | 결과 |
|---|------|:---:|:---:|:---:|:---:|:---|
| 1 | Vitest 2.x | ◎ (`vite.config.ts` 공유) | ◎ | ◎ (esbuild) | ◎ | ✅ **통과** |
| 2 | Jest 29 | △ (vite-jest 또는 별도 SWC) | O | △ (Babel 트랜스파일 비용) | O | ⛔ |

**컴포넌트 테스트:**

| # | 후보 | React 19 호환 | 접근성 쿼리 | user 시뮬레이션 | 결과 |
|---|------|:---:|:---:|:---:|:---|
| 3 | @testing-library/react | ◎ | ◎ (`getByRole`·`getByLabelText`) | ◎ (user-event 14+) | ✅ **통과** |
| 4 | Enzyme | ⛔ (React 18+ 미호환) | △ | △ | ⛔ |

**API mock:**

| # | 후보 | Service Worker (브라우저) | Node 인터셉트 | OpenAPI 통합 | 표현력 | 결과 |
|---|------|:---:|:---:|:---:|:---:|:---|
| 5 | MSW 2.x | ◎ | ◎ (`setupServer`) | O (openapi-msw로 타입) | ◎ (handlers REST·GraphQL) | ✅ **통과** |
| 6 | Nock | ⛔ (Node 전용) | ◎ | △ | O | ⛔ (브라우저·SW에서 미동작) |
| 7 | Sinon | △ (mock 범용) | △ | ⛔ | △ | ⛔ (전용 API mock 도구 아님) |

### 1.3 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| Vite 통합 (러너) | **필수** | `01_framework_build.md` §2.4 Vite 결정 — config 공유로 1인 운영 단순 |
| React 19 호환 | **필수** | `01_framework_build.md` §1.4 React 19 결정 |
| Service Worker + Node 환경 모두 (API mock) | **필수** | 컴포넌트 테스트(jsdom·node) + dev server(브라우저 SW) 모두 동작 |

**탈락 사유:**

- **#2 Jest** — Vite 환경에서 별도 트랜스파일 설정 부담. Vitest가 동일 API + Vite config 공유.
- **#4 Enzyme** — React 18+ 비호환. 마인드셰어도 testing-library로 이동.
- **#6 Nock** — Node 전용. 브라우저·Service Worker 환경 동작 불가.
- **#7 Sinon** — 범용 mock 도구로 API mock 전용 아님. MSW가 handlers 표현력 우위.

### 1.4 최종 선발

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **테스트 러너** | **Vitest 2.x** ✅ | Vite `vite.config.ts` 공유·esbuild 트랜스파일 ms 단위·`vi.*` API가 Jest와 호환. coverage(v8 provider) 내장. `02_app_server.md` BE pytest와 동일 멘탈 모델 |
| **컴포넌트 테스트** | **@testing-library/react 16 + user-event 14** ✅ | React 19 호환, 접근성 쿼리(`getByRole`/`getByLabelText`)로 사용자 관점 테스트, user-event 14는 비동기 시뮬레이션 표준 |
| **API mock** | **MSW 2.x** ✅ | Service Worker(브라우저 dev) + Node(`setupServer`, vitest jsdom) 양쪽 동작. handler는 REST `http.get(path, ({request, params}) => ...)` 일관 표현. shadcn 컴포넌트 통합 테스트 시 BE `07_api_spec.md` endpoint를 한 곳에서 mock |

### 1.5 권장 vitest 설정

```ts
// vitest.config.ts (vite.config 확장)
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        lines: 60, functions: 60, branches: 60, statements: 60,   // MVP — BE 09 정합 60%
      },
      exclude: ['src/components/ui/**', 'src/test/**', '**/*.d.ts'],
    },
  },
}));
```

```ts
// src/test/setup.ts
import '@testing-library/jest-dom/vitest';
import { server } from './msw-server';
import { beforeAll, afterEach, afterAll } from 'vitest';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

| 설정 | 값 | 사유 |
|------|---|------|
| `environment: jsdom` | — | 브라우저 DOM 시뮬레이션 |
| `coverage.thresholds` 60% | — | BE pytest-cov 60% 정합 (`docs/research/backend/09_testing_quality.md` §1) |
| `exclude` shadcn/ui 코드 | — | 외부 컴포넌트 (코드 보유했지만 사주라 도메인 아님) |
| `onUnhandledRequest: 'error'` | — | mock 누락 시 즉시 실패 — 테스트 신뢰성 |

---

## 2. E2E 테스트

### 2.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | Playwright (Node) 1.x | E2E | Microsoft 표준·BE Playwright(Python)와 같은 엔진 |
| 2 | Cypress 13 | E2E | 단일 브라우저 컨텍스트·인기 |
| 3 | WebdriverIO | E2E | Selenium 기반 |

### 2.2 1차 벤치마크

| # | 후보 | 멀티 브라우저 | 병렬·격리 | TS 1급 | network mock 통합 | BE 정합 (같은 엔진) | 결과 |
|---|------|:---:|:---:|:---:|:---:|:---:|:---|
| 1 | Playwright (Node) 1.x | ◎ (Chromium·Firefox·WebKit) | ◎ | ◎ | ◎ (`page.route()`) | ◎ (BE 09 §1 보존 후보 pytest-playwright + Playwright Python 동일 엔진) | ✅ **통과** |
| 2 | Cypress 13 | △ (Chrome family 중심) | △ (단일 컨텍스트) | O | O | ⛔ | ⛔ |
| 3 | WebdriverIO | O | O | O | △ | ⛔ (Selenium WebDriver 별개) | ⛔ |

### 2.3 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| auto-wait·셀렉터·trace | **필수** | E2E 안정성 — 셀렉터 timing flakiness 회피 |
| TS 1급 | **필수** | TS strict 환경 |
| BE 정합 (같은 엔진) | 중요 | BE의 Playwright(Python·`02_app_server.md`·쿠팡 자동화) 멘탈 모델 공유 — 1인 운영 학습 비용 절감 |

**탈락 사유:**

- **#2 Cypress** — 단일 브라우저 컨텍스트로 인증·다중 탭 시나리오 표현 제약. WebKit·Firefox 정식 지원 약함.
- **#3 WebdriverIO** — Selenium 기반으로 auto-wait·trace 도구가 Playwright 대비 약함.

### 2.4 최종 선발

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **E2E** | **Playwright (Node) 1.x — Chromium 단일** ✅ | 03_mvp_scope.md §6 데모 시나리오 Step 1~6 end-to-end 검증. BE Playwright(Python·쿠팡 자동화)와 동일 엔진으로 1인 운영 학습 공유. Chromium 단일(`docs/research/backend/06_external_integration.md` §2.4 정합) — Docker 이미지·CI 시간 절감 |

### 2.5 권장 사용 범위

| 시나리오 | 도구 |
|---------|------|
| 단위 (컴포넌트 1개·hook 1개) | Vitest + @testing-library/react + MSW |
| 통합 (페이지 + API mock) | Vitest + @testing-library + MSW (`page` 컴포넌트 단위) |
| E2E (데모 시나리오 Step 1~6) | Playwright (실 BE 또는 MSW handler로 모킹된 dev server) |
| 시각적 회귀 | Playwright `toHaveScreenshot()` — 핵심 화면 5개 (홈·재고·예측·발주·대시보드) |

---

## 3. 린터·포매터

### 3.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | Biome 1.x | 린터 + 포매터 + import 정렬 통합 | Rust, 단일 도구 |
| 2 | ESLint 9 | 린터 | 플러그인 생태계 압도, flat config |
| 3 | Prettier 3 | 포매터 | 표준 |
| 4 | dprint | 포매터 | Rust |

### 3.2 1차 벤치마크 — 사주라 MVP 필수 기능

| # | 후보 | 단일 도구 (lint+format+sort) | Rust 속도 | TS·JSX 1급 | React 규칙 | Tailwind 정렬 | 마인드셰어 | 결과 |
|---|------|:---:|:---:|:---:|:---:|:---:|:---:|:---|
| 1 | Biome 1.x | ◎ | ◎ (Rust) | ◎ | ◎ (`useExhaustiveDependencies` 등) | △ (Tailwind plugin 진행 중) | O | ✅ **통과** |
| 2 | ESLint 9 | ⛔ (Prettier 별도) | △ (Node) | ◎ | ◎ (eslint-plugin-react·hooks) | ◎ (eslint-plugin-tailwindcss) | ◎ | 🟡 **보존** |
| 3 | Prettier 3 | (포매터 단일) | △ | ◎ | (린터 없음) | ◎ (prettier-plugin-tailwindcss) | ◎ | (보조) |
| 4 | dprint | (포매터 단일) | ◎ (Rust) | O | (린터 없음) | △ | △ | ⛔ |

### 3.3 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| 단일 도구 (lint + format + import 정렬) | **필수** | 1인 운영 — 도구 수 최소·설정 파일 1개 |
| Rust 속도 | 중요 | 화면 200~500 파일 규모에서 pre-commit 시간 단축 |
| React 19 규칙 | **필수** | hooks·effects·dependency 검사 |
| Tailwind 클래스 정렬 | 중요 | 가독성·diff 안정 |

**탈락 사유:**

- **#4 dprint** — Rust 빠르나 포매터만. 린터 부재 — Biome가 통합 우위.

### 3.4 최종 선발

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **린터·포매터** | **Biome 1.x** ✅ | 단일 도구로 lint + format + import 정렬·Rust 기반으로 ms 단위 실행·React 19 규칙(`useExhaustiveDependencies`·`noChildrenProp` 등) 포함·`biome.json` 1개 설정 파일. 1인 운영 환경에서 도구 단순화 효과 큼 |

### 3.5 권장 biome.json

```json
{
  "$schema": "https://biomejs.dev/schemas/1.x/schema.json",
  "files": { "ignore": ["dist", "src/components/ui/**", "src/types/api.d.ts"] },
  "organizeImports": { "enabled": true },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "useExhaustiveDependencies": "error",
        "noUnusedVariables": "error"
      },
      "suspicious": {
        "noConsoleLog": "warn"
      },
      "style": {
        "useImportType": "error"
      }
    }
  },
  "javascript": {
    "formatter": { "quoteStyle": "single", "semicolons": "always" }
  }
}
```

### 3.6 Tailwind 클래스 정렬

Biome 자체 Tailwind 정렬 플러그인은 1.x에서 진행 중. 사주라는 다음 옵션:

| 옵션 | 평가 |
|------|------|
| A. Biome 통합 (Tailwind 플러그인 안정 시) | 1.0 안정 시 채택 |
| B. prettier-plugin-tailwindcss를 Tailwind 정렬에만 한정 사용 | 권장 — Biome가 format/lint, Prettier는 Tailwind 정렬만 |

→ **결정: 옵션 B** — `prettier --plugin prettier-plugin-tailwindcss` 별도 1줄 스크립트(`pnpm format:tw`). pre-commit에서 Biome 다음 단계로 실행.

### 3.7 보존 후보 (ESLint + Prettier)

플러그인 생태계가 압도적. Biome가 표현 못 하는 규칙·플러그인 필요 시 마이그레이션 부담 작음 (Biome → ESLint 점진 이행 가능).

**재평가 트리거:**

| 지표 | 임계치 |
|------|------|
| Biome 미지원 lint 규칙 필요 | 사례 3건+ |
| 외부 라이브러리·플러그인(예: `eslint-plugin-jsx-a11y`)이 Biome 미지원 | 핵심 1건+ |
| Biome 유지보수 정체 | 6개월 commit 없음 |

→ 1개 충족 시 ESLint 9 + Prettier 3 마이그레이션 검토.

---

## 4. 정적 타입 검사

### 4.1 전체 후보 목록

| # | 후보 | 비고 |
|---|------|------|
| 1 | tsc (TypeScript Compiler) | 표준 |
| 2 | pyright | Microsoft, 빠름 |

(pyright는 Python 도구임 — TS는 tsc 표준. 본 카테고리는 사실상 단일 결정)

### 4.2 결정

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **타입 검사** | **tsc --noEmit + vite-plugin-checker** ✅ | tsc는 표준. dev 환경에서 `vite-plugin-checker`로 BG 실행하여 에러를 vite overlay에 표시. CI에서는 `tsc --noEmit` 별도 단계. esbuild·Biome는 트랜스파일만 — 타입 검사는 tsc가 단일 책임 |

### 4.3 CI 정합

| 단계 | 실행 |
|------|------|
| pre-commit | Biome (format/lint) — 빠른 검사 |
| pre-push 또는 CI | `tsc --noEmit` + `vitest run --coverage` + `playwright test` |
| BE 코드젠 검증 | `openapi-typescript` 산출 vs commit 비교 (`03_data_http.md` §3.5) |

---

## 5. 컴포넌트 문서화

### 5.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | Storybook 8 | 시각적 카탈로그·문서·인터랙션 | 표준 |
| 2 | Ladle | 경량 Storybook 대안 | Vite |

### 5.2 1차 벤치마크

| # | 후보 | Vite 통합 | shadcn 컴포넌트 시연 | 인터랙션·a11y 테스트 | 운영 부담 | 결과 |
|---|------|:---:|:---:|:---:|:---:|:---|
| 1 | Storybook 8 | ◎ (Vite builder) | ◎ | ◎ (interactions·a11y addon) | △ (설정·빌드 시간) | 🟡 **보존** |
| 2 | Ladle | ◎ | O | △ | ◎ (가벼움) | 🟡 **보존 (Storybook 도입 검토 시 비교)** |

### 5.3 사주라 MVP 결정

shadcn/ui는 컴포넌트 코드를 직접 보유(코드 복사 모델) — 컴포넌트 시각화는 shadcn 공식 데모 + 사주라 dev `/playground` 라우트로 보조 가능. 1인 운영 환경에서 Storybook 설정·문서 유지 비용 큼.

→ **MVP 미채택, 보존 후보**.

### 5.4 보존 후보 (Storybook 8)

**재평가 트리거:**

| 지표 | 임계치 |
|------|------|
| 사주라 도메인 컴포넌트 수 | ≥ 30 (shadcn 제외) |
| 디자이너·기획자 시각 리뷰 필요 | 정기화 |
| 컴포넌트 시각적 회귀 테스트 필요 | 화면 5개+ |

→ 2개 이상 충족 시 Storybook 8 또는 Ladle 도입 검토.

---

## 6. 통합 최종 결정 (spec 반영)

### 6.1 결정 항목 (7건)

| 항목 | 결정 | spec 반영 위치 |
|------|------|--------------|
| 테스트 러너 | **Vitest 2.x** | FE spec 신설 시 명시 |
| 컴포넌트 테스트 | **@testing-library/react 16 + user-event 14** | FE spec 신설 시 명시 |
| API mock | **MSW 2.x** | FE spec 신설 시 명시 |
| E2E | **Playwright (Node) 1.x — Chromium 단일** | FE spec 신설 시 명시. BE Playwright와 엔진 공유 |
| 린터·포매터 | **Biome 1.x + (Tailwind 정렬은 prettier-plugin-tailwindcss 보조)** | FE spec 신설 시 명시 |
| 타입 검사 | **tsc --noEmit + vite-plugin-checker** | FE spec 신설 시 명시 |
| 컴포넌트 문서화 | 보존 (Storybook 도입 트리거 §5.4) | — |

### 6.2 결정에 따라 다른 카테고리에 미치는 영향

| 영향 | 영향 받는 카테고리 |
|------|----------------|
| Vitest coverage 60% 목표 | BE pytest-cov 60% 정합 — `docs/research/backend/09_testing_quality.md` §1 |
| Playwright Chromium 단일 | BE Playwright와 엔진 공유 — `docs/research/backend/06_external_integration.md` §2.4 정합 |
| Biome → pre-commit + CI | `10_deployment.md` GitHub Actions 단계 |
| MSW handlers는 `src/test/msw/handlers/<도메인>.ts`로 분리 | FE 코드 구조 — FE spec에서 디렉터리 표준 |
| openapi-typescript 산출 commit 일치 검증 | `10_deployment.md` CI |

---

## 7. 후보 세부 정보

### 7.1 Vitest 2.x ✅
- **사용처**: 모든 단위·통합 테스트
- **장점**: Vite config 공유·esbuild 트랜스파일·`vi.*` Jest 호환 API·`expect.poll`·snapshot·coverage v8
- **단점**: Jest 대비 마인드셰어 작음(증가 추세)
- **세부사항**: MIT. `vitest@^2`

### 7.2 @testing-library/react ✅
- **사용처**: 컴포넌트 렌더 + 사용자 시뮬레이션 + assertion
- **장점**: 사용자 관점 쿼리(`getByRole`·`getByLabelText`)·접근성 우대·React 19 호환
- **단점**: 구현 디테일(state·props) 직접 테스트는 의도적으로 어려움
- **세부사항**: MIT

### 7.3 MSW 2.x ✅
- **사용처**: 컴포넌트·페이지 테스트 API mock
- **장점**: Service Worker(dev) + Node(`setupServer`) 양쪽 동작, REST/GraphQL handlers, `bypass`·`passthrough` 정밀 제어
- **단점**: handler 정의량 많아질 경우 정리 비용 — 도메인별 분리 권장
- **세부사항**: MIT. `msw@^2`

### 7.4 Playwright (Node) 1.x ✅
- **사용처**: E2E 데모 시나리오·시각적 회귀
- **장점**: auto-wait·trace·codegen·multi-browser·BE Playwright 엔진 공유
- **단점**: Docker 이미지 크기·CI 시간 — Chromium 단일로 완화
- **세부사항**: Apache 2.0. Microsoft. `@playwright/test`

### 7.5 Biome 1.x ✅
- **사용처**: 모든 소스 lint·format·import 정렬
- **장점**: Rust 단일 도구·React 19 규칙·1개 설정 파일
- **단점**: 플러그인 생태계 ESLint 대비 작음 (Tailwind 정렬 등 보조 필요)
- **세부사항**: MIT. `@biomejs/biome`

### 7.6 tsc + vite-plugin-checker ✅
- **사용처**: 빌드·CI에서 타입 검사
- **장점**: 표준·strict·vite-plugin-checker로 dev 즉시 피드백
- **단점**: tsc는 Node 기반으로 큰 프로젝트에서 느림 — 사주라 규모 무관
- **세부사항**: Apache 2.0

### 7.7 Storybook 8 🟡 (보존)
- **장점**: 컴포넌트 카탈로그·인터랙션·a11y·시각적 회귀
- **단점**: 설정·문서 유지 비용 큼
- **세부사항**: MIT

### 7.8 탈락 후보 요약

| 후보 | 분류 | 탈락 사유 |
|------|------|---------|
| Jest 29 | 러너 | Vite 통합 부담 |
| Enzyme | 컴포넌트 | React 18+ 미호환 |
| Nock | mock | Node 전용 |
| Sinon | mock | API mock 전용 아님 |
| Cypress 13 | E2E | 단일 컨텍스트·WebKit 약함 |
| WebdriverIO | E2E | Selenium 기반·trace 약함 |
| dprint | 포매터 | 린터 부재 |

---

## 8. 비교 요약 표

| 분류 | 후보 | 결과 | 핵심 사유 |
|------|------|------|---------|
| 러너 | Vitest 2.x | ✅ | Vite 공유·esbuild |
| 러너 | Jest 29 | ⛔ | Vite 통합 부담 |
| 컴포넌트 | @testing-library/react | ✅ | React 19·접근성 쿼리 |
| 컴포넌트 | Enzyme | ⛔ | React 18+ 미호환 |
| API mock | MSW 2.x | ✅ | SW + Node 양쪽 |
| E2E | Playwright (Node) | ✅ | BE 엔진 공유·auto-wait |
| E2E | Cypress / WebdriverIO | ⛔ | 컨텍스트·trace 한계 |
| 린터·포매터 | Biome 1.x | ✅ | 단일 도구·Rust |
| 린터·포매터 | ESLint + Prettier | 🟡 보존 | 미지원 규칙 트리거 |
| 타입 검사 | tsc + vite-plugin-checker | ✅ | 표준·dev 피드백 |
| 문서화 | Storybook 8 | 🟡 보존 | 컴포넌트 30+ 트리거 |
