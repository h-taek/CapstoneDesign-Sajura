# 차트·시각화

> **카테고리**: 대시보드 차트 라이브러리 비교
> **연결 spec**: `04_fe.md` §4.4 (대시보드 7종 차트), `01_basic_design.md` §3.9.2 (ROI 지표 5종)

---

## 1. 차트 라이브러리

### 1.1 사주라 차트 인벤토리

| 화면 | 차트 종류 | 출처 |
|------|---------|------|
| 대시보드 | 선 그래프 (매출 추이·예측 vs 실제·폐기율·MAPE) ×4 | `04_fe.md` §4.4 |
| 대시보드 | 도넛 차트 (메뉴별 판매 비중) ×1 | 동상 |
| 대시보드 | 막대 그래프 (월별 폐기 비용) ×1 | 동상 |
| 대시보드 | 수치 + 증감 화살표 (전월 대비 변화율) ×1 | 동상 (차트 아닌 KPI 카드) |
| 수요예측 | 수치 카드 (예측값·신뢰도) | `04_fe.md` §4.8 (차트 아님) |

### 1.2 전체 후보 목록

| # | 후보 | 분류 | 렌더링 | 비고 |
|---|------|------|------|------|
| 1 | Recharts 2.x | React 1급 | SVG | 마인드셰어 압도, 컴포넌트형 |
| 2 | Chart.js + react-chartjs-2 | wrapper | Canvas | 인터랙션·플러그인 풍부 |
| 3 | Apache ECharts + echarts-for-react | wrapper | Canvas/SVG | 매우 강력, 큰 번들 |
| 4 | Visx | low-level | SVG | Airbnb, D3 기반 컴포넌트 |
| 5 | Nivo | React 1급 | SVG/Canvas | 디자인 깔끔, 큰 번들 |

### 1.3 1차 벤치마크 — 필수 기능

| # | 후보 | 선·도넛·막대 표현 | TS 1급 | 번들 크기 (gzip) | React 컴포넌트형 | 학습 비용 |
|---|------|:---:|:---:|:---:|:---:|:---:|
| 1 | Recharts 2.x | ◎ | ◎ | △ (~80 KB) | ◎ | ◎ (낮음) |
| 2 | Chart.js + react-chartjs-2 | ◎ | O | O (~50 KB Chart.js + 5 KB wrapper) | O (wrapper imperative) | O |
| 3 | Apache ECharts | ◎ | O | X (~250 KB) | △ (wrapper) | △ (option object 멘탈 모델) |
| 4 | Visx | ◎ (수동 조립) | ◎ | △ (선택 import) | ◎ | X (D3 멘탈 모델 학습 부담) |
| 5 | Nivo | ◎ | O | X (~150 KB+ 패키지별) | ◎ | O |

### 1.4 후보별 차이

- Recharts — `<LineChart>`/`<BarChart>`/`<PieChart>`를 선언적으로 쓰는 React 컴포넌트형이다. SVG 기반이라 데이터 포인트 1000개 이상에서 성능 한계가 있다.
- Chart.js — Canvas 기반이라 데이터 포인트 1000개 이상에서 SVG보다 빠르다. React에서는 imperative wrapper로 쓴다.
- Apache ECharts — 번들이 약 250 KB이고 option object로 차트를 정의한다.
- Visx — D3 기반 저수준 컴포넌트라 차트를 수동으로 조립해야 한다.
- Nivo — 패키지별 번들이 약 150 KB 이상이고 자체 디자인을 갖는다.

### 1.5 shadcn/ui Chart 통합

shadcn/ui v0.8+에서 Recharts wrapper `<ChartContainer>`·`<ChartTooltip>` 제공. CLI로 추가 가능.

```bash
pnpm dlx shadcn@latest add chart
```

CLI는 `src/components/ui/chart.tsx` 코드를 복사하고 Recharts를 dependency로 추가한다.

---

## 2. 후보 세부 정보

### 2.1 Recharts 2.x
- **장점**: React 컴포넌트형, TS 1급, 마인드셰어, shadcn/ui chart 통합, SVG로 단순 차트에 적합
- **단점**: 1000+ 데이터 포인트에서 SVG 성능 한계
- **세부사항**: MIT. `recharts@^2`

### 2.2 Chart.js + react-chartjs-2
- **장점**: Canvas로 대량 데이터 빠름·플러그인 풍부
- **단점**: imperative wrapper·디자인 자유도 React 컴포넌트형 대비 낮음
- **세부사항**: MIT

---

## 3. 비교 요약 표

| 후보 | 특징 |
|------|------|
| Recharts 2.x | React 컴포넌트형·SVG·shadcn/ui chart 기반 |
| Chart.js | Canvas·대량 데이터에 빠름·imperative wrapper |
| Apache ECharts | 번들 ~250 KB·option object |
| Visx | D3 기반·수동 조립 |
| Nivo | 번들 ~150 KB+·자체 디자인 |
