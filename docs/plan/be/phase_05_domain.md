# Phase 5 메뉴·재고·판매 도메인 — BE

> 상위: [../plan_gantt.md](../plan_gantt.md) §2 Phase 5 / §4 `dom_be`
> Day: 21~29 (선행: `auth_test`, FE는 Day 29~35)

## 마일스톤

| ID | 마일스톤 | 산출물 | 검증 |
|---|---|---|---|
| M5.B1 | InventoryService | 로트(`inventory_lots`) + FIFO 출고 + 폐기 + 단가 갱신 | FIFO 시나리오 5종 통과 |
| M5.B2 | SaleService 조회 | 일별·메뉴별·시간대별 집계 | 응답 시간 SLA 통과 |
| M5.B3 | ARQ cron_jobs 등록 (FE 대응 없음 — BE 단독 백그라운드) | 소비기한 일일 점검(매일 **01:30**, n8n 02:30과 분산) + 단가 갱신 | 1회 트리거 → notifications INSERT |

> MenuService는 phase_03 M3.B7로 이동(2026-05-24 plan-eng-review 정정).

## 외부 의존

- 후속: M8.B1 `n8n_data_skeleton` deps에 `dom_be` 포함

## 참조

- [09_service_design.md MenuService·InventoryService·SaleService](../../spec/09_service_design.md)
- [PROGRESS.md §3 2026-05-16 스케줄러 책임 분리 (n8n vs ARQ)](../../../PROGRESS.md)

## Phase 통합 종료 조건 (M5)

`dom_fe` 완료 (Day 35) → **데모 시나리오 Step 4 동작** (메뉴·재고·판매 조회), n8n 통합 가능

**데모 시드:** 재고 로트 더미 데이터(다양한 단가·소비기한), 판매 집계 산출 가능한 분량의 sales 행
