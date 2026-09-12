# Phase 5 메뉴·재고·판매 도메인 — FE

> 상위: [../plan_gantt.md](../plan_gantt.md) §2 Phase 5 / §4 `dom_fe`
> Day: 29~35 (선행: `dom_be` Day 29)

## 마일스톤

| ID | 마일스톤 | 산출물 | 검증 |
|---|---|---|---|
| M5.F1 | 메뉴 화면 | `routes/menu/*` (목록·등록·수정·레시피 편집·소프트삭제) | CRUD 시나리오 통과 |
| M5.F2 | 재고 화면 | `routes/inventory/*` (로트 목록·FIFO 출고·폐기·단가 표시) | 시나리오 5종 통과 |
| M5.F3 | 판매 데이터 화면 | `routes/sales/*` (일별·메뉴별·시간대별 표·간단 차트) | Recharts 정합 |

## 외부 의존

- BE: `dom_be` 완료 (M5.B1 Inventory · M5.B2 Sale) + 메뉴는 phase_03 M3.B7 완료 전제

## 참조

- [10_frontend_design.md §5 화면 구성](../../spec/10_frontend_design.md)

## Phase 통합 종료 조건 (M5)

`dom_fe` 완료 → **데모 시나리오 Step 4 동작** (메뉴·재고·판매 조회)
