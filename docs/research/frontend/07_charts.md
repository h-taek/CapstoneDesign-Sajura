# 차트·시각화

> **카테고리**: 대시보드 차트 라이브러리 결정
> **연결 spec**: `04_feature_spec.md` §12.4 (대시보드 7종 차트), `04_feature_spec.md` §8.2 (ROI 지표 5종)

---

## 0. 카테고리 구성 & 결정 항목

| 하위 카테고리 | 후보 수 | 결정 항목 수 |
|------------|--------|------------|
| §1 차트 라이브러리 | 5 | 1 (Recharts) |
| §2 통합 결정 | — | §2 참조 |

### 본 research가 결정하는 항목

| 항목 | 결정 | 결정 근거 위치 |
|------|------|--------------|
| 차트 라이브러리 | **Recharts 2.x** | §1.4 |

---

## 1. 차트 라이브러리

### 1.1 사주라 차트 인벤토리

| 화면 | 차트 종류 | 출처 |
|------|---------|------|
| 대시보드 | 선 그래프 (매출 추이·예측 vs 실제·폐기율·MAPE) ×4 | `04_feature_spec.md` §12.4 |
| 대시보드 | 도넛 차트 (메뉴별 판매 비중) ×1 | 동상 |
| 대시보드 | 막대 그래프 (월별 폐기 비용) ×1 | 동상 |
| 대시보드 | 수치 + 증감 화살표 (전월 대비 변화율) ×1 | 동상 (차트 아닌 KPI 카드) |
| 수요예측 | 수치 카드 (예측값·신뢰도) | `04_feature_spec.md` §12.8 (차트 아님) |

→ **사주라 차트 요구**: 선·도넛·막대 3종. 인터랙션은 hover tooltip 정도. 복잡한 상호작용(zoom·brush·drill-down) MVP에서는 미요구.

### 1.2 전체 후보 목록

| # | 후보 | 분류 | 렌더링 | 비고 |
|---|------|------|------|------|
| 1 | Recharts 2.x | React 1급 | SVG | 마인드셰어 압도, 컴포넌트형 |
| 2 | Chart.js + react-chartjs-2 | wrapper | Canvas | 인터랙션·플러그인 풍부 |
| 3 | Apache ECharts + echarts-for-react | wrapper | Canvas/SVG | 매우 강력, 큰 번들 |
| 4 | Visx | low-level | SVG | Airbnb, D3 기반 컴포넌트 |
| 5 | Nivo | React 1급 | SVG/Canvas | 디자인 깔끔, 큰 번들 |

### 1.3 1차 벤치마크 — 사주라 MVP 필수 기능

| # | 후보 | 사주라 3종 차트 표현 | TS 1급 | 번들 크기 (gzip) | React 컴포넌트형 | 학습 비용 | 결과 |
|---|------|:---:|:---:|:---:|:---:|:---:|:---|
| 1 | Recharts 2.x | ◎ | ◎ | △ (~80 KB) | ◎ | ◎ (낮음) | ✅ **통과** |
| 2 | Chart.js + react-chartjs-2 | ◎ | O | O (~50 KB Chart.js + 5 KB wrapper) | O (wrapper imperative) | O | 🟡 **보존** |
| 3 | Apache ECharts | ◎ | O | ⛔ (~250 KB) | △ (wrapper) | △ (option object 멘탈 모델) | ⛔ |
| 4 | Visx | ◎ (수동 조립) | ◎ | △ (선택 import) | ◎ | ⛔ (D3 멘탈 모델 학습 부담) | ⛔ |
| 5 | Nivo | ◎ | O | ⛔ (~150 KB+ 패키지별) | ◎ | O | ⛔ (번들 큼·사주라 디자인 자유도 우위 작음) |

### 1.4 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| 사주라 3종 차트 (선·도넛·막대) | **필수** | 대시보드 7개 차트 모두 표현 |
| TypeScript 1급 | **필수** | TS strict 환경 |
| React 컴포넌트형 (선언적) | **필수** | shadcn/ui 코드 보유 패턴과 정합 |
| 번들 크기 작음 | 중요 | PWA 초기 로드 — 대시보드는 lazy route로 분리하지만 그래도 작을수록 좋음 |
| 학습 비용 낮음 | 중요 | 1인 운영 |

**탈락 사유:**

- **#3 Apache ECharts** — 매우 강력하나 ~250 KB 번들. 사주라 차트 요구(3종·기본 인터랙션)에 과함. option object 멘탈 모델 학습.
- **#4 Visx** — D3 컴포넌트화로 자유도 극강이나 수동 조립 필요. 사주라 단순 차트에 학습 비용 큼.
- **#5 Nivo** — 디자인 깔끔하나 번들 크기·디자인 자유도 우위 작음. 사주라는 shadcn/ui로 디자인 일관성 유지하므로 Nivo 디자인 시스템 가치 작음.

### 1.5 최종 선발

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **차트 라이브러리** | **Recharts 2.x** ✅ | React 컴포넌트형(`<LineChart>`/`<BarChart>`/`<PieChart>` 선언적), TS 1급, 사주라 3종 차트 모두 표준 표현. SVG 기반으로 적은 데이터 포인트(월별 12~24개)에서 충분히 빠름. 학습 비용 낮고 자료 풍부. shadcn/ui 차트 컴포넌트가 Recharts 기반(`@/components/ui/chart`) |

### 1.6 권장 사용 패턴

```tsx
// dashboard/RevenueTrend.tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { DashboardDTO } from '@/types/api';

export function RevenueTrend({ data }: { data: DashboardDTO['monthly_revenue'] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis tickFormatter={(v) => `${(v / 10_000).toFixed(0)}만`} />
        <Tooltip formatter={(v: number) => `${v.toLocaleString()}원`} />
        <Line type="monotone" dataKey="revenue" stroke="oklch(0.6 0.15 250)" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

| 패턴 | 사유 |
|------|------|
| `ResponsiveContainer` | 반응형 PWA — 모바일·태블릿 너비 자동 |
| `tickFormatter` | 한글 단위(만·천) 표시 |
| `Tooltip formatter` | `toLocaleString()` ko-KR 천 단위 콤마 |
| `stroke` 토큰 | `04_ui_styling.md` §1.5 oklch 디자인 토큰 정합 |

### 1.7 shadcn/ui Chart 통합

shadcn/ui v0.8+에서 Recharts wrapper `<ChartContainer>`·`<ChartTooltip>` 제공. CLI로 추가 가능.

```bash
pnpm dlx shadcn@latest add chart
```

→ `src/components/ui/chart.tsx` 코드 복사. Recharts를 dependency로 추가하여 사주라 디자인 토큰과 결합.

### 1.8 보존 후보 (Chart.js)

Canvas 기반으로 데이터 포인트 1000+ 시 성능 우위. 사주라 MVP 50매장·월별 24개 포인트 규모에서는 SVG로 충분.

**재평가 트리거:**

| 지표 | 임계치 |
|------|------|
| 단일 차트 데이터 포인트 수 | ≥ 1000 (예: 시간 단위 1개월) |
| Recharts SVG로 60fps 미만 발생 | 화면 2개+ |
| 인터랙션(zoom·pan·brush) 필요 | 화면 2개+ |

→ 2개 이상 충족 시 Chart.js로 부분 마이그레이션 검토 (해당 화면만).

---

## 2. 통합 최종 결정 (spec 반영)

### 2.1 결정 항목 (1건)

| 항목 | 결정 | spec 반영 위치 |
|------|------|--------------|
| 차트 라이브러리 | **Recharts 2.x** + shadcn/ui chart 통합 | FE spec 신설 시 명시 |

> 본 카테고리 결정은 BE 측 변경 유발 없음. 대시보드 데이터는 이미 `GET /api/dashboard`·`GET /api/dashboard/roi`(`07_api_spec.md`)에서 정의됨.

### 2.2 결정에 따라 다른 카테고리에 미치는 영향

| 영향 | 영향 받는 카테고리 |
|------|----------------|
| Recharts → 대시보드 chunk 분리 권장 | `01_framework_build.md` §2.5 manualChunks (`charts: ['recharts']` 이미 명시) |
| shadcn/ui chart 추가 | `04_ui_styling.md` 컴포넌트 인벤토리 추가 |

---

## 3. 후보 세부 정보

### 3.1 Recharts 2.x ✅
- **사용처**: 대시보드 7종 차트
- **장점**: React 컴포넌트형, TS 1급, 마인드셰어, shadcn/ui chart 통합, SVG로 단순 차트에 적합
- **단점**: 1000+ 데이터 포인트에서 SVG 성능 한계 — 사주라 MVP 규모 무관
- **세부사항**: MIT. `recharts@^2`

### 3.2 Chart.js + react-chartjs-2 🟡 (보존)
- **장점**: Canvas로 대량 데이터 빠름·플러그인 풍부
- **단점**: imperative wrapper·디자인 자유도 React 컴포넌트형 대비 낮음
- **세부사항**: MIT

### 3.3 탈락 후보 요약

| 후보 | 탈락 사유 |
|------|---------|
| Apache ECharts | 번들 ~250 KB·사주라 요구 대비 과함 |
| Visx | D3 학습 비용·수동 조립 |
| Nivo | 번들 큼·디자인 자유도 우위 작음 |

---

## 4. 비교 요약 표

| 후보 | 결과 | 핵심 사유 |
|------|------|---------|
| Recharts 2.x | ✅ | React 1급·shadcn 통합·사주라 3종 표준 표현 |
| Chart.js | 🟡 보존 | 대량 데이터·인터랙션 트리거 |
| Apache ECharts | ⛔ | 번들 ~250 KB |
| Visx | ⛔ | D3 학습 비용 |
| Nivo | ⛔ | 번들·자유도 우위 작음 |
