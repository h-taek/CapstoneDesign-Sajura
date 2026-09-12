# 스타일·컴포넌트 라이브러리

> **카테고리**: 스타일 시스템(Tailwind·CSS Modules·CSS-in-JS), 컴포넌트 라이브러리(shadcn·MUI·Mantine·Chakra·AntD·Radix) 결정
> **연결 spec**: `04_feature_spec.md` §12 (화면별 UI 구성 — 카드·플로팅 버튼·탭·배지 등 사주라 IA 요소), `05_user_flow.md` (UX 흐름)

---

## 0. 카테고리 구성 & 결정 항목

| 하위 카테고리 | 후보 수 | 결정 항목 수 |
|------------|--------|------------|
| §1 스타일 시스템 | 5 | 1 (Tailwind CSS) |
| §2 컴포넌트 라이브러리 | 7 | 1 (shadcn/ui) |
| §3 통합 결정 | — | §3 참조 |

### 본 research가 결정하는 항목

| 항목 | 결정 | 결정 근거 위치 |
|------|------|--------------|
| 스타일 시스템 | **Tailwind CSS v4** | §1.4 |
| 컴포넌트 라이브러리 | **shadcn/ui** (Radix UI primitives + Tailwind) | §2.4 |
| 아이콘 | **lucide-react** (shadcn/ui 정합) | §2.5 |

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

### 1.2 1차 벤치마크 — 사주라 MVP 필수 기능

| # | 후보 | runtime 비용 | 모바일 반응형 | shadcn/ui 정합 | 학습 비용 | 마인드셰어 | 결과 |
|---|------|:---:|:---:|:---:|:---:|:---:|:---|
| 1 | Tailwind CSS v4 | 0 (빌드 시 atomic CSS) | ◎ (`sm:`/`md:`/`lg:`/`xl:` 기본) | ◎ (shadcn/ui 표준 베이스) | △ (utility 명명 학습) | ◎ | ✅ **통과** |
| 2 | CSS Modules | 0 | O (수동 미디어쿼리) | △ | ◎ | O | ⛔ (디자인 시스템 토큰 관리 부담) |
| 3 | Emotion / styled-components | △ (runtime) | O | ⛔ (React 19 호환 검증 진행) | O | △ (감소 추세) | ⛔ |
| 4 | vanilla-extract | 0 | O | △ | △ (학습 비용) | △ | ⛔ |
| 5 | Panda CSS | 0 | O | △ | △ (신규) | △ | ⛔ |

### 1.3 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| runtime 비용 0 | **필수** | PWA 모바일 — runtime CSS 파싱 비용 회피 |
| 모바일 반응형 표준 | **필수** | 점주는 주로 모바일·태블릿 사용 (PWA 인스톨) |
| 컴포넌트 라이브러리 정합 | **필수** | §2 shadcn/ui 표준 베이스가 Tailwind |
| 1인 운영 학습 비용 | 중요 | utility 명명은 1회 학습 후 비용 작음 |

**탈락 사유:**

- **#2 CSS Modules** — runtime 0이지만 디자인 토큰(색·spacing·typography) 관리를 직접 표준화해야 함. shadcn/ui와 통합 비표준.
- **#3 Emotion / styled-components** — runtime 비용·React 19 호환 검증 진행 중·shadcn/ui와 정합 약함. CSS-in-JS는 SSR 환경에서 의미가 큰데 사주라 SPA에선 이득 작음.
- **#4 vanilla-extract** — zero-runtime은 매력적이나 shadcn/ui 표준 베이스가 Tailwind라 정합 비용 발생.
- **#5 Panda CSS** — Tailwind와 비슷한 atomic 모델이나 신규로 자료·마인드셰어 부족.

### 1.4 최종 선발

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **스타일 시스템** | **Tailwind CSS v4** ✅ | utility-first·atomic CSS·반응형 표준·다크 모드 표준(`dark:`)·shadcn/ui 표준 베이스. v4 Lightning CSS 기반 빌드 가속(JIT). React 생태계 마인드셰어·자료 압도. 디자인 토큰은 `@theme` 블록으로 명시 |

### 1.5 권장 설정

```css
/* src/styles/globals.css */
@import 'tailwindcss';

@theme {
  --color-primary: oklch(0.6 0.15 250);     /* 사주라 브랜드 컬러 */
  --color-warning: oklch(0.75 0.18 80);     /* 소비기한 D-3 경고 */
  --color-danger:  oklch(0.65 0.20 30);     /* 소비기한 D-1·초과 긴급 */
  --color-success: oklch(0.7 0.18 145);
  --font-display: 'Pretendard Variable', system-ui, sans-serif;
}
```

| 항목 | 권장값 | 사유 |
|------|-------|------|
| 색 정의 | `oklch` | 색역·접근성 우수, v4 표준 |
| 폰트 | Pretendard Variable | 한글·영문 통합 + Variable 1 파일 |
| 경고·긴급 색 | `04_feature_spec.md` §12 배지 정책 정합 | D-3 경고/ D-1·초과 긴급 색 구분 |

---

## 2. 컴포넌트 라이브러리

### 2.1 사주라 UI 요소 인벤토리 (`04_feature_spec.md` §12 기반)

| 요소 | 사용 위치 |
|------|---------|
| 폼 (input·select·textarea·radio·checkbox·toggle·datepicker) | 온보딩·메뉴·재고·발주 |
| 카드·리스트·탭·아코디언 | 모든 화면 |
| 플로팅 액션 버튼 | 메뉴·재고 추가 |
| 모달·드로어·토스트·확인 다이얼로그 | 폐기·승인·삭제 확인 |
| 배지(경고·긴급)·뱃지 카운트(알림) | 홈·재고·알림 |
| 테이블·페이지네이션 | 판매 데이터·발주 내역 |
| 차트(별도 라이브러리) | `07_charts.md` |
| 하단 네비게이션 바 | 5개 탭 (홈·재고·예측·발주·설정) |
| 진행 단계(stepper) | 온보딩 1/4 ~ 4/4 |

### 2.2 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | shadcn/ui | Radix UI + Tailwind, copy-paste | 패키지 의존성 없음, 코드 보유 |
| 2 | Radix UI primitives | unstyled primitives | 직접 스타일링 필요 |
| 3 | Headless UI | Tailwind 친화 unstyled | 컴포넌트 수 적음 |
| 4 | MUI v6 | Material Design | 풍부, runtime CSS 부담 |
| 5 | Mantine v7 | 자체 디자인 시스템 | 풍부, dark mode 표준 |
| 6 | Chakra UI v3 | 자체 디자인 시스템 | 접근성 강점 |
| 7 | Ant Design v5 | 엔터프라이즈 디자인 | 풍부, 비주얼 무거움 |

### 2.3 1차 벤치마크 — 사주라 MVP 필수 기능

| # | 후보 | 사주라 UI 인벤토리 커버 | 접근성 (WCAG·키보드) | Tailwind 정합 | 번들 크기 | 코드 소유권 | 학습 비용 | 결과 |
|---|------|:---:|:---:|:---:|:---:|:---:|:---:|:---|
| 1 | shadcn/ui | ◎ | ◎ (Radix 기반) | ◎ | ◎ (사용 컴포넌트만 복사) | ◎ (코드 보유) | O | ✅ **통과** |
| 2 | Radix UI primitives | O (스타일 직접) | ◎ | ◎ | ◎ | O | △ (스타일 직접 작성 부담) | ⛔ (shadcn/ui가 Radix 위에 Tailwind 스타일 추가 — 우위) |
| 3 | Headless UI | △ (컴포넌트 수 적음 — 모달·탭·메뉴만) | O | ◎ | ◎ | O | O | ⛔ (커버리지 부족) |
| 4 | MUI v6 | ◎ | ◎ | ⛔ (Emotion runtime) | ⛔ (큰 번들) | ⛔ | O | ⛔ (디자인 자유도 낮음·Tailwind와 충돌) |
| 5 | Mantine v7 | ◎ | ◎ | △ (자체 CSS) | △ | ⛔ | O | 🟡 **보존 (디자인 시스템 강화 필요 시)** |
| 6 | Chakra UI v3 | ◎ | ◎ | △ | △ | ⛔ | O | ⛔ (Tailwind와 충돌) |
| 7 | Ant Design v5 | ◎ | O | ⛔ | ⛔ (~1MB) | ⛔ | △ (비주얼 강함) | ⛔ (점주용 운영 도구 비주얼 과함) |

### 2.4 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| 사주라 UI 인벤토리 커버 | **필수** | §2.1 14개 카테고리 모두 표현 가능해야 함 |
| 접근성 (WCAG·키보드·focus) | **필수** | 점주가 키보드·접근성 도구 사용 가능 — 디자인 시스템 기본 |
| Tailwind 정합 | **필수** | §1.4 Tailwind 결정과 통합 |
| 번들 크기 | **필수** | PWA 초기 로드 |
| 코드 소유권 | 중요 | 1인 운영 — 라이브러리 break 시 직접 패치 가능해야 함 |

**탈락 사유:**

- **#2 Radix UI primitives 단독** — unstyled로 강력하나 스타일 직접 작성 부담. shadcn/ui가 Radix 위에 Tailwind 스타일을 추가한 것이므로 직접 사용은 작성 비용 중복.
- **#3 Headless UI** — Tailwind 친화 unstyled이나 컴포넌트 수 적음(다이얼로그·메뉴·탭·전환 정도). 사주라 IA 커버 불가.
- **#4 MUI v6** — Material Design 비주얼 강함·디자인 자유도 낮음. Emotion runtime + Tailwind 충돌. 사주라 점주 도구는 데이터 중심으로 Material 그림자·elevation 등 과함.
- **#6 Chakra UI v3** — 디자인 시스템·접근성 우수하나 자체 CSS-in-JS 기반으로 Tailwind와 정합 어려움. 둘 중 하나만 선택해야 함.
- **#7 Ant Design v5** — 엔터프라이즈 데이터 그리드·복잡 폼 강점이나 점주용 모바일 PWA에 비주얼 과함. 번들 ~1MB.

### 2.5 최종 선발

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **컴포넌트 라이브러리** | **shadcn/ui** ✅ | CLI(`pnpm dlx shadcn@latest add <component>`)로 컴포넌트 코드가 `src/components/ui/`에 복사됨. 패키지 의존성 없음(코드 보유) → 1인 운영 환경에서 라이브러리 break 시 직접 패치 가능. Radix Primitives 기반 접근성. Tailwind 정합. 사용 컴포넌트만 복사 → 번들 정합. 사주라 IA 14개 카테고리 모두 표현 가능 |
| **아이콘** | **lucide-react** ✅ | shadcn/ui 표준 아이콘 세트. Tree-shake 가능, ~24×24 표준, 사주라 IA 커버(메뉴·재고·발주 아이콘 모두 존재) |

### 2.6 보존 후보 (Mantine v7)

자체 디자인 시스템 풍부 + 폼 라이브러리(`@mantine/form`) + DateTime Picker + Charts 자체 제공 등 통합도 높음. 다음 트리거 충족 시 검토.

**재평가 트리거:**

| 지표 | 임계치 |
|------|------|
| shadcn/ui 컴포넌트 추가 비용 누적 (직접 스타일링) | 컴포넌트 20개+ 추가 |
| 자체 디자인 시스템 토큰 관리 비용 증가 | — |
| Charts·DateTimePicker·NotificationsProvider 등 Mantine 통합 가치 | 명확 |

→ shadcn/ui로 확장 비용이 Mantine 통합 가치를 초과 시 검토. (사주라 14 카테고리 규모는 shadcn/ui로 충분)

---

## 3. 통합 최종 결정 (spec 반영)

### 3.1 결정 항목 (3건)

| 항목 | 결정 | spec 반영 위치 |
|------|------|--------------|
| 스타일 시스템 | **Tailwind CSS v4** | FE spec 신설 시 명시 |
| 컴포넌트 라이브러리 | **shadcn/ui** (Radix + Tailwind) | FE spec 신설 시 명시 |
| 아이콘 | **lucide-react** | FE spec 신설 시 명시 |

> 본 카테고리 결정으로 인한 backend·schema·api 변경 없음.

### 3.2 결정에 따라 다른 카테고리에 미치는 영향

| 영향 | 영향 받는 카테고리 |
|------|----------------|
| Tailwind v4 → CSP 정합 검토 (`style-src 'unsafe-inline'` 제거 가능 여부) | `08_auth_security.md` §2 (CSP nonce) |
| shadcn/ui Radix 기반 → 폼 컴포넌트는 React Hook Form Controller로 통합 | `05_form_validation.md` |
| shadcn/ui CLI 산출물은 `src/components/ui/` 에 commit | `09_testing_quality.md` (린트·테스트 대상) |

---

## 4. 후보 세부 정보

### 4.1 Tailwind CSS v4 ✅
- **사용처**: 모든 컴포넌트 스타일
- **장점**: runtime 0, Lightning CSS 기반 빌드, `@theme`로 디자인 토큰, 반응형(`sm:`/`md:`)·다크모드(`dark:`)·상태(`hover:`/`focus:`)·자식 셀렉터(`[&_svg]:size-4`) 등 표현력 강력
- **단점**: utility 명명 학습 비용 — 1회 정착 후 비용 작음. 긴 className 가독성 → `clsx`·`cn` 헬퍼·prettier-plugin-tailwindcss로 완화
- **세부사항**: MIT. `tailwindcss@^4`

### 4.2 shadcn/ui ✅
- **사용처**: 폼·다이얼로그·드로어·테이블·탭·아코디언·토스트 등 사주라 IA 전체
- **장점**: CLI로 컴포넌트 코드 복사 → 패키지 의존성 없음, 코드 보유, Radix 기반 접근성, Tailwind 정합. React 19 호환. theme 토큰 CSS 변수로 다크 모드 표준
- **단점**: 컴포넌트 업그레이드는 CLI 재실행 필요. 직접 수정한 코드는 머지 부담 — 사주라 1인 운영에서 수정 후 안정화 가능
- **세부사항**: MIT. `shadcn` CLI

### 4.3 lucide-react ✅
- **사용처**: 모든 아이콘
- **장점**: shadcn/ui 표준 아이콘 세트. Tree-shake, SVG 컴포넌트, 1500+ 아이콘
- **단점**: 한국형 도메인 아이콘(예: 한식 메뉴) 부재 — 필요 시 자체 SVG 추가
- **세부사항**: ISC. `lucide-react`

### 4.4 Mantine v7 🟡 (보존)
- **사용처**: 컴포넌트 추가 비용 누적 시 마이그레이션
- **장점**: 자체 디자인 시스템 풍부 + 폼·DateTime·차트·알림 통합
- **단점**: 자체 CSS·Tailwind 충돌·코드 소유권 없음
- **세부사항**: MIT

### 4.5 탈락 후보 요약

| 후보 | 분류 | 탈락 사유 |
|------|------|---------|
| CSS Modules | 스타일 | 디자인 토큰 관리 부담·shadcn/ui 비표준 |
| Emotion / styled-components | 스타일 | runtime CSS·React 19 호환 진행 |
| vanilla-extract | 스타일 | shadcn/ui 비표준 |
| Panda CSS | 스타일 | 신규 — 마인드셰어 부족 |
| Radix UI 단독 | 컴포넌트 | shadcn/ui가 Radix + Tailwind 상위 — 직접 사용 중복 |
| Headless UI | 컴포넌트 | 커버리지 부족 |
| MUI v6 | 컴포넌트 | Material 비주얼 과함·Emotion runtime |
| Chakra UI v3 | 컴포넌트 | 자체 CSS-in-JS — Tailwind 충돌 |
| Ant Design v5 | 컴포넌트 | 엔터프라이즈 — 모바일 PWA 부적합·번들 ~1MB |

---

## 5. 비교 요약 표

| 분류 | 후보 | 결과 | 핵심 사유 |
|------|------|------|---------|
| 스타일 | Tailwind CSS v4 | ✅ | runtime 0·반응형 표준·shadcn 정합 |
| 스타일 | CSS Modules | ⛔ | 디자인 토큰 부담 |
| 스타일 | Emotion / styled-components | ⛔ | runtime·React 19 호환 진행 |
| 스타일 | vanilla-extract / Panda | ⛔ | shadcn 비표준·마인드셰어 |
| 컴포넌트 | shadcn/ui | ✅ | 코드 보유·Radix·Tailwind·CLI |
| 컴포넌트 | Mantine v7 | 🟡 보존 | 통합 가치 트리거 |
| 컴포넌트 | Radix UI 단독 / Headless UI | ⛔ | shadcn 중복 · 커버 부족 |
| 컴포넌트 | MUI / Chakra / AntD | ⛔ | Material·자체 CSS·번들·비주얼 과함 |
| 아이콘 | lucide-react | ✅ | shadcn 표준·Tree-shake |
