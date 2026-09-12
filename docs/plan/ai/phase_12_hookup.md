# Phase 12 AI hookup — AI

> 상위: [../04_gantt.md](../04_gantt.md) §2 Phase 12 / §4 `n8n_data_hookup`·`ord_be_hookup`·`ord_fe_hookup` (AI 측 input)
> Day: 33~49 (각 input은 자기 의존 마일스톤 종료 직후 즉시 전달)
> 선행: `ai_model` 완료(Day 25)

## 마일스톤 (AI 팀이 BE/FE에 전달할 input)

| ID | 마일스톤 | 산출물 | 수신 측 |
|---|---|---|---|
| M12.A1 | **예측 근거 형태 확정** → BE 응답 스키마 input | 자연어 카드 / 표 / 그래프 / 수치 중 최종 형태 결정 + `forecast_results` 응답 JSON 스키마 제안 | BE M12.B2 |
| M12.A2 | **신뢰도 임계값 산정** → BE env 값 input | 정량 임계값 (`FORECAST_LOW_CONFIDENCE_THRESHOLD` 값) + 산정 근거 | BE M12.B3 |
| M12.A3 | **n8n 전처리 규칙 확정** → n8n 노드 input | 결측 보간 컬럼별 전략 + IQR 임계 계수 + 이상치 처리 정책 (자동 분리/점주 알림/복구/폐기) | BE M12.B1 |
| M12.A4 | **예측 정확도 지표 산식 확정** → BE 산식 input | MAPE/RMSE/MAE/sMAPE 중 1개 + 산식 정의 + 집계 기간 | BE M12.B4 |
| M12.A5 | **XAI 출력 형태 디자인 합의** → FE UI 디자인 input | TreeSHAP 결과의 자연어/표/그래프 형태 시안 — FE 디자인 검토 1회 | FE M12.F1 (디자인 사전 합의 권장) |
| M12.A6 | hookup 통합 검증 | BE M12.B5 / FE M12.F5 회귀 시나리오에 AI 측 결과 정합성 확인 — 모델 응답·SHAP·신뢰도 산정이 spec 정합 | end-to-end 통과 |

## 외부 의존

- Phase 6 (`ai_model`) 완료 — 4가지 결정 모두 확정 상태
- BE/FE skeleton 단계 종료 (Phase 8·9·11)

## 디자인 사전 합의 권장 (FE에 명시)

- 근거 UI는 **AI 팀과 출력 형태 합의 후 디자인 확정** — 후기 수정 비용 큼 (HANDOFF AI 의존성 ①)
- M12.A5에서 AI ↔ FE 디자인 리뷰 1회 진행

## 참조

- [docs/plan/01_be.md](../be/phase_12_hookup.md) — BE 수신 측 마일스톤 (M12.B1~B5)
- [docs/plan/02_fe.md](../fe/phase_12_hookup.md) — FE 수신 측 마일스톤 (M12.F1~F5)
- [HANDOFF.md AI 의존성 4가지](../../../HANDOFF.md)

## Phase 통합 종료 조건 (M12)

AI 결정 4가지(M12.A1~A4) 모두 BE/FE에 전달 완료 + hookup 후 회귀 검증(M12.A6) 통과
