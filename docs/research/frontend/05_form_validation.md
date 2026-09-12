# 폼·검증

> **카테고리**: 폼 상태 관리 라이브러리, 스키마 검증 라이브러리, 두 라이브러리 통합 어댑터 결정
> **연결 spec**: `07_api_spec.md` (22개 endpoint의 요청 DTO), `09_service_design.md` §1 (BE Pydantic v2), `04_feature_spec.md` §1·§2·§3·§6 (사주라 주요 폼 — 온보딩·메뉴·재고·발주 수정)

---

## 0. 카테고리 구성 & 결정 항목

| 하위 카테고리 | 후보 수 | 결정 항목 수 |
|------------|--------|------------|
| §1 폼 상태 관리 | 4 | 1 (React Hook Form) |
| §2 스키마 검증 | 3 | 1 (zod) |
| §3 통합 어댑터 | — | 1 (@hookform/resolvers/zod) |
| §4 통합 결정 | — | §4 참조 |

### 본 research가 결정하는 항목

| 항목 | 결정 | 결정 근거 위치 |
|------|------|--------------|
| 폼 상태 관리 | **React Hook Form 7.x** | §1.4 |
| 스키마 검증 | **zod 3.x** | §2.4 |
| 통합 어댑터 | **@hookform/resolvers/zod** | §3 |

---

## 1. 폼 상태 관리

### 1.1 사주라 폼 인벤토리

| 폼 | spec 위치 | 필드 수 (대략) | 복잡도 |
|----|---------|--------|-------|
| 온보딩 Step 1 (사업자번호) | `04_feature_spec.md` §1.4 | 1 + 검증 결과 | 단순 |
| 온보딩 Step 2 (매장 정보) | 동상 | 6 (매장명·업종·연락처·주소·규모·운영형태) | 중간 |
| 온보딩 Step 3 (POS 연동) | 동상 | 1~3 (POS 종류·자격증명) | 단순 |
| 온보딩 Step 4 (초기 재고·메뉴) | 동상 | 다중 행 추가 (FieldArray) | 복잡 |
| 메뉴 등록·수정 | `04_feature_spec.md` §2.2 | 3 + 레시피 FieldArray | 중간 |
| 재고 추가·수정 | `04_feature_spec.md` §3.4 | 4 + 수정 사유 | 단순 |
| 발주 수정·승인 | `04_feature_spec.md` §6.4 | 다중 행 인라인 편집 | 복잡 |
| 알림 설정 | `04_feature_spec.md` §12.10 | 토글 4개 | 단순 |

### 1.2 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | React Hook Form (RHF) 7.x | 비제어 (uncontrolled) | 마인드셰어 압도 |
| 2 | Formik | 제어 (controlled) | **2023 유지보수 둔화** |
| 3 | Final Form | 제어 | 마인드셰어 약함 |
| 4 | TanStack Form 0.x | 비제어 | 신규, TanStack 생태계 |

### 1.3 1차 벤치마크 — 사주라 MVP 필수 기능

| # | 후보 | 비제어 (re-render 최소) | FieldArray | TS 1급 | zod 통합 | shadcn/ui Controller 패턴 | 결과 |
|---|------|:---:|:---:|:---:|:---:|:---:|:---|
| 1 | RHF 7.x | ◎ | ◎ (`useFieldArray`) | ◎ | ◎ (@hookform/resolvers/zod) | ◎ (shadcn/ui 공식 예제 RHF 기반) | ✅ **통과** |
| 2 | Formik | ⛔ (controlled, re-render 많음) | O | △ | △ (formik-zod 비공식) | △ | ⛔ (유지보수 둔화) |
| 3 | Final Form | O | O | △ | △ | △ | ⛔ (마인드셰어 약함) |
| 4 | TanStack Form 0.x | ◎ | ◎ | ◎ | O | △ (예제 부족) | 🟡 **보존** |

### 1.4 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| 비제어 (re-render 최소) | **필수** | 발주 수정·메뉴 레시피 등 다중 행 FieldArray에서 re-render 비용 큼 |
| FieldArray | **필수** | 레시피 재료·발주 품목 등 N개 행 동적 추가 |
| zod 통합 | **필수** | §2.4 zod 결정과 통합 — 동일 스키마로 BE Pydantic v2 정합 |
| shadcn/ui 호환 | **필수** | §04 shadcn/ui `<Form>` 컴포넌트가 RHF Controller 기반 |

**탈락 사유:**

- **#2 Formik** — 2023 이후 유지보수 둔화. React 19 호환 검증 미공식. 제어 모델로 큰 폼에서 re-render 많음.
- **#3 Final Form** — 마인드셰어 약함·자료 부족. 1인 운영 트러블슈팅 부담.

### 1.5 최종 선발

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **폼 상태 관리** | **React Hook Form 7.x** ✅ | 비제어 모델로 re-render 최소(필드 단위). `useFieldArray`로 레시피·발주 다중 행 표준 표현. `@hookform/resolvers/zod`로 zod 스키마 직결. shadcn/ui `<Form>`·`<FormField>`·`<FormItem>` 모두 RHF Controller 기반 — 공식 예제·자료 풍부 |

### 1.6 보존 후보 (TanStack Form 0.x)

신규 라이브러리지만 TanStack 생태계(Query·Router) 통합 가능성 있음. 다음 트리거 충족 시 검토.

**재평가 트리거:**

| 지표 | 임계치 |
|------|------|
| TanStack Form 1.0 안정 release | 출시 |
| shadcn/ui TanStack Form 표준 예제 | 추가 |
| RHF로 표현 불가능한 시나리오 (TanStack Router 통합 등) | 사례 2건+ |

→ 3개 모두 충족 시 부분 마이그레이션 검토.

---

## 2. 스키마 검증

### 2.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | zod 3.x | TypeScript-first 스키마 | 마인드셰어 압도 |
| 2 | yup | 스키마 검증 | 오래된 표준, TS 약함 |
| 3 | valibot | 경량 zod 대안 | 0.x, 번들 작음 |

### 2.2 1차 벤치마크 — 사주라 MVP 필수 기능

| # | 후보 | TS 1급 (z.infer) | RHF 통합 | Pydantic v2 정합도 (수동 매핑) | 마인드셰어 | 번들 크기 | 결과 |
|---|------|:---:|:---:|:---:|:---:|:---:|:---|
| 1 | zod 3.x | ◎ | ◎ | ◎ (필드 단위 1:1 표현 가능) | ◎ | △ (~13 KB gzip) | ✅ **통과** |
| 2 | yup | △ (TS 보조) | O (@hookform/resolvers/yup) | △ | O | ~12 KB | ⛔ |
| 3 | valibot | ◎ | O (@hookform/resolvers/valibot) | O | △ | ◎ (~3 KB) | 🟡 **보존** |

### 2.3 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| TypeScript 1급 (`z.infer<typeof Schema>`) | **필수** | 폼 입력 → 검증 → API 호출까지 동일 타입 흐름 |
| RHF 통합 (resolvers) | **필수** | §1 결정과 통합 |
| BE Pydantic v2 정합 | **필수** | 동일 검증 규칙을 FE에서 1차로 적용 — UX 개선 + BE 부하 감소 |
| 변환·refine·discriminatedUnion 등 표현력 | 중요 | 사업자번호 검증·POS 타입 분기 폼 등 |

**탈락 사유:**

- **#2 yup** — TS 친화도 zod 대비 약함(`InferType<typeof Schema>` 동등 표현 가능하나 옵셔널·union 표현이 복잡). 마인드셰어도 React 생태계에서 zod로 이동.

### 2.4 최종 선발

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **스키마 검증** | **zod 3.x** ✅ | TypeScript-first — `z.infer<typeof Schema>`로 폼 타입 자동 추론. `z.discriminatedUnion`·`z.refine`·`z.transform` 표현력. `@hookform/resolvers/zod`로 RHF 통합. BE Pydantic v2 검증 규칙과 1:1 매핑 가능 (사업자번호 정규식·이메일·매장명 길이 등) |

### 2.5 보존 후보 (valibot)

zod 대비 번들 크기 4배 작음·tree-shake 가능 (`v.string()` 함수 단위 import). PWA 번들 최적화 시 매력. 다만 마인드셰어·자료가 zod 대비 약하고 RHF resolver는 valibot 지원이지만 shadcn/ui 표준 예제는 zod 기반.

**재평가 트리거:**

| 지표 | 임계치 |
|------|------|
| 폼 검증 스키마 수 | ≥ 30 (사주라 ~12) |
| 번들 분석에서 zod가 상위 5 의존성에 포함 | — |
| valibot 1.0 안정 release + shadcn/ui 표준 지원 | — |

→ 2개 충족 시 마이그레이션 검토.

---

## 3. 통합 어댑터

### 3.1 결정

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **RHF ↔ zod 통합** | **@hookform/resolvers/zod** ✅ | RHF 공식 resolver. `useForm({ resolver: zodResolver(schema) })` 1줄로 통합. zod 스키마의 모든 검증 규칙(transform·refine 포함)이 RHF errors로 전달 |

### 3.2 권장 폼 패턴

```ts
// schemas/store.ts
import { z } from 'zod';

export const StoreInfoSchema = z.object({
  store_name: z.string().min(1, '매장명은 필수입니다').max(100),
  business_type: z.string().min(1, '업종을 선택하세요'),
  phone: z.string().regex(/^010-\d{4}-\d{4}$/, '010-XXXX-XXXX 형식'),
  address: z.string().min(1, '주소는 필수입니다'),
  store_size: z.enum(['SMALL', 'MEDIUM', 'LARGE']),
  operation_type: z.enum(['HALL', 'DELIVERY', 'HYBRID']),
});

export type StoreInfo = z.infer<typeof StoreInfoSchema>;
```

```tsx
// components/onboarding/StoreInfoForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormField, FormItem, FormControl, FormLabel, FormMessage } from '@/components/ui/form';
import { StoreInfoSchema, type StoreInfo } from '@/schemas/store';

export function StoreInfoForm({ onSubmit }: { onSubmit: (v: StoreInfo) => void }) {
  const form = useForm<StoreInfo>({
    resolver: zodResolver(StoreInfoSchema),
    defaultValues: {
      store_name: '', business_type: '', phone: '',
      address: '', store_size: 'SMALL', operation_type: 'HALL',
    },
  });
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="store_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>매장명</FormLabel>
              <FormControl><input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* ... */}
      </form>
    </Form>
  );
}
```

| 패턴 | 사유 |
|------|------|
| zod 스키마와 BE Pydantic v2 1:1 매핑 | 검증 규칙 한 곳에서 정의 — 동시 변경 부담만 잔존 |
| `z.infer`로 타입 추출 | 별도 타입 정의 중복 회피 |
| shadcn/ui `<Form>` 컴포넌트 사용 | RHF Controller 표준 패턴 — 공식 예제 호환 |
| `transform`·`refine` 활용 | 사업자번호 하이픈 제거·정규화 등 변환 표준 |

---

## 4. 통합 최종 결정 (spec 반영)

### 4.1 결정 항목 (3건)

| 항목 | 결정 | spec 반영 위치 |
|------|------|--------------|
| 폼 상태 관리 | **React Hook Form 7.x** | FE spec 신설 시 명시 |
| 스키마 검증 | **zod 3.x** | FE spec 신설 시 명시 |
| 통합 어댑터 | **@hookform/resolvers/zod** | FE spec 신설 시 명시 |

> 본 카테고리 결정은 BE 측 변경 유발 없음. BE Pydantic v2 검증 규칙은 그대로이며, FE zod 스키마가 동일 규칙을 1차로 적용하여 BE 부하 감소·UX 개선.

### 4.2 결정에 따라 다른 카테고리에 미치는 영향

| 영향 | 영향 받는 카테고리 |
|------|----------------|
| zod 스키마 ↔ BE Pydantic v2 동기 부담 | spec 운영 — 변경 시 양쪽 동시 갱신 정책 명시 필요 |
| openapi-zod-client 미채택(`03_data_http.md` §3.3) | zod 스키마는 수동 작성 — endpoint 22개 규모에서 부담 작음 |

---

## 5. 후보 세부 정보

### 5.1 React Hook Form 7.x ✅
- **사용처**: 모든 폼 (온보딩·메뉴·재고·발주·설정)
- **장점**: 비제어 모델로 re-render 최소 — `useFieldArray`로 동적 행, `Controller`로 shadcn/ui 통합, devtools 플러그인
- **단점**: 비제어 멘탈 모델 학습 비용 — 1회 정착 후 비용 작음
- **세부사항**: MIT. `react-hook-form@^7`

### 5.2 zod 3.x ✅
- **사용처**: 폼 스키마 + (선택) API 응답 sanity check
- **장점**: TypeScript-first(z.infer), 변환·refine 풍부, RHF/TanStack Form/Astro 등 광범위 통합
- **단점**: 번들 ~13 KB — valibot 대비 큼
- **세부사항**: MIT. `zod@^3`

### 5.3 @hookform/resolvers/zod ✅
- **사용처**: RHF ↔ zod 어댑터
- **장점**: 공식 RHF resolver, 1줄 통합
- **단점**: 없음
- **세부사항**: MIT. `@hookform/resolvers`

### 5.4 TanStack Form 0.x 🟡 (보존)
- **장점**: TanStack 생태계 통합, 비제어 + 강력한 TS
- **단점**: 0.x — 안정성·예제 부족
- **세부사항**: MIT

### 5.5 valibot 🟡 (보존)
- **장점**: ~3 KB · tree-shake (함수 단위 import)
- **단점**: 마인드셰어·자료 약함
- **세부사항**: MIT

### 5.6 탈락 후보 요약

| 후보 | 분류 | 탈락 사유 |
|------|------|---------|
| Formik | 폼 | 유지보수 둔화·controlled re-render |
| Final Form | 폼 | 마인드셰어 약함 |
| yup | 검증 | TS 친화도 zod 대비 약함 |

---

## 6. 비교 요약 표

| 분류 | 후보 | 결과 | 핵심 사유 |
|------|------|------|---------|
| 폼 | React Hook Form 7.x | ✅ | 비제어·FieldArray·shadcn/ui 정합 |
| 폼 | Formik | ⛔ | 유지보수 둔화 |
| 폼 | Final Form | ⛔ | 마인드셰어 약함 |
| 폼 | TanStack Form 0.x | 🟡 보존 | 1.0 + shadcn 지원 트리거 |
| 검증 | zod 3.x | ✅ | TS-first·z.infer·resolver 표준 |
| 검증 | yup | ⛔ | TS 친화도 약함 |
| 검증 | valibot | 🟡 보존 | 스키마 30+ · 번들 트리거 |
| 어댑터 | @hookform/resolvers/zod | ✅ | 공식 RHF resolver |
