# Phase 6 AI 모델 개발 — AI

> 상위: [../04_gantt.md](../04_gantt.md) §2 Phase 6 / §4 `ai_data`·`ai_model`
> Day: 7~25 (Plan 직후 BE/FE와 병렬 출발)
> 선행: `plan`

## 작업 방향 (30차 결정)

**데이터 우선 → EDA → 피처 관계 → 모델 선정** 순으로 진행한다. 모델 결정은 EDA·피처 분석 결과에 근거해 후행 결정한다. baseline 비교 후보(이동평균·ARIMA·Prophet·XGBoost·LightGBM·LSTM·TimExer)는 `11_ai_spec.md` §2의 비교 대상으로 유지하되, 어떤 모델을 초기 채택할지는 EDA·피처 결과로 좁힌다.

## 마일스톤

| ID | 마일스톤 | 산출물 | 검증 |
|---|---|---|---|
| M6.A1 | **데이터 수집** — 30차 확정 외부 소스 적재 | 기상청 단기예보·과거 기상·공휴일·홍익대 학사일정·세담터 유동인구·소상공인 상가정보 수집 스크립트 (또는 n8n HTTP 노드 prototype). DB 임시 적재 또는 CSV/parquet 산출 | 6종 데이터 1주일 분 적재 통과, 스키마·기간 일치 |
| M6.A2 | **EDA — 분포·결측·이상치 파악** | Jupyter notebook (또는 marimo) — 컬럼별 분포(histogram·boxplot)·결측 비율·이상치 후보 시각화. `00_ml_guide_reference` PART 1 활용 | EDA 보고서 1회분, 모든 입력 변수에 대한 분포·결측 정량 |
| M6.A3 | **피처 엔지니어링 + 피처 관계 분석** | 시간 lag·rolling·요일·is_semester·is_exam_week 등 파생 피처. 상관(Pearson/Spearman)·VIF·tree-based 피처 중요도(`gain`/permutation). `00_ml_guide_reference` PART 2 활용 | 피처 후보 30~50개 → 1차 선별 결과, 다중공선성 점검 |
| M6.A4 | **결측·이상치 처리 규칙 확정** | 컬럼별 보간 방식(forward-fill / 선형 보간 / 시간대 평균)·IQR 임계 계수(k) — `11_ai_spec.md` §6의 "별도 확정 예정" 부분을 본 마일스톤에서 채움 | 처리 규칙 문서화 + spec 본 단계에서 spec 갱신 |
| M6.A5 | **베이스라인 비교 학습** | 이동평균·ARIMA/Prophet·XGBoost/LightGBM·(여력 시 LSTM·TimExer)을 Walk-forward CV로 비교. EDA·피처 분석 결과 기반으로 후보 좁히기. AutoGluon-TimeSeries 보조 활용 가능 | 모델별 평가 지표(MAE·RMSE·MAPE·sMAPE) 표 |
| M6.A6 | **초기 모델 선정 + 평가 지표 확정** | 가장 균형 잡힌 모델 1개 + 보조 baseline 1개 채택. `11_ai_spec.md` §3에 라이브러리 명시. 평가 지표 산식 확정(MAPE/RMSE/MAE 중) — `11_ai_spec.md` §3 + `04_feature_spec.md` §5.2 ROI 갱신 | 선정 사유 + 평가 결과 보고서 |
| M6.A7 | **XAI 모듈** | TreeSHAP (`shap.TreeExplainer`) 통합 — top-3 기여 피처 + 자연어 변환 여부 결정. `11_ai_spec.md` §9 확정값 활용 | SHAP 결과 시각화 + 자연어 변환 prototype |
| M6.A8 | **신뢰도 경고 기준 산정** | 예측 정확도·학습 데이터 기간·결측 비율 기반 신뢰도 점수 산식 + 임계값 — `04_feature_spec.md` §5.3 "별도 확정 예정" 부분 갱신 | 임계값 산정 보고서 + spec 갱신 |
| M6.A9 | **DNN 도입 여부 결정** | AutoGluon 베이스라인 probe 후 LightGBM ↔ DNN 전환 기준 평가 — DNN 도입하면 Phase 7 AI Server 의존성 확장 | 결정 보고서 (적용/보류) |

## 외부 의존

- M2.A2 (ML 라이브러리 설치) 완료
- 03 외부 데이터 소스 신청·자격증명 발급 (data.go.kr ServiceKey, 세담터 회원가입 — Day 7 이전 사전 진행 권장)
- POS 보유 데이터(30일+) 접근 가능

## 핵심 spec 갱신 책임 (본 Phase에서 spec 본문에 박힘)

| spec 위치 | 본 Phase에서 채워질 내용 |
|---|---|
| `11_ai_spec.md` §3 초기 모델 | 베이스라인 비교 후 선정된 모델 (M6.A6) |
| `11_ai_spec.md` §9 출력 형태 | top-3 기여 피처 + 자연어 변환 여부 (M6.A7) |
| `11_ai_spec.md` §6 전처리 | 결측 보간 컬럼별 전략·IQR 임계 계수 (M6.A4) |
| `04_feature_spec.md` §5.3 신뢰도 | 정량 임계값 (M6.A8) |
| `04_feature_spec.md` §5.2 ROI 평가 지표 | 평가 지표 선정·산식 (M6.A6) |

## Phase 통합 종료 조건 (M6)

- 초기 모델 선정 완료 + `11_ai_spec.md` / `11_ai_spec.md` spec 갱신 완료
- XAI 모듈 prototype 동작 확인
- 신뢰도 경고 기준 확정

## 참조

- [docs/research/ai/00_ml_guide_reference.md](../../research/ai/00_ml_guide_reference.md) — ML 가이드 (PART 1·2·3·4 활용)
- [docs/research/ai/03_external_data_sources.md](../../research/ai/03_external_data_sources.md) — 외부 데이터 소스
- [docs/spec/08_ai/](../../spec/08_ai/) — model_spec, ml_pipeline (본 Phase 산출물의 반영 대상)
