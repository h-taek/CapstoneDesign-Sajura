# 모델 선정 — 비교·실측·기각 이력

> 관찰 결과만 담는다. 확정된 결정은 `docs/spec/11_ai_spec.md` §3·§6을 본다.
> 실험 본체는 `AI/notebooks/` (ai 브랜치).

---

## 1. 베이스라인 비교 (M6.A5 + M6.A9)

사전 계획한 비교 순서는 ① 이동평균 ② ARIMA/Prophet ③ XGBoost/LightGBM ④ LSTM/RNN ⑤ TimExer였다.

실제 비교 대상은 12개 후보 — 나이브 2종·이동평균·SARIMA·XGBoost·LightGBM + 하이브리드 변형·CatBoost (`04_baselines.ipynb`) + DNN 계열 4종 SeasonalNaive·Chronos-bolt·DeepAR·PatchTST (`09_dnn_probe.ipynb`).

4·5단계(LSTM/RNN·TimExer)는 동급 계열이 나이브 이하로 판명되어 별도 실험을 하지 않았다.

**반전**: MA-7이 순정 GBM·SARIMA 전부를 이겼다. 비율 타깃 하이브리드만 역전했다.

## 2. 채택 모델의 실측 (M6.A6)

LightGBM 비율 타깃 하이브리드(V1-t) — 봉인 test sMAPE 30.0%, MA-7 대비 MAE −19.6%.

하이퍼파라미터는 Optuna 60 trials로 확정했고 test를 재개봉하지 않았다 (`05_model_selection.ipynb`).

**39차 그리드 재확인**: XGBoost·CatBoost에 가족별 자기 그리드(90조합)를 줘도 +10~11% 열세가 유지됐다. LightGBM 재탐색은 채택값 대비 −0.2% 동률로, 독립 탐색이 같은 값에 수렴했다(파라미터 요행이 아니다). 근거: `13_grid_search.ipynb`.

## 3. 다일 선행 계단 (38차 고도화)

h별 개별 모델 기준 MA-7 대비 우위: D+1 −10.2% / D+2 −3.0% / D+3 +0.4%. 계단식으로 소멸한다.

예측 구간은 LightGBM quantile P10/P90을 채택했다 — 커버리지 78%. 점 예측은 l2를 유지했고 P50 대체·앙상블은 기각했다. 근거: `06_enhancement.ipynb`.

## 4. 서빙 전략 실험 (38차 후속)

h=1 단일 모델을 h-앵커 피처로 재사용하는 쪽이 h별 개별 모델보다 평균 우위였다 — sMAPE D+2 −1.1%p·D+3 −1.0%p. 서빙 기준 계단은 MA-7 대비 D+1 −10.2% / D+2 −4.1% / D+3 −1.4%.

**멀티 호라이즌 풀링 기각**: 학습 행을 3배로 늘리는 h∈{1,2,3} 풀링 + horizon 피처를 사전 등록 규칙 하에 1회 실험했다. D+1 sMAPE +2.6%p 악화, 개강 fold(2026-03) 붕괴 — 저용량 트리가 호라이즌 혼합 분포를 분리하지 못했다. 유효 표본 확대는 모델링 트릭이 아니라 실데이터 확보로만 가능하다는 결론. 근거: `06_enhancement.ipynb` §6.

## 5. 학습 윈도우 실험 (38차)

rolling 90~180일은 검증에서 +15~17% 열세였다 — regime 구간이 붕괴한다. 과거 데이터를 버리면 표본 부족이 더 아프다. expanding window 채택. 재검토 조건은 데이터 2년 이상 축적 또는 MA-7 대비 skill 지속 하락. 근거: `06_enhancement.ipynb` §3.

## 6. 외부 검증 — Kaggle Recruit (38차 후속)

V1-t 레시피를 서빙과 동일 구성(고정 파라미터·60라운드·h=1 단일 모델)으로 일본 음식점 814곳에 동결 이식했다. 데이터는 대회 규칙 동의 후 로컬 배치(gitignore).

사전 등록 기준(과반 승 + 상대 MAE 중앙값 ≤ −3%) 충족:

| 지표 | 결과 |
|---|---|
| 승률 | 92.6% |
| 상대 MAE 중앙값 | −10.1% (파일럿 매장 −10.2%와 일치) |
| 주점(Izakaya) 서브셋 | 95.9% · −11.0% |
| h=1 전략 D+3 | −10.4% (우위 유지) |

**SHORT_HISTORY 60일 임계 실증**: 이력 60일 미만 승률 59.1%·−1.4% → 60일 이상 79~89%·−9~−13%. 경계에서 불연속이다.

**B단계 (같은 데이터, 사전 선언 기준)**

- 전 매장 통합 학습(pooling)은 기존 매장에서 매장별 학습 대비 승률 53.9%로 기준(55%) 미달 → 기각. 매장별 fit-on-request 유지(stateless 서빙 설계를 지지).
- cold-start는 기준 충족 — 이력 10~59일 구간에서 글로벌 모델 승률 72~79%·중앙값 −6~−7%(로컬 59.1%·−1.4%). 다매장 확장 시 "신규 매장 첫 60일 global prior → 로컬 전환" 하이브리드의 실증 근거다. 현 단일 매장 MVP에는 미적용.

근거: `10_recruit_validation.ipynb`.

## 7. DNN 보류 (38차 M6.A9 + 39차 재검증)

AutoGluon-TS 실전 probe(동일 하네스 1-step): 최고 DNN 계열 Chronos-bolt(zero-shot)가 V1-t 대비 +8.9%로 사전 기준(−5%) 미달. 학습형 DeepAR·PatchTST는 계절 나이브 이하. 근거: `09_dnn_probe.ipynb`.

재평가 트리거 4개 중 ④(Chronos 계열 fine-tuning·covariates 지원 릴리스)는 39차에 소진했다 — Chronos-2(2025-10)로 재검증한 결과 covariates 효과는 실재했으나(univariate 대비 개선, bolt식 regime 붕괴 해소) V1-t 대비 +13.9%로 기준 미달. 동반 검증한 TabPFN v2(Nature 2025, 소표본 특화)도 +29.0%(개강 fold 붕괴)로 기각. 실험 전량 MLflow 대장 기록(로컬). 근거: `12_mlflow_model_comparison.ipynb`.

잔여 트리거: ① 데이터 2년 이상 축적 ② 다매장 확장 ③ V1-t의 MA-7 대비 skill 지속 상실(drift).

## 8. 모델 ② 메뉴 비중 분해 (39차 M7.A3)

후보 4개를 사전 고정 평가했다. 요일 조건부·혼합은 검증 5 fold 전패 — 요일이 바꾸는 것은 총량이지 메뉴 믹스가 아니다.

채택: 최근 28영업일 합산 수량 비중(S1). 비중 총변동거리 0.276 · top-5 메뉴 적중 73.1% · 신메뉴(이력 전무) 질량 평균 1%.

근거: `11_menu_decomposition.ipynb`.

## 9. 피처 선별

MVP 확정 피처는 20열(keep)이다. 강수·유동인구 등은 데이터 근거로 1차 제외했다 — 유동인구는 월간 대체 데이터의 한계 때문이고, 세담터 일별 데이터 확보 시 재평가한다.

산출: `AI/data_prep/features_build.py`, 선별 근거: `02_features.ipynb` §7.

## 10. 예측 근거 산출 실험 (M6.A7)

LightGBM `gain`으로 1차 스크리닝한 뒤 TreeSHAP(`shap.TreeExplainer`)을 채택했다.

편차 모델의 SHAP 합이 곧 예측 편차라 자연어 문장과 수학이 일치한다. 자연어 변환에 LLM을 쓰지 않고 템플릿으로 처리했다(결정론·무비용).

공휴일 등 특수일은 학습 표본이 적어 설명 신뢰가 낮다는 것을 실측했다. 근거·prototype: `07_xai.ipynb`.
