# Phase 10 쿠팡 자동화 — FE

> 상위: [../plan_gantt.md](../plan_gantt.md) §2 Phase 10 / §4 `auto`
> Day: 42~49 (선행: `ord_be_skeleton`)

## 마일스톤

| ID | 마일스톤 | 산출물 | 검증 |
|---|---|---|---|
| M10.F1 | 자동화 트리거 화면 | `routes/orders/automation.tsx` (승인된 발주 → "자동 주문" 버튼 → BE 트리거) | API 호출 통과 |
| M10.F2 | 자동화 진행 상태 화면 | `automation_logs` 폴링 30초(진행 중일 때만, 완료 시 정지) — 진행 중/성공/실패 표시 + 로그 보기 | 시나리오 3종 (성공·실패·중간 중단) |
| M10.F3 | 자격증명 관리 화면 | `routes/settings/credentials.tsx` (쿠팡 계정 등록·암호화 안내) | 등록·삭제 통과 |

## 외부 의존

- BE: `auto` 완료 (M10.B1~M10.B3)

## 참조

- [10_frontend_design.md §5 자동화 화면](../../spec/10_frontend_design.md)

## Phase 통합 종료 조건 (M10)

`auto` 완료 → **데모 시나리오 Step 9 동작** (쿠팡 자동주문)
