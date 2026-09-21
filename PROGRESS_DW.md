# 진행 이력 — 정동욱 (DY)

> 담당: AI 모델링 — 모델 선정·전처리·서빙·AI spec
> 프로젝트 공통 단계·정책 결정은 [PROGRESS.md](PROGRESS.md)를 본다.
> 최신이 위로 온다(역시간순).

---

## 1. 개발 이력

기록된 항목이 없다.


---

## 2. 문서 수정 이력

### 2026-07-29 (39차) — M7.A3 recommend 재정의: 모델 ② 메뉴 비중 분해 확정 + 계약 v2 구현

담당자 정정으로 산출 구조 재확립 — "공통 분해 모델 없음"은 **매장 간 통일 모델을 두지 않는다**는 뜻이며 **매장별 메뉴 분해(모델 ②)는 유지**. 이에 따라 ① 모델 ② v1 검증(`11_menu_decomposition.ipynb`, ai 브랜치): 후보 4개 사전 고정 평가에서 **최근 28영업일 합산 비중(S1) 채택** — TV 0.276·top-5 적중 73.1%, 요일 조건부는 5 fold 전패(요일은 총량의 문제 — 모델 ①의 몫). ② recommend **계약 v2(A안: 단일 호출)** 구현(ai `491f82b`): 서버 내부 ①(V1-t)×②(비중 분해)→점주 레시피 BOM 전개→재고·리드타임·안전재고 발주 참고치, 신뢰도 배지 전파. 구 forecast_results 입력 폐기. 테스트 13종 통과. 문서: `07_api_spec.md` §8 recommend v2(PR #20 동승), `11_ai_spec.md` §3 "모델 ② 확정"·§4 산출 구조·말미 미확정 목록 갱신, §3 정책 표 행 추가(본 PR). 잔여: 제품 spec "메뉴별 수요·추천발주" 표현 정리(참고치 성격 명시 — 담당자 검토).

**후속(같은 날) — 최신 모델 재비교 + MLflow 도입**: DNN 재평가 트리거 ④(Chronos covariates 릴리스) 발동 확인 → Chronos-2(2025-10)·TabPFN v2(Nature 2025)를 사전 등록 기준(M6.A9 동일: V1-t 대비 MAE −5% 개선 시 격상)으로 검증(`12_mlflow_model_comparison.ipynb`, ai 브랜치). **둘 다 기각** — Chronos-2+covariates +13.9%(covariates 효과 자체는 실재·bolt식 붕괴 해소), TabPFN v2 +29.0%(평시 fold 경쟁력이나 개강 fold 붕괴 — 문제의 난점은 표본 수가 아닌 비정상성임을 재확인) → **V1-t 유지, 트리거 ④ 소진**(model_spec §3 주석). 실험 관리 도구로 **MLflow 도입**(sqlite 백엔드, `AI/mlruns/` gitignore 로컬 전용 — 지표는 sMAPE·상대값만, Registry 등록은 기록용·서빙은 stateless 유지). **이어서 GBM 3사 그리드 서치**(가족별 자기 그리드 90조합 × 5 fold, `13_grid_search.ipynb`): XGB +10.2%·CatBoost +11.0%로 자기 튜닝 후에도 열세(라이브러리 격차 실재), LGBM 재탐색 −0.2% 동률(Optuna 채택값과 독립 수렴 — 파라미터 요행·과적합 가설 종결, 채택값 유지).

### 2026-07-28 (39차) — 화면 spec ↔ 라우팅 설계 정합 (디자인 핸드오프 준비)

와이어프레임 외주/디자인 핸드오프 준비 중 `04_feature_spec.md` §12(화면별 UI 구성)와 `10_frontend_design.md` §3(라우팅)·`05_user_flow.md` 간 불일치 3건 발견 → §12를 이미 확정된 정책(§1.2 이메일 로그인, 33차 검증 게이트·관리자 심사) 기준으로 정합. ① **§12.1 로그인/회원가입**: 이메일 로그인 필드 + `/register` 회원가입 화면 구성 추가(기존엔 소셜 버튼만 있어 §1.2·M3.B1 구현과 불일치) ② **§12.2 Step 1**: `/verify-business` 분리 게이트임을 명시 + 등록증 업로드 영역·PENDING 안내·반려 사유 표시 UI 추가(33차 정책 반영 누락분) ③ **§12.11 관리자 심사 신설**: `/admin` 심사 큐·등록증 뷰어·승인/반려 UI 구성(33차 "심사 큐 1화면" 화면 spec 부재 해소) ④ `05_user_flow.md` §9 IA에 회원가입·검증 게이트 주석·`/admin` 추가. **미확정(담당자 검토)**: 온보딩 진행 표시를 4단계 유지(현행, Step 1=검증 게이트로 노출)할지 검증 분리 후 3단계로 갤지 — 현행 유지로 기술함. ⑤ 디자이너 전달용 파생본 `docs/디자인_핸드오프.md` 추가 — 흐름·IA·화면별 구성 Mermaid 시각화, SSOT 아님(원본: user_flow·feature_spec §12·frontend_design §3), 원본 변경 시 함께 갱신.

### 2026-07-28 (38차 후속) — 멀티 호라이즌 풀링 실험 기각 + 다일 서빙 전략 확정 반영

배경: 담당자 확인으로 파일럿 5~7월 신규 매출분 부재 → 학습 표본 확대(영업일 ~250일)의 모델링 대안으로 **멀티 호라이즌 풀링(h∈{1,2,3} 학습 행 3배 + horizon 피처)** 을 사전 등록 규칙 하에 검증 fold 5개에서 1회 실험 — **기각**(D+1 sMAPE +2.6%p 악화, 개강 fold 2026-03 붕괴). 부수 진단으로 서빙(M7.A2)의 **h=1 단일 모델 재사용 전략이 h별 개별 모델보다 우위**임을 실측(서빙 기준 계단 MA-7 대비 D+1 -10.2/D+2 -4.1/D+3 -1.4%) → `predictor.py` 무변경 확정. 문서 작업: ① `11_ai_spec.md` §3에 "다일 서빙 전략 확정" 항목 추가(§1 계단은 h별 모델 기준임을 병기) ② §7 "학습 데이터 사용 방식 별도 확정 예정" 잔재를 expanding 확정(`11_ai_spec.md` §6 참조)으로 치환 ③ §3 정책 표 "AI 학습 데이터 확대 방향(38차 후속)" 행 추가(공공데이터 조사 결과 포함 — 행정동 집계류 부적합, KADX는 이후 접근 불가 확정). 실험 본체는 ai 브랜치 `06_enhancement.ipynb` §6(출력 제거 커밋).

**후속(같은 날) — 외부 검증 완료 (Kaggle Recruit 레시피 이식)**: 단일 매장 검증 한계 보완을 위해 V1-t 레시피를 서빙 동일 구성으로 Kaggle Recruit 일본 음식점 814곳에 동결 이식(`10_recruit_validation.ipynb`, ai 브랜치 — 데이터는 대회 규칙 동의 후 로컬 배치, gitignore). 사전 등록 기준(D+1 과반 승 + 상대 MAE 중앙값 ≤ −3%) **충족**: 승률 92.6%·중앙값 −10.1%(파일럿 −10.2%와 일치), Izakaya 95.9%, h=1 서빙 전략 D+3까지 유지, SHORT_HISTORY 60일 임계 실증(경계 불연속 59%→79%). `11_ai_spec.md` §3에 "외부 검증 통과" 항목 추가. **B단계도 완료(담당자 승인, 사전 선언 기준)**: ① pooling(기존 매장) 기각 — 글로벌 vs 매장별 승률 53.9%<55%, 매장별 fit-on-request 유지(stateless 서빙 설계 지지) ② cold-start 기준 충족 — 이력 10~59일 구간 글로벌 승률 72~79%·중앙값 −6~−7%(로컬 59.1%·−1.4%) → 다매장 확장 시 "신규 매장 첫 60일 global prior → 로컬 전환" 하이브리드 실증 근거(Chronos zero-shot의 GBM 대안, Phase 8+ 활성화·현 MVP 미적용). model_spec §3 외부 검증·DNN cold-start 메모 갱신.

### 2026-07-27 (38차) — AI M6.A2~A4 완료(ai 브랜치) + ml_pipeline §6 전처리 규칙 확정 반영

본 회차 문서 작업: ① `11_ai_spec.md` §5의 "별도 확정 예정" 2건(이상치 임계값·결측 보간)을 M6.A4 확정 규칙으로 치환 + 검증 분할(월 단위 walk-forward) 명문화 + 말미 미확정 목록 정리. ② §3 정책 표에 "AI 전처리 규칙 확정(38차)" 행 추가, "AI 미확정 항목" 행에서 확정분 제거. 모델링 산출물 본체는 ai 브랜치 M6.A2~A4 커밋(노트북 01~03 + `features_build.py`·`preprocess.py` — 공개 저장소 정책에 따라 실행 출력·매출 절대액 제외, 히스토리 재작성으로 커밋 SHA 변경됨)에 있으며 정책대로 Phase 6 마무리에 ai → main PR로 합류. EDA 핵심 발견(장기 휴업 후 낙곱새 업종 개편 = regime 변화)과 검수 대기 항목은 `AI/data/README.md` 참조.

**후속(같은 날) — M6.A5·A6 완료 + model_spec 갱신**: 베이스라인 12개 후보 비교(`04_baselines.ipynb` — MA-7이 순정 GBM·SARIMA 전부를 이기는 반전 후 비율 타깃 하이브리드가 역전) → 초기 모델 **LightGBM 비율 타깃 하이브리드(V1-t)** + 보조 MA-7 확정(`05_model_selection.ipynb`, Optuna 60 trials·test 재개봉 없음). `11_ai_spec.md` §3(비교 완료)·§3(초기 모델·라이브러리·1차 타깃=매장 일 매출)·§5(확정 피처 20열 참조)·§7(월 단위 walk-forward 구체화 + 평가 지표 MAE+sMAPE 확정·MAPE 제외)·말미 미확정 목록 갱신. §3 정책 표에 "AI 초기 모델 확정(38차)" 행 추가. plan의 "feature_spec §5.2 ROI 갱신" 참조는 현행 문서와 불일치(§5.2=예측 결과 조회, ROI=§8.2 [2단계])로 갱신 불요 판정. 담당자 확정(같은 날, 2차 조정): **AI 책임 = 매출 예측 + 고도화** — 메뉴 분해는 매장별 상이로 공통 모델 없음, 재료 리스트업은 점주 관리. §3 표·model_spec §3·§4 반영, 제품 spec 표현 정리는 담당자 검토로 이관. 남은 확인: 검수 3건.

**고도화(같은 날, `06_enhancement.ipynb`)**: ① 다일 선행 계단 실측 — D+1 -10.2%/D+2 -3.0%/D+3 +0.4%(vs MA-7) → 선행일별 신뢰도 차등 필수 ② P10/P90 예측 구간 채택(커버리지 78%) ③ 학습 윈도우 expanding 확정(rolling +15~17% 열세) — `11_ai_spec.md` §6 미확정 해소 ④ 앙상블·P50 대체 기각. model_spec §3에 다일·구간 반영.

**M6.A7 XAI(같은 날, `07_xai.ipynb`)**: TreeSHAP 통합 — 출력 형태 확정(top-3 요인 % + rule-based 자연어 1문장, LLM 미사용, JSON 스키마 포함) → model_spec §9 "probe 후 결정" 해소. 한계 실측(공휴일 특수 — 삼일절 오예측)으로 신뢰도 배지 동반 노출 원칙 명문화. 다음: M6.A8 신뢰도 기준(feature_spec §5.3).

**M6.A8 신뢰도 기준(2026-07-28, `08_confidence.ipynb`)**: 트리거 6종 확정 — SHORT_HISTORY(<60일)·MISSING_FEATURES·SPECIAL_DAY(공휴일)·LONG_HORIZON(D+3↑)·WIDE_INTERVAL(폭>θ=train P80)·DRIFT(운영). 실증: 폭→오차 Spearman 0.31·단조, 배지율 18%·lift 1.85×·삼일절 포착 → feature_spec §5.3 "probe 후 확정" 해소(본 PR). 잔여: M6.A9.

**M6.A9 DNN probe(2026-07-28, `09_dnn_probe.ipynb` — 별도 sajura-ag env)**: AutoGluon-TS 1.5 실측, 동일 하네스 1-step rolling — Chronos-bolt(zero-shot) V1-t 대비 +8.9%(regime fold +44% 붕괴가 결정적), DeepAR·PatchTST는 나이브 이하 → **DNN 도입 보류 확정**(model_spec §2·§3 반영, 본 PR). Chronos는 신규 매장 cold-start 후보 메모. **→ Phase 6 모델링 마일스톤(M6.A1~A9) 전체 완료 — ai → main 머지 PR로 이관.**

**Phase 7 착수(2026-07-28, ai 브랜치)**: M7.A1 API 골격(`d4ab309` — api_spec §8 계약 5종 스키마+라우터, 미구현 501, plan의 /ai/xai 경로는 spec 부재로 기록) + **M7.A2 `/ai/forecast/predict` 구현**(`1c427eb` — V1-t stateless 서빙: 요청 이력 학습→다일 예측+P10/P90+pred_contrib 근거+신뢰도 트리거, 런타임 deps 승격 pandas·numpy·lightgbm·holidays, 합성 데이터 테스트 9종·E2E 340ms). **api_spec §8 predict 계약 v2**(매출 중심 재설계 — 본 PR): 메뉴별 필드 제거 근거는 38차 범위 재확정. M7.A3 recommend 재설계 결정 대기.

### 2026-07-27 (37차) — Phase 6 M6.A1 데이터 수집 착수 (ai 브랜치) + 수집 경로 결정

Phase 6 첫 마일스톤 M6.A1 착수. 입력 데이터 전 소스를 당일 기준 전수 검증(웹 페이지 유효성 + 로컬 보유분 실측)하고 적재 파이프라인 구축.

- **ai 브랜치 구현**(`a5dde81`): `AI/data_prep/` 적재 스크립트 3종(weather_load·holidays_gen·sales_decrypt) + `AI/pyproject.toml` `[ml]` extra(런타임 이미지 미포함) + `AI/data/README.md` 카탈로그 + `.gitignore` AI 데이터 제외
- **적재 실측**: 기상 4관측소 9,352행(2020-01-01~2026-05-27, 조치원 최근접=세종연서 611, 결측일 1) / 공휴일 133건(holidays 0.101 + 2025-10-10 임시공휴일 수동 보정 — 검수 필요)
- **소스 검증**: 기상청 단기예보·KASI 특일·상가정보(2026-04-27판, 차기 8/1)·배달상권 페이지 유효 / 세담터 정상 운영(2025-12 개편) 단 TLS 체인 이슈 / 홍익대 구 세종캠 학사일정 URL은 통합 사이트로 리다이렉트·JS 동적이라 단순 파싱 불가 → 수동 정리 CSV로 전환
- **결정**(§3 행 신설): 모델링 학습용 수집은 오프라인 우선(다운로드 CSV·패키지 생성·수동 정리), API는 운영 배치 전용
- **M6.A1 완료(동일 회차 후속)**: ① 매출리포트 3개 복호화 → canonical 변환 — **판매 2025-04-03~2026-04-16**(영업일 258, 메뉴-일 3,471행, 고유 메뉴 137). ⚠️ 2025-12~2026-02 장기 휴업 구간 발견(매장 확인 필요) ② 학사일정 2020~2026 초안 60행(겹침 구간 confirmed·시험주간 추정) ③ **유동인구: 세담터 미확보 → 세종시 월간 생활·유동인구 리포트 대체**(조치원읍 10개월, 학기 효과 뚜렷 3월 351K↔1월 227K, 누락 7개월) ④ 커버리지: 기상·공휴일·학사일정 전체 커버 → **M6.A2 EDA 진입 가능**. ai 브랜치 3커밋(`a5dde81`·`b5924ad`·`73e0d8f`)
- **대기**: 상가정보 8월 갱신판 다운로드(비차단) / 학사일정·휴업 사유·유동인구 누락 월 검수(`AI/data/README.md` 검수 항목)
- 문서: `research/ai/03` 상태 갱신(홍익대 URL·세담터 개편·날씨 확보·유동인구 대체) + `11_ai_spec.md` §4 유동인구 정정 + `11_ai_spec.md` §4 + 본 §3·§5

### 2026-05-28 (31차) — docs/plan/ai/ 신설 + plan_gantt §6 AI 트랙 색인 정렬

AI 트랙 plan 폴더가 부재했던 점을 30차 후속으로 보강. `be/`·`fe/`와 동일 형식의 6개 phase 파일 작성 + `04_gantt.md` §6 색인 표에 "AI 파일" 열 신설.

**작성 방향 (사용자 지정)**: Phase 6 마일스톤은 **"데이터 수집 → EDA → 피처 관계 분석 → 모델 선정"** 순으로 분해. 모델 결정을 EDA·피처 분석 뒤로 명시적 후행화 — 30차 정합으로 모델 선정이 미확정인 상태에서 데이터·EDA 결과로 후보를 좁히는 흐름.

**신설 파일 (6)**

- `docs/plan/ai/phase_00_research.md` — M0.A1
- `docs/plan/ai/phase_02_infra.md` — M2.A1~A4 (AI Server 베이스·ML lib·Docker·env)
- `docs/plan/ai/phase_06_model.md` — M6.A1~A9 (데이터·EDA·피처·결측/이상치·모델비교·선정·XAI·신뢰도·DNN)
- `docs/plan/ai/phase_07_api.md` — M7.A1~A7 (REST API: forecast·recommend·xai·train·health)
- `docs/plan/ai/phase_12_hookup.md` — M12.A1~A6 (예측 근거 형태·임계값·n8n 규칙·평가 지표·XAI UI·회귀 검증)
- `docs/plan/ai/phase_13_release.md` — M13.A1~A5 (데모·성능·보안·CI/CD·모니터링)

**변경 (1)**

- `docs/plan/04_gantt.md` §6 — Phase 색인 표 "AI 파일" 열 신설, Phase 6·7·12·13의 "AI 팀 영역, 본인 작업 아님" 빈 칸 채움. 마일스톤 ID 규칙에 `M{Phase}.A{n}` 추가.

브랜치: `docs/plan-ai-bootstrap` → PR → main (당시 CLAUDE.md 브랜치 규칙 정합).

### 2026-05-28 (30차) — research/ai/01·02 폐기 + spec 위임 표현 일괄 정리

`docs/research/ai/01_model_selection.md`(28곳) · `02_ml_pipeline_open_items.md`(13곳) 폐기. spec/plan/research 18개 파일에서 위임 문구를 일괄 제거하고 결정 대기 사항은 "별도 확정 예정" 또는 "AI 팀 확정"으로 약화 — 위임 위치 포인터(파일+섹션 ref)는 모두 제거. §3 정책 결정 이력의 "AI 미확정 → research 위임" 행은 정책 폐기 반영으로 갱신, "MVP 외부 데이터" 행은 03 조사 결과로 보강.

추가로 `docs/spec/11_ai_spec.md` §4 와 `11_ai_spec.md` §4 입력 피처를 `research/ai/03_external_data_sources.md`(2026-05-24 조사, 24차) 정합으로 갱신 — 서울 생활인구→세담터, [조사 중]→[2단계] 분류, 학사일정/상가정보 추가.

**변경 파일**

- spec(10): `01_requirements/requirements·usecase_spec`, `02_mvp/mvp_scope`, `03_feature_design/feature_spec·feature_list`, `05_api/api_spec`, `06_database/schema`, `07_backend/service_design`, `08_ai/ml_pipeline·model_spec`
- plan(5): `be/phase_04_pos·08_n8n·11_dashboard·12_hookup`, `fe/phase_12_hookup`
- research/backend(3): `06_external_integration·08_async_pipeline·14_security_open_items`
- 인덱스(3): `docs/README.md` · `docs/research/README.md` · `PROGRESS.md` §3
- 삭제(2): `docs/research/ai/01_model_selection.md` · `02_ml_pipeline_open_items.md`

브랜치: `docs/cleanup-ai-research-01-02` → PR → main (`README.md` §5 · `CLAUDE.md` 핵심 규칙 ④ 정합).
