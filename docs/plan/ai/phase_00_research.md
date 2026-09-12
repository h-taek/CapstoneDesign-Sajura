# Phase 0 Research — AI

> 상위: [../04_gantt.md](../04_gantt.md) §2 Phase 0 / §4 `res_ai`
> Day: 0~4

## 마일스톤

| ID | 마일스톤 | 상태 |
|---|---|---|
| M0.A1 | AI 모델·라이브러리·외부 데이터 조사 완료 | ✅ 완료 (PROGRESS.md §5 21~24차, 30차) |

## 산출물

- `docs/research/ai/00_ml_guide_reference.md` — 캡스톤 ML 통합 가이드 (PART 0~5 + 부록)
- `docs/research/ai/03_external_data_sources.md` — 외부 데이터 소스 조사 (세종 조치원 홍익대 상권 기준)
- 정책 결정: Regression 방식 + Walk-forward CV + IQR 우선/Z-score 보조 + TreeSHAP (22차) — `docs/spec/11_ai_spec.md` §3·§7·§9
- MVP 외부 데이터 확정 (30차): 기상청·과거 기상·공휴일·홍익대 학사일정 [필수]; 세담터·소상공인 상가정보 [권장]; 배달상권 [선택]; SK 지오비전·ECOS·네이버 [2단계] — `docs/spec/11_ai_spec.md` §4

## 외부 의존

- 없음 (선행 작업 없음, 본 Phase는 Phase 1 Plan의 선행)

## 참조

- [docs/research/ai/](../../research/ai/) — research 산출물
- [PROGRESS.md §3 정책 결정 이력](../../../PROGRESS.md) — AI 영역 결정 행
