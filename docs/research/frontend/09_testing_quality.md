# 테스트·코드 품질·문서화

> **카테고리**: 단위/통합 테스트 러너, 컴포넌트 테스트 도구, API mock, E2E 테스트, 린터·포매터, 정적 타입 검사, 컴포넌트 문서화 비교
> **연결 spec**: `01_basic_design.md` §5.3.1 (API SLA — E2E 시나리오 기준), `02_implementation_design.md` §3 (mock 대상 endpoint), `docs/research/backend/09_testing_quality.md` (BE 테스트 도구 — 정합 검토)

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

### 1.2 1차 벤치마크 — 필수 기능

**테스트 러너:**

| # | 후보 | Vite 통합 | TS 1급 | 속도 | watch·HMR |
|---|------|:---:|:---:|:---:|:---:|
| 1 | Vitest 2.x | ◎ (`vite.config.ts` 공유) | ◎ | ◎ (esbuild) | ◎ |
| 2 | Jest 29 | △ (vite-jest 또는 별도 SWC) | O | △ (Babel 트랜스파일 비용) | O |

**컴포넌트 테스트:**

| # | 후보 | React 19 호환 | 접근성 쿼리 | user 시뮬레이션 |
|---|------|:---:|:---:|:---:|
| 3 | @testing-library/react | ◎ | ◎ (`getByRole`·`getByLabelText`) | ◎ (user-event 14+) |
| 4 | Enzyme | X (React 18+ 미호환) | △ | △ |

**API mock:**

| # | 후보 | Service Worker (브라우저) | Node 인터셉트 | OpenAPI 통합 | 표현력 |
|---|------|:---:|:---:|:---:|:---:|
| 5 | MSW 2.x | ◎ | ◎ (`setupServer`) | O (openapi-msw로 타입) | ◎ (handlers REST·GraphQL) |
| 6 | Nock | X (Node 전용) | ◎ | △ | O |
| 7 | Sinon | △ (mock 범용) | △ | X | △ |

### 1.3 후보별 차이

- Jest — Vite 환경에서는 별도 트랜스파일 설정(vite-jest 또는 SWC)이 필요하다. Vitest는 Jest 호환 API(`vi.*`)를 제공하고 `vite.config.ts`를 공유한다.
- Enzyme — React 18+와 호환되지 않는다. 사용층이 testing-library로 옮겨갔다.
- Nock — Node 전용이라 브라우저·Service Worker 환경에서 동작하지 않는다.
- Sinon — 범용 mock·spy·stub 도구이며 API mock 전용 도구가 아니다.

---

## 2. E2E 테스트

### 2.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | Playwright (Node) 1.x | E2E | Microsoft. Python 바인딩과 같은 엔진 |
| 2 | Cypress 13 | E2E | 단일 브라우저 컨텍스트·인기 |
| 3 | WebdriverIO | E2E | Selenium 기반 |

### 2.2 1차 벤치마크

| # | 후보 | 멀티 브라우저 | 병렬·격리 | TS 1급 | network mock 통합 |
|---|------|:---:|:---:|:---:|:---:|
| 1 | Playwright (Node) 1.x | ◎ (Chromium·Firefox·WebKit) | ◎ | ◎ | ◎ (`page.route()`) |
| 2 | Cypress 13 | △ (Chrome family 중심) | △ (단일 컨텍스트) | O | O |
| 3 | WebdriverIO | O | O | O | △ |

### 2.3 후보별 차이

- Cypress — 단일 브라우저 컨텍스트에서 실행돼 인증·다중 탭 시나리오 표현에 제약이 있다. WebKit·Firefox 정식 지원이 약하다.
- WebdriverIO — Selenium WebDriver 기반이며 auto-wait·trace 도구가 Playwright보다 약하다.

---

## 3. 린터·포매터

### 3.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | Biome 1.x | 린터 + 포매터 + import 정렬 통합 | Rust, 단일 도구 |
| 2 | ESLint 9 | 린터 | 플러그인 생태계 압도, flat config |
| 3 | Prettier 3 | 포매터 | 표준 |
| 4 | dprint | 포매터 | Rust |

### 3.2 1차 벤치마크 — 필수 기능

| # | 후보 | 단일 도구 (lint+format+sort) | Rust 속도 | TS·JSX 1급 | React 규칙 | Tailwind 정렬 | 마인드셰어 |
|---|------|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | Biome 1.x | ◎ | ◎ (Rust) | ◎ | ◎ (`useExhaustiveDependencies` 등) | △ (Tailwind plugin 진행 중) | O |
| 2 | ESLint 9 | X (Prettier 별도) | △ (Node) | ◎ | ◎ (eslint-plugin-react·hooks) | ◎ (eslint-plugin-tailwindcss) | ◎ |
| 3 | Prettier 3 | (포매터 단일) | △ | ◎ | (린터 없음) | ◎ (prettier-plugin-tailwindcss) | ◎ |
| 4 | dprint | (포매터 단일) | ◎ (Rust) | O | (린터 없음) | △ | △ |

### 3.3 후보별 차이

- ESLint 9 + Prettier 3 — 린터와 포매터가 별개 도구라 설정 파일이 둘이다. 플러그인 생태계가 가장 크다.
- Prettier 3 — Tailwind 클래스 정렬은 prettier-plugin-tailwindcss로 한다. Biome 1.x의 Tailwind 정렬 플러그인은 진행 중이다.
- dprint — Rust 기반 포매터이며 린터가 없다.

---

## 4. 정적 타입 검사

### 4.1 전체 후보 목록

| # | 후보 | 비고 |
|---|------|------|
| 1 | tsc (TypeScript Compiler) | 표준 |
| 2 | pyright | Microsoft, 빠름 |

pyright는 Python 타입 검사 도구다.

### 4.2 도구별 차이

- esbuild(Vite 트랜스파일)와 Biome는 타입 검사를 하지 않는다.
- vite-plugin-checker는 dev 서버에서 tsc를 백그라운드로 실행해 타입 에러를 Vite overlay에 표시한다.

---

## 5. 컴포넌트 문서화

### 5.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | Storybook 8 | 시각적 카탈로그·문서·인터랙션 | 표준 |
| 2 | Ladle | 경량 Storybook 대안 | Vite |

### 5.2 1차 벤치마크

| # | 후보 | Vite 통합 | shadcn 컴포넌트 시연 | 인터랙션·a11y 테스트 | 운영 부담 |
|---|------|:---:|:---:|:---:|:---:|
| 1 | Storybook 8 | ◎ (Vite builder) | ◎ | ◎ (interactions·a11y addon) | △ (설정·빌드 시간) |
| 2 | Ladle | ◎ | O | △ | ◎ (가벼움) |

---

## 6. 후보 세부 정보

### 6.1 Vitest 2.x
- **장점**: Vite config 공유·esbuild 트랜스파일·`vi.*` Jest 호환 API·`expect.poll`·snapshot·coverage v8
- **단점**: Jest 대비 마인드셰어 작음(증가 추세)
- **세부사항**: MIT. `vitest@^2`

### 6.2 @testing-library/react
- **장점**: 사용자 관점 쿼리(`getByRole`·`getByLabelText`)·접근성 우대·React 19 호환
- **단점**: 구현 디테일(state·props) 직접 테스트는 의도적으로 어려움
- **세부사항**: MIT

### 6.3 MSW 2.x
- **장점**: Service Worker(dev) + Node(`setupServer`) 양쪽 동작, REST/GraphQL handlers, `bypass`·`passthrough` 정밀 제어
- **단점**: handler 정의량이 많아지면 정리 비용이 생김
- **세부사항**: MIT. `msw@^2`

### 6.4 Playwright (Node) 1.x
- **장점**: auto-wait·trace·codegen·multi-browser
- **단점**: Docker 이미지 크기·CI 시간 — 설치 브라우저 수에 따라 늘어남
- **세부사항**: Apache 2.0. Microsoft. `@playwright/test`

### 6.5 Biome 1.x
- **장점**: Rust 단일 도구·React 19 규칙·1개 설정 파일
- **단점**: 플러그인 생태계 ESLint 대비 작음 (Tailwind 정렬 미제공)
- **세부사항**: MIT. `@biomejs/biome`

### 6.6 tsc + vite-plugin-checker
- **장점**: 표준·strict·vite-plugin-checker로 dev 즉시 피드백
- **단점**: tsc는 Node 기반으로 큰 프로젝트에서 느림
- **세부사항**: Apache 2.0

### 6.7 Storybook 8
- **장점**: 컴포넌트 카탈로그·인터랙션·a11y·시각적 회귀
- **단점**: 설정·문서 유지 비용 큼
- **세부사항**: MIT

---

## 7. 비교 요약 표

| 분류 | 후보 | 특징 |
|------|------|------|
| 러너 | Vitest 2.x | Vite config 공유·esbuild 트랜스파일 |
| 러너 | Jest 29 | Vite 환경에서 별도 트랜스파일 설정 필요 |
| 컴포넌트 | @testing-library/react | React 19 호환·접근성 쿼리 |
| 컴포넌트 | Enzyme | React 18+ 미호환 |
| API mock | MSW 2.x | Service Worker + Node 양쪽 동작 |
| E2E | Playwright (Node) | auto-wait·trace·멀티 브라우저 |
| E2E | Cypress / WebdriverIO | 단일 브라우저 컨텍스트 / Selenium 기반·trace 약함 |
| 린터·포매터 | Biome 1.x | lint·format·import 정렬 단일 도구·Rust |
| 린터·포매터 | ESLint + Prettier | 린터·포매터 별개·플러그인 생태계 최대 |
| 타입 검사 | tsc + vite-plugin-checker | 표준·dev overlay 피드백 |
| 문서화 | Storybook 8 | 컴포넌트 카탈로그·인터랙션·a11y addon |
