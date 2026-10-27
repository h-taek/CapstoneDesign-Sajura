# 스타일·컴포넌트 라이브러리

> **카테고리**: 스타일 시스템(Tailwind·CSS Modules·CSS-in-JS), 컴포넌트 라이브러리(shadcn·MUI·Mantine·Chakra·AntD·Radix) 비교
> **연결 spec**: `04_fe.md` §4 (화면별 UI 구성 — 카드·플로팅 버튼·탭·배지 등 사주라 IA 요소), `01_basic_design.md` §4 (UX 흐름)

---

## 1. 스타일 시스템

### 1.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | Tailwind CSS v4 | utility-first | Lightning CSS·@layer, JIT 컴파일 |
| 2 | CSS Modules | scoped CSS | Vite 내장, runtime 0 |
| 3 | Emotion / styled-components | CSS-in-JS (runtime) | 동적 props 강점 |
| 4 | vanilla-extract | zero-runtime CSS-in-JS | 빌드 시 CSS 생성 |
| 5 | Panda CSS | atomic + zero-runtime | 신규, build-time |

### 1.2 1차 벤치마크 — 필수 기능

| # | 후보 | runtime 비용 | 모바일 반응형 | shadcn/ui 정합 | 학습 비용 | 마인드셰어 |
|---|------|:---:|:---:|:---:|:---:|:---:|
| 1 | Tailwind CSS v4 | 0 (빌드 시 atomic CSS) | ◎ (`sm:`/`md:`/`lg:`/`xl:` 기본) | ◎ (shadcn/ui 표준 베이스) | △ (utility 명명 학습) | ◎ |
| 2 | CSS Modules | 0 | O (수동 미디어쿼리) | △ | ◎ | O |
| 3 | Emotion / styled-components | △ (runtime) | O | X (React 19 호환 검증 진행) | O | △ (감소 추세) |
| 4 | vanilla-extract | 0 | O | △ | △ (학습 비용) | △ |
| 5 | Panda CSS | 0 | O | △ | △ (신규) | △ |

### 1.3 후보별 차이

- CSS Modules — runtime이 0이나 디자인 토큰(색·spacing·typography) 관리를 직접 표준화해야 한다. shadcn/ui의 표준 베이스가 아니다.
- Emotion / styled-components — runtime 비용이 있고 React 19 호환 검증이 진행 중이다. CSS-in-JS는 SSR 환경에서 이점이 크다.
- vanilla-extract — zero-runtime이나 shadcn/ui의 표준 베이스(Tailwind)가 아니다.
- Panda CSS — Tailwind와 비슷한 atomic 모델이며 신규라 자료·마인드셰어가 적다.

---

## 2. 컴포넌트 라이브러리

### 2.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | shadcn/ui | Radix UI + Tailwind, copy-paste | 패키지 의존성 없음, 코드 보유 |
| 2 | Radix UI primitives | unstyled primitives | 직접 스타일링 필요 |
| 3 | Headless UI | Tailwind 친화 unstyled | 컴포넌트 수 적음 |
| 4 | MUI v6 | Material Design | 풍부, runtime CSS 부담 |
| 5 | Mantine v7 | 자체 디자인 시스템 | 풍부, dark mode 표준 |
| 6 | Chakra UI v3 | 자체 디자인 시스템 | 접근성 강점 |
| 7 | Ant Design v5 | 엔터프라이즈 디자인 | 풍부, 비주얼 무거움 |

### 2.2 1차 벤치마크 — 필수 기능

| # | 후보 | 컴포넌트 커버리지 | 접근성 (WCAG·키보드) | Tailwind 정합 | 번들 크기 | 코드 소유권 | 학습 비용 |
|---|------|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | shadcn/ui | ◎ | ◎ (Radix 기반) | ◎ | ◎ (사용 컴포넌트만 복사) | ◎ (코드 보유) | O |
| 2 | Radix UI primitives | O (스타일 직접) | ◎ | ◎ | ◎ | O | △ (스타일 직접 작성 부담) |
| 3 | Headless UI | △ (컴포넌트 수 적음 — 모달·탭·메뉴만) | O | ◎ | ◎ | O | O |
| 4 | MUI v6 | ◎ | ◎ | X (Emotion runtime) | X (큰 번들) | X | O |
| 5 | Mantine v7 | ◎ | ◎ | △ (자체 CSS) | △ | X | O |
| 6 | Chakra UI v3 | ◎ | ◎ | △ | △ | X | O |
| 7 | Ant Design v5 | ◎ | O | X | X (~1MB) | X | △ (비주얼 강함) |

### 2.3 후보별 차이

- Radix UI primitives — unstyled라 스타일을 직접 작성해야 한다. shadcn/ui는 Radix 위에 Tailwind 스타일을 얹은 것이다.
- Headless UI — Tailwind 친화 unstyled이며 컴포넌트가 다이얼로그·메뉴·탭·전환 정도로 적다.
- MUI v6 — Material Design 비주얼(그림자·elevation)이 강하고 디자인 자유도가 낮다. Emotion runtime을 쓰며 Tailwind와 충돌한다.
- Chakra UI v3 — 디자인 시스템·접근성이 우수하나 자체 CSS-in-JS 기반이라 Tailwind와 함께 쓰기 어렵다.
- Ant Design v5 — 엔터프라이즈 데이터 그리드·복잡 폼에 강하고 비주얼이 무겁다. 번들이 ~1MB다.

---

## 3. 후보 세부 정보

### 3.1 Tailwind CSS v4
- **장점**: runtime 0, Lightning CSS 기반 빌드, `@theme`로 디자인 토큰, 반응형(`sm:`/`md:`)·다크모드(`dark:`)·상태(`hover:`/`focus:`)·자식 셀렉터(`[&_svg]:size-4`) 등 표현력 강력
- **단점**: utility 명명 학습 비용 — 1회 정착 후 비용 작음. 긴 className 가독성 → `clsx`·`cn` 헬퍼·prettier-plugin-tailwindcss로 완화
- **세부사항**: MIT. `tailwindcss@^4`

### 3.2 shadcn/ui
- **장점**: CLI로 컴포넌트 코드 복사 → 패키지 의존성 없음, 코드 보유, Radix 기반 접근성, Tailwind 정합. React 19 호환. theme 토큰 CSS 변수로 다크 모드 표준
- **단점**: 컴포넌트 업그레이드는 CLI 재실행 필요. 직접 수정한 코드는 머지 부담
- **세부사항**: MIT. `shadcn` CLI

### 3.3 lucide-react
- **장점**: shadcn/ui 표준 아이콘 세트. Tree-shake, SVG 컴포넌트, 1500+ 아이콘
- **단점**: 한국형 도메인 아이콘(예: 한식 메뉴) 부재
- **세부사항**: ISC. `lucide-react`

### 3.4 Mantine v7
- **장점**: 자체 디자인 시스템 풍부 + 폼·DateTime·차트·알림 통합
- **단점**: 자체 CSS·Tailwind 충돌·코드 소유권 없음
- **세부사항**: MIT

---

## 4. 비교 요약 표

| 분류 | 후보 | 특징 |
|------|------|------|
| 스타일 | Tailwind CSS v4 | runtime 0·반응형 표준·shadcn 표준 베이스 |
| 스타일 | CSS Modules | runtime 0·디자인 토큰 직접 관리 |
| 스타일 | Emotion / styled-components | runtime CSS·React 19 호환 진행 |
| 스타일 | vanilla-extract / Panda | zero-runtime / 신규·마인드셰어 적음 |
| 컴포넌트 | shadcn/ui | 코드 보유·Radix·Tailwind·CLI |
| 컴포넌트 | Mantine v7 | 폼·DateTime·차트·알림 통합·자체 CSS |
| 컴포넌트 | Radix UI 단독 / Headless UI | 스타일 직접 작성 / 컴포넌트 수 적음 |
| 컴포넌트 | MUI / Chakra / AntD | Material·Emotion / 자체 CSS-in-JS / 번들 ~1MB |
| 아이콘 | lucide-react | shadcn 표준·Tree-shake |
