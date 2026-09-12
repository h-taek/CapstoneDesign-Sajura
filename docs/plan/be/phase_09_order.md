# Phase 9 예측·발주 UI (골격) — BE

> 상위: [../plan_gantt.md](../plan_gantt.md) §2 Phase 9 / §4 `ord_be_skeleton`
> Day: 38~42 (선행: `n8n_run`)

## 마일스톤

| ID | 마일스톤 | 산출물 | 검증 |
|---|---|---|---|
| M9.B1 | ForecastService — 예측 수량 응답 | `GET /api/forecast/demand` → `forecast_results` 캐시 조회 | 응답 시간 SLA 통과 |
| M9.B2 | ForecastService — 근거 필드 placeholder | 응답 JSON에 `explanation: null` 또는 빈 객체 — 형태는 M12.B2 hookup | 스키마 검증 통과 |
| M9.B3 | ForecastService — 신뢰도 임계값 env 자리 | `FORECAST_LOW_CONFIDENCE_THRESHOLD` env 정의(값 비움) + `is_low_confidence` 분기 코드 | env 미설정 시 기본 fallback |
| M9.B4 | OrderService | 추천 조회·수정·승인 (`GET/PUT/POST /api/orders/recommend`) | 시나리오 3종 통과 |

## 외부 의존

- **AI 팀 결정 대기 (Phase 12 hookup)**: 예측 근거 응답 필드 형태, 신뢰도 임계값 값
- 후속: M10·M11·M12·M9.F1 모두 `ord_be_skeleton` 완료(Day 42) 후 시작

## 참조

- [07_api_spec.md §6 forecast / §7 orders](../../spec/07_api_spec.md)
- [HANDOFF.md AI 의존성 ①·④](../../../HANDOFF.md)

## Phase 통합 종료 조건 (M9)

`ord_fe_skeleton` 완료 (Day 46) — 예측 수량·발주 화면 동작 (근거·임계값 placeholder) → **데모 시나리오 Step 6·7 동작** (수요예측 + 추천발주)

**데모 시드:** 추천발주 시나리오용 메뉴 3종+예측 수량 더미, 더미 `is_low_confidence=true` 응답 1건(배지 시연용)
