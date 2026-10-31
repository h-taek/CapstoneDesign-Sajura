# 폼·검증

> **카테고리**: 폼 상태 관리 라이브러리, 스키마 검증 라이브러리, 두 라이브러리 통합 어댑터 비교
> **연결 spec**: `02_implementation_design.md` §3 (22개 endpoint의 요청 DTO), `03_be.md` §1 (BE Pydantic v2), `01_basic_design.md` §3.1·§3.2·§3.3·§3.7 (사주라 주요 폼 — 온보딩·메뉴·재고·발주 수정)

---

## 1. 폼 상태 관리

### 1.1 사주라 폼 인벤토리

| 폼 | spec 위치 | 필드 수 (대략) | 복잡도 |
|----|---------|--------|-------|
| 온보딩 Step 1 (사업자번호) | `01_basic_design.md` §3.1.4 | 1 + 검증 결과 | 단순 |
| 온보딩 Step 2 (매장 정보) | 동상 | 6 (매장명·업종·연락처·주소·규모·운영형태) | 중간 |
| 온보딩 Step 3 (POS 연동) | 동상 | 1~3 (POS 종류·자격증명) | 단순 |
| 온보딩 Step 4 (초기 재고·메뉴) | 동상 | 다중 행 추가 (FieldArray) | 복잡 |
| 메뉴 등록·수정 | `01_basic_design.md` §3.2.2 | 3 + 레시피 FieldArray | 중간 |
| 재고 추가·수정 | `01_basic_design.md` §3.3.4 | 4 + 수정 사유 | 단순 |
| 발주 수정·승인 | `01_basic_design.md` §3.7.4 | 다중 행 인라인 편집 | 복잡 |
| 알림 설정 | `04_fe.md` §4.9 | 토글 4개 | 단순 |

### 1.2 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | React Hook Form (RHF) 7.x | 비제어 (uncontrolled) | 마인드셰어 압도 |
| 2 | Formik | 제어 (controlled) | 2023 이후 유지보수 둔화 |
| 3 | Final Form | 제어 | 마인드셰어 약함 |
| 4 | TanStack Form 0.x | 비제어 | 신규, TanStack 생태계 |

### 1.3 1차 벤치마크 — 필수 기능

| # | 후보 | 비제어 (re-render 최소) | FieldArray | TS 1급 | zod 통합 | shadcn/ui Controller 패턴 |
|---|------|:---:|:---:|:---:|:---:|:---:|
| 1 | RHF 7.x | ◎ | ◎ (`useFieldArray`) | ◎ | ◎ (@hookform/resolvers/zod) | ◎ (shadcn/ui 공식 예제 RHF 기반) |
| 2 | Formik | X (controlled, re-render 많음) | O | △ | △ (formik-zod 비공식) | △ |
| 3 | Final Form | O | O | △ | △ | △ |
| 4 | TanStack Form 0.x | ◎ | ◎ | ◎ | O | △ (예제 부족) |

### 1.4 후보별 차이

- RHF — shadcn/ui `<Form>`·`<FormField>`·`<FormItem>`이 RHF Controller 기반이다.
- Formik — 제어 모델이라 큰 폼에서 re-render가 많다. 2023 이후 유지보수가 둔화됐고 React 19 호환은 공식 검증되지 않았다.
- Final Form — 마인드셰어가 약하고 자료가 적다.
- TanStack Form — 0.x 단계이며 shadcn/ui 예제가 부족하다. TanStack 생태계(Query·Router)와 통합된다.

---

## 2. 스키마 검증

### 2.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | zod 3.x | TypeScript-first 스키마 | 마인드셰어 압도 |
| 2 | yup | 스키마 검증 | 오래된 표준, TS 약함 |
| 3 | valibot | 경량 zod 대안 | 0.x, 번들 작음 |

### 2.2 1차 벤치마크 — 필수 기능

| # | 후보 | TS 1급 (z.infer) | RHF 통합 | Pydantic v2 정합도 (수동 매핑) | 마인드셰어 | 번들 크기 |
|---|------|:---:|:---:|:---:|:---:|:---:|
| 1 | zod 3.x | ◎ | ◎ | ◎ (필드 단위 1:1 표현 가능) | ◎ | △ (~13 KB gzip) |
| 2 | yup | △ (TS 보조) | O (@hookform/resolvers/yup) | △ | O | ~12 KB |
| 3 | valibot | ◎ | O (@hookform/resolvers/valibot) | O | △ | ◎ (~3 KB) |

### 2.3 후보별 차이

- zod — `z.infer<typeof Schema>`로 타입을 추론하고 `z.discriminatedUnion`·`z.refine`·`z.transform`을 제공한다.
- yup — `InferType<typeof Schema>`로 타입을 추론하나 옵셔널·union 표현이 zod보다 복잡하다. React 생태계 마인드셰어가 zod로 옮겨 갔다.
- valibot — 번들이 zod의 약 4분의 1이고 함수 단위 import(`v.string()`)로 tree-shake된다. RHF resolver는 있으나 shadcn/ui 표준 예제는 zod 기반이고, 마인드셰어·자료가 zod보다 적다.

---

## 3. 통합 어댑터

`@hookform/resolvers/zod`는 RHF 공식 resolver다. `useForm({ resolver: zodResolver(schema) })` 한 줄로 연결되고, zod 스키마의 검증 규칙(transform·refine 포함)이 RHF errors로 전달된다.

---

## 4. 후보 세부 정보

### 4.1 React Hook Form 7.x
- **장점**: 비제어 모델로 re-render 최소 — `useFieldArray`로 동적 행, `Controller`로 shadcn/ui 통합, devtools 플러그인
- **단점**: 비제어 멘탈 모델 학습 비용
- **세부사항**: MIT. `react-hook-form@^7`

### 4.2 zod 3.x
- **장점**: TypeScript-first(z.infer), 변환·refine 풍부, RHF/TanStack Form/Astro 등 광범위 통합
- **단점**: 번들 ~13 KB — valibot 대비 큼
- **세부사항**: MIT. `zod@^3`

### 4.3 @hookform/resolvers/zod
- **장점**: 공식 RHF resolver, 1줄 통합
- **단점**: 없음
- **세부사항**: MIT. `@hookform/resolvers`

### 4.4 TanStack Form 0.x
- **장점**: TanStack 생태계 통합, 비제어 + 강력한 TS
- **단점**: 0.x — 안정성·예제 부족
- **세부사항**: MIT

### 4.5 valibot
- **장점**: ~3 KB · tree-shake (함수 단위 import)
- **단점**: 마인드셰어·자료 약함
- **세부사항**: MIT

---

## 5. 비교 요약 표

| 분류 | 후보 | 특징 |
|------|------|------|
| 폼 | React Hook Form 7.x | 비제어·FieldArray·shadcn/ui `<Form>` 기반 |
| 폼 | Formik | 제어 모델·유지보수 둔화 |
| 폼 | Final Form | 마인드셰어 약함 |
| 폼 | TanStack Form 0.x | 0.x·shadcn/ui 예제 부족 |
| 검증 | zod 3.x | TS-first·z.infer·~13 KB |
| 검증 | yup | 옵셔널·union 타입 표현 복잡 |
| 검증 | valibot | ~3 KB·tree-shake·자료 적음 |
| 어댑터 | @hookform/resolvers/zod | 공식 RHF resolver |
