# Phase 13 통합 검증·배포 — AI

> 상위: [../04_gantt.md](../04_gantt.md) §2 Phase 13 / §4 `test_release` (AI 측)
> Day: 49~58 (선행: `auto`, `dash`, `ord_fe_hookup`, `n8n_data_hookup`)

## 마일스톤

| ID | 마일스톤 | 산출물 | 검증 |
|---|---|---|---|
| M13.A1 | 데모 시나리오 AI 측 검증 | Step 1~9(`03_mvp_scope.md` §데모 시나리오)에서 AI Server 응답·n8n 배치·예측 근거 표시가 정상 동작 | end-to-end Step 6(수요예측)·Step 7(추천발주) 통과 |
| M13.A2 | AI Server 성능 검증 | `/ai/forecast/predict` 응답 시간·`/ai/forecast/train` 학습 시간·메모리 사용량 측정 + `13_performance.md` 정합 | 성능 기준 통과 |
| M13.A3 | AI Server 보안 검증 | API 토큰·내부 네트워크 격리(`12_security.md`) + 외부 데이터 수집 자격증명 안전 보관 | 보안 검증 통과 |
| M13.A4 | AI Server CI/CD 배포 | GitHub Actions 워크플로우 (`AI` 디렉터리) + Docker 이미지 빌드·push + 배포 스크립트 | 배포 자동화 통과 |
| M13.A5 | 모니터링 셋업 | Sentry·`pipeline_jobs` 테이블·Slack 알림 — `11_ai_spec.md` §10 정합 | 실패 시뮬레이션 통과 |

## 외부 의존

- BE/FE 모든 Phase 종료
- Phase 12 hookup 완료 (AI 결정 4가지 모두 반영됨)

## 참조

- [docs/spec/03_mvp_scope.md §데모 시나리오](../../spec/03_mvp_scope.md)
- [docs/spec/13_performance.md](../../spec/13_performance.md)
- [docs/spec/12_security.md](../../spec/12_security.md)

## Phase 통합 종료 조건 (M13)

데모 시나리오 전 단계 AI 측 통과 + AI Server 배포 자동화 통과 + 모니터링 정상 작동
