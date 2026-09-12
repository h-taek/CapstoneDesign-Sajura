# Phase 11 대시보드·알림 — FE

> 상위: [../plan_gantt.md](../plan_gantt.md) §2 Phase 11 / §4 `dash`
> Day: 42~49 (선행: `ord_be_skeleton`)

## 마일스톤

| ID | 마일스톤 | 산출물 | 검증 |
|---|---|---|---|
| M11.F1 | 매출 대시보드 화면 | `routes/dashboard/sales.tsx` (Recharts 매출 추이·메뉴별·시간대별) | 차트 3종 렌더 |
| M11.F2 | 예측 대시보드 화면 | `routes/dashboard/forecast.tsx` (예측 정확도 placeholder — 지표 종류는 M12 hookup) | placeholder UI 정합 |
| M11.F3 | Web Push 구독 UI | 설정 화면 — VAPID 공개 키 inline + `POST /api/notifications/subscribe` | 구독 → 1회 푸시 수신 |
| M11.F4 | 인앱 알림 UI 통합 | 알림 배지 + 알림 목록(M9.F5와 통합) + 읽음 처리 | 시나리오 통과 |

## 외부 의존

- BE: `dash` 완료 (M11.B1~M11.B4)
- **AI 팀 결정 대기 (Phase 12 hookup)**: 예측 정확도 지표 종류·단위 → M12 reflected
- **ROI 대시보드는 `[2단계]`** — MVP 범위 밖

## 디자인 사전 합의 권장

- 예측 정확도 차트(M11.F2)는 AI 팀 지표(MAPE/RMSE/MAE) 확정 전 단위·축 디자인 고정 시 M12.F3에서 갈아엎는 비용 발생
- placeholder UI만 잡아두고 실 단위·축 디자인은 hookup 시 확정

## 참조

- [10_frontend_design.md §5 대시보드·알림](../../spec/10_frontend_design.md)
- [PROGRESS.md §3 2026-05-16 18차 A-1 폴링 5분 고정](../../../PROGRESS.md)

## Phase 통합 종료 조건 (M11)

`dash` 완료 → **데모 시나리오 Step 8 동작** (대시보드·알림)
