# Phase 8 n8n 배치 (골격) — BE

> 상위: [../plan_gantt.md](../plan_gantt.md) §2 Phase 8 / §4 `n8n_data_skeleton`·`n8n_run`
> Day: 30~38 (선행: `ai_api`, `dom_be`)
> **FE 없음 (BE only)**

## 마일스톤

| ID | 마일스톤 | 산출물 | 검증 |
|---|---|---|---|
| M8.B1 | `n8n_data_skeleton` — 외부 API 수집 노드 | 외부 데이터 수집 워크플로우. **확정 소스 목록: `spec/11_ai_spec.md` §4 입력 데이터** | 일일 수집 1회 통과 |
| M8.B2 | `n8n_data_skeleton` — 전처리 더미 노드 | 통과·기본 채움(NULL → 0)만 — 결측 보간·이상치 탐지 로직은 M12.B1 hookup | 입력 데이터 그대로 통과 |
| M8.B3 | `n8n_run` — 야간 예측 배치 | 매일 **02:30** (ARQ 01:30과 분산) → `n8n` → AI Server `/ai/forecast/predict` → `forecast_results` INSERT | 1회 트리거 → 캐시 적재 |
| M8.B4 | `n8n_run` — 주간 재학습 배치 | 매주 일요일 → AI Server `/ai/forecast/train` | 1회 트리거 통과 |
| M8.B5 | `n8n_run` — Slack 알림(운영자 전용)·재시도 | slack_sdk Webhook (운영자 모니터링 채널) + n8n 재시도 3회·exponential — 점주 알림 채널 아님 | 실패 시뮬레이션 → 재시도 + 운영자 Slack 알림 |

## 외부 의존

- **AI 팀**: `ai_api` 완료(Day 30) — AI Server 4종 엔드포인트(`/ai/forecast/predict`·`/recommend`·`/train`·`/health`) 동작 전제
- **AI 팀 결정 대기 (Phase 12 hookup)**: 결측 보간 방법·이상치 탐지 방법

## 참조

- [11_ai_spec.md](../../spec/11_ai_spec.md)
- [PROGRESS.md §3 2026-05-16 n8n vs ARQ 책임 분리](../../../PROGRESS.md)

## Phase 종료 조건 (M8)

`n8n_run` 완료 → **데모 시나리오 Step 5 동작** (n8n 야간 예측 배치, 전처리는 더미 노드)

**데모 시드:** AI Server `/ai/forecast/predict` 응답 더미(`forecast_results` 채워질 정도), 외부 데이터 4종 캐시 1일치
