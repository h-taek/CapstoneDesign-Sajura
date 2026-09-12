# 사주라 프로젝트 진행 현황

> 프로젝트 공통 현황만 담는다. 개인별 작업 이력은 §4의 이력 문서를 본다.

---

## 1. 전체 단계

| 단계 | 내용 | 상태 |
|------|------|------|
| 1. 요구사항 정의 | `docs/spec/01_requirements.md`, `02_usecase.md` | 완료 |
| 2. 설계 (기능·API·DB·백엔드·프론트·AI) | `docs/spec/` 전체 | 완료 |
| 3. 리서치 | `docs/research/` (backend·frontend·ai) | 완료 |
| 4. 구현 계획 | `docs/plan/` | 완료 |
| 5. 구현 | Phase 2·3·4·5·6·7·11·12 구현됨 / Phase 8(n8n 배치)·10(자동화)·알림 미착수 | 진행 중 |
| 6. 테스트 & 배포 | 졸업 시연 범위 | 예정 |

> Phase 5·9·11은 코드가 존재하나 `docs/plan/`의 마일스톤 대조는 아직 하지 않았다.
> 구현과 spec이 어긋난 지점은 2026-09-12 정합 검수로 확인했다. 목록과 처리 순서는 `HANDOFF.md`에 있다.

---

## 2. 작업 흐름

```
docs/research/   → 구현 전 조사 (기술 조사, 레퍼런스 분석 등)
      ↓
docs/plan/       → 구현 계획 (단계별 작업, 순서, 역할 분담)
      ↓
구현             → docs/spec/ 문서를 기준으로 개발 진행
```

- `research/`와 `plan/`의 파일명은 담당자가 자유롭게 정한다
- 조사 중인 내용은 `research/`, 미래 계획은 `plan/`, 확정된 사실만 `spec/`에 담는다
- 다음 작업의 컨텍스트와 진입점은 `HANDOFF.md` 참고

---

## 3. 정책 결정 이력 (요약)

세부 audit 결과는 spec/research 본문에 반영되어 있어 본 표에는 **현재 살아 있는 핵심 결정**만 한 줄로 추상화한다. 신규 결정은 표에 행을 추가하고, 폐기·번복 시 해당 행만 갱신한다. 회차별 상세 변경은 §5 문서 수정 이력의 차수 항목과 git log 참조.

| 영역 | 결정 | 근거 위치 |
|---|---|---|
| 문서 구조 | spec(확정 사실) · research(spec 작성 위한 조사) · plan(구현 계획) 3폴더 분리 + research 하위 backend/frontend/ai 도메인 폴더 | `docs/README.md` |
| spec 폴더 순서 | contract-first / outside-in: 요구사항 → MVP → 기능 → 흐름 → API → DB → Backend → AI → 비기능 | `docs/spec/` 폴더 번호 |
| MVP 데이터 | **CSV-only** (POS API는 [2단계]). 모든 spec에 `[MVP]`/`[2단계]` 라벨 부착 | `docs/spec/03_mvp_scope.md` |
| 웹 프레임워크 | FastAPI + Pydantic v2 + orjson | `09_service_design.md` §1 |
| 앱 서버 | dev Uvicorn / prod Gunicorn + uvicorn.workers (워커 4, --max-requests 1000, --preload) | `research/backend/02_app_server.md` |
| 리버스 프록시 | Caddy v2 (TLS 1.3 강제, FE dist를 caddy 이미지에 COPY) | `research/backend/03_reverse_proxy.md` |
| 데이터 계층 | SQLAlchemy 2.x async + aiomysql + PyMySQL(Alembic) + pandas + numpy + datetime+zoneinfo | `09_service_design.md` §1 |
| 인증·암호화 | Authlib + python-jose + passlib[bcrypt] + cryptography(AES-256-GCM) | `12_security.md` §2·§4 |
| OAuth 콜백 응답 | 302 Redirect to FE root + Set-Cookie refresh_token (Access Token 본문/URL 미노출, FE 첫 진입에서 `POST /api/auth/refresh`로 동기) | `07_api_spec.md` §2, `06_sequence.md` §2 |
| 외부 연동 | httpx + tenacity + aiobreaker + BeautifulSoup4(lxml) + Playwright(Chromium 단일) | `09_service_design.md` §1 |
| 알림 | 점주 3채널(인앱·Web Push·이메일) — pywebpush + fastapi-mail + `notifications` 테이블. Slack은 운영자 모니터링 전용 | `09_service_design.md` §4, `08_schema.md` §3.22~23 |
| 인앱 알림 폴링 | 5분 고정 (코드 상수, 사용자 설정 미노출) + 수동 새로고침 권장 — BE rate limit 보호 | `10_frontend_design.md`, `research/frontend/06_pwa_push.md` |
| 캐시·관측 | Redis + redis-py(async) + structlog + asgi-correlation-id + Sentry(BE+FE 동일 release `git-<sha>`, PII scrubbing, traces 5%) | `09_service_design.md` §1, `13_performance.md` §5 |
| 비동기 작업 분리 | n8n = AI 파이프라인(외부 데이터 수집·AI Server 호출). ARQ cron_jobs = BE 도메인 정기 작업(소비기한 점검 등). BackgroundTasks = 짧은 후처리 | `research/backend/08_async_pipeline.md` §1.4 |
| 알림 송출 단일 경로 | BE `NotificationService.create_and_push`만 사용. n8n은 BE API 트리거만, DB `notifications` 직접 INSERT 금지 | `08_schema.md` §5 n8n_user 권한 |
| 테스트·품질 | pytest + pytest-asyncio + pytest-cov + factory_boy + Faker + testcontainers + respx + ruff + mypy + bandit + pip-audit + pre-commit | `research/backend/09_testing_quality.md` |
| 배포 | uv + Docker + Docker Compose(V2) 6서비스 + Buildx 멀티아키 + GitHub Actions + Trivy | `research/backend/10_deployment.md` |
| ID·시간·전화 | UUIDv4 + datetime+zoneinfo + phonenumbers NATIONAL 형식 | `08_schema.md` §3.3 stores |
| Frontend 스택 | React 19 + Vite 6 + TS strict + React Router v7 + Zustand 5(auth 메모리·prefs persist 분리) + TanStack Query v5 + ky 1.x(401 단일 refresh 인터셉터) + openapi-typescript + Tailwind v4 + shadcn/ui + RHF + zod + Recharts + vite-plugin-pwa(injectManifest) + @sentry/react | `10_frontend_design.md` |
| Git 브랜치 전략 | 장수 5개(`main`·`dev`·`be`·`fe`·`ai`). be+fe → `feat/*` → be/fe → dev → main, AI는 ai → main 직행. main 보호(직접 푸시 금지·PR 필수). 통합 후 5브랜치 동일 commit 정렬 | `README.md` §5 |
| 문서 작업 main 동기화 | main 전용 문서(PROGRESS·docs/spec·docs/plan·루트 README·CLAUDE·AGENTS) 수정 전 `git pull --ff-only origin main` 의무 | `README.md` §5, `CLAUDE.md` 규칙 ④ |
| AI 미확정 항목 | 평가 지표·예측 근거 산출 방법·DNN 도입 여부·학습 데이터 사용 방식·신뢰도 임계값·재학습 교체 기준 — AI 팀 확정 시 spec에 직접 반영. spec/plan은 "별도 확정 예정"으로 표기 (30차 research 위임 폐기). ~~결측 보간·이상치 임계값~~은 38차 확정 → 아래 행 | 각 spec 본문 (`11_ai_spec.md`, `11_ai_spec.md` 등) |
| AI 일부 확정 (22차) | Regression 방식 + Walk-forward CV + IQR 우선/Z-score 보조(임계 계수 probe 후) + 데이터 누수 방지 원칙. 모델 자체는 미확정 유지 | `11_ai_spec.md` §3·§7, `11_ai_spec.md` §6 |
| MVP 외부 데이터 (30차 확정) | 03 조사로 확정 — 기상청 단기예보·과거 기상·공휴일·홍익대 학사일정 [필수]; 세담터 유동인구·소상공인 상가정보 [권장]; 배달상권 [선택]. [2단계]: SK 지오비전·ECOS·네이버 데이터랩. 세종 조치원 홍익대 상권 기준 | `11_ai_spec.md` §4 + `research/ai/03_external_data_sources.md` |
| 보안 정책 | RBAC MVP 단일 역할 점주 / 감사 로그 1년 보관·`ops_readonly` 조회·append-only / 다중 디바이스 자체 토큰 / 강제 로그아웃 `POST /api/auth/logout-all` 채택 / 결제는 쿠팡 자체 수행(사주라 미경유·미저장) | `12_security.md` §2·§5, `research/backend/14_security_open_items.md` |
| 데모 시나리오 | 9단계 SSOT — 1.로그인 2.온보딩 3.CSV 4.메뉴·재고·판매 5.n8n야간예측 6.수요예측 7.추천발주 8.대시보드·알림 9.쿠팡자동주문 | `docs/plan/01_be.md` |
| OAuth dev 운영 (29차) | (a) 카카오 scope에서 `account_email` 제거 — 동의항목 미검수 환경 대응. (b) fallback 이메일은 `{provider}_{id}@social.example.com` (valid TLD). (c) `UserMeResponse.email`은 `str` (register/login 입력 검증만 `EmailStr`). (d) Vite dev proxy `/api → BE`로 FE/BE 같은 origin 통합 + **OAuth `redirect_uri`도 proxy 경유(`localhost:5173/api/auth/callback/*`)로 통일(34차)** — Safari ITP cross-site cookie 차단 회피. 콜백을 BE:8000으로 직접 보내면 refresh 쿠키가 cross-site로 설정돼 첫 로그인이 차단(2회 클릭 필요)되던 문제 해결. **OAuth 콘솔(Google/Kakao) 승인 redirect URI에도 5173 주소 등록 필요** | `Back/app/api/oauth.py`, `Back/app/schemas/auth.py`, `Front/vite.config.ts`, `.env.example` |
| FE 자체 로그인·회원가입 (29차) | spec(`04_feature_spec.md` §1.2)·BE(9개 라우터 + auth_test 12개)는 정상이나 27차 phase_03 작성 시 FE 마일스톤이 누락되어 OAuth 화면만 노출. `docs/plan/02_fe.md` M3.F8로 명시화하고 **다음 단계로 즉시 진행**. `dev` 위에서 `feat/fe-register` → `fe` → `dev` 머지 흐름. **main 릴리즈는 전체 phase 완료 후 1회**로 유보 | `docs/plan/02_fe.md` M3.F8, `04_feature_spec.md` §1.2, `HANDOFF.md` |
| 사업자 검증 = 온보딩 前 독립 게이트 (32차) | 사업자 검증을 회원가입에 묶지 않고 **인증 후·온보딩 진입 전 독립 단계(`/verify-business`, `POST /api/store/business/verify`)**로 분리 — 소셜·이메일 계정 공통 적용(기존엔 이메일 register에만 있어 OAuth 갭). `register`는 email·password·name만 받고 매장 행은 빈 상태로 생성. `stores.business_verified` 플래그 + `business_no`/매장필드 nullable. 검증 실패 시 **계정 유지 + 재검증**(미등록/형식 재입력·휴폐업 안내), 가드가 미검증자 온보딩 차단. 시연용 마스터 코드(`NTS_MASTER_BYPASS_CODE`)로 강제 통과 가능. **33차에서 상태 모델·소유권 검증으로 확장됨** | `04_feature_spec.md` §1.4, `07_api_spec.md` §3 등 |
| 사업자 소유권 검증 = NTS + 등록증 + 관리자 승인 (33차) | NTS 조회는 사업자 실재·영업만 확인하고 **소유권은 증명 못 하는 공백**을 보완. ① NTS 즉시 조회 ② **사업자등록증 업로드** → `PENDING` ③ **관리자 승인**(`/admin` 심사) → `VERIFIED`/반려 `REJECTED`. `business_verified`(boolean) → **`business_status` 4단계 enum**. **PENDING부터 온보딩 진입 허용(1-B)**. `users.role`(OWNER/ADMIN) 신설, 관리자 최소 심사(`/api/admin/*`)는 Phase 3 포함·종합 관리도구는 Phase 11로. 등록증 파일은 서버 볼륨 저장(DB엔 경로), ADMIN 가드 하에서만 조회. 마스터 코드→곧바로 VERIFIED | `04_feature_spec.md` §1.4, `07_api_spec.md` §2·§3, `08_schema.md`(users.role·stores.business_status·cert), `09_service_design.md`(AdminVerificationService), `12_security.md` §2.4·§4.2·§5.1, `10_frontend_design.md` §3, `plan/be·fe/phase_03_auth.md`(M3.B8·B9·F9·F10), `04_gantt.md` |
| AI 학습 데이터 수집 경로 (37차) | **모델링(Phase 6) 학습용 수집은 오프라인 우선**: 날씨=기상자료개방포털 **다운로드 CSV**(세종 AWS 4관측소 2020~2026.05, API 미사용) / 공휴일=`holidays` 패키지 오프라인 생성+수동 보정 / 학사일정=수동 정리 CSV(검수제) / 판매=실매장 매출리포트 복호화(2025-04~2026-04 확보). **API(기상청 단기예보·KASI 등)는 운영 배치(Phase 8 n8n) 전용**. **유동인구는 세담터에서 시간대별 데이터셋 미확보 → 세종시 행정동별 월간 생활·유동인구 리포트로 대체**(조치원읍, 월 단위 — 일별 조인 시 전월 lag, 누락 월 보간은 M6.A4). 원본·가공 데이터는 git 제외(`AI/data/raw·processed`), 수동 소스만 추적 | `AI/data/README.md`, `docs/research/ai/03_external_data_sources.md`, `11_ai_spec.md` §4 |
| AI 전처리 규칙 확정 (38차) | 타깃 이상치 = **log1p IQR k=3.0** train-fit winsorize(파일럿 개입 0건 — raw·k1.5·P1/P99는 실수요 오탐으로 기각) · 결측 = 기상 선형 보간 / 유동인구 전월 **ffill+staleness**(선형 보간은 미래 월 참조라 금지) / lag 워밍업 NaN은 트리=네이티브·선형계=완비 행만 · 검증 분할 = **월 단위 walk-forward**(검증 fold=영업일 ≥10일 월, 최종 fold test 봉인, 휴업 월 자동 배제). 유동인구 피처는 ablation 악화(+1.2%)로 모델 1군 제외 | `11_ai_spec.md` §6 + `AI/notebooks/03_preprocessing.ipynb` + `AI/data_prep/preprocess.py` (ai 브랜치) |
| AI 초기 모델 확정 (38차) | 주 모델 = **LightGBM 비율 타깃 하이브리드**(타깃 log1p(일 매출)−log1p(7영업일 평균) — 수준은 이동평균·편차만 학습, keep 20열, Optuna 튜닝) + 보조 baseline **MA-7**(fallback·drift 감시). 순정 GBM·SARIMA·XGBoost·CatBoost는 MA-7도 못 이겨 기각 — 하이브리드만 유의미 우위(봉인 test sMAPE 30%·MA-7 대비 -19.6%). 평가 지표 **MAE(주)+sMAPE(보고), MAPE 제외**(소액일 왜곡 정정), 운영 목표 naive-요일 skill ≥+15%·MA-7 우위 유지(drift 경보선). **AI 산출 범위 확정(담당자): 매출 예측(+고도화)까지가 AI 책임** — 메뉴별 수요는 매장별 믹스 상이로 공통 분해 모델 없음(접근은 Phase 7), 재료 리스트업은 점주 관리(자동 산출 아님). 제품 spec의 "메뉴별 수요·추천발주" 표현 정리는 담당자 검토 항목 | `11_ai_spec.md` §2·§3·§4·§5·§7 + `AI/notebooks/04_baselines.ipynb`·`05_model_selection.ipynb` (ai 브랜치) |
| AI 모델 ② 메뉴 분해 확정 (39차) | 산출 구조 = **2모델**(담당자 정정 — "공통 모델 없음"은 매장 간 통일 모델 부재의 뜻, 매장별 분해 유지): 모델 ① 매출 예측(V1-t) + **모델 ② 매장별 메뉴 비중 분해 = 최근 28영업일 합산 수량 비중(S1)** — 요일 조건부는 검증 5 fold 전패로 기각(요일은 총량의 문제). recommend는 **계약 v2(A안 단일 호출)**: 서버 내부 ①×②→점주 레시피(BOM) 전개→재고·리드타임 발주 참고치 + 신뢰도 배지 전파. 재료 리스트업(레시피 등록)은 점주 관리 유지 | `11_ai_spec.md` §3·§4 + `07_api_spec.md` §8 + `AI/notebooks/11_menu_decomposition.ipynb`·`AI/app/model/decompose.py`·`AI/app/api/orders.py` (ai 브랜치) |
| AI 학습 데이터 확대 방향 (38차 후속) | **파일럿 5~7월 신규 매출분 부재 확인(담당자)** — 전향적 검증 불가. 모델링 트릭에 의한 유효 표본 확대는 **멀티 호라이즌 풀링(학습 행 3배) 실험 기각**(사전 등록 규칙 — D+1 +2.6%p 악화·개강 fold 붕괴)으로 종결, 부수 진단에서 **서빙의 h=1 단일 모델 재사용 전략이 h별 개별 모델보다 우위**로 확인(서빙 무변경 확정, MA-7 대비 D+1 -10.2/D+2 -4.1/D+3 -1.4%). 남은 확대 레버 = 실데이터: ① 2025-04 이전 과거분 소급(점주 문의) ② 유사 매장 확보 시 통합 학습. **외부 검증은 Kaggle Recruit로 완료(사전 기준 충족 — 814곳 승률 92.6%·중앙값 −10.1%, SHORT_HISTORY 60일 임계 실증)**; KADX 영수증별 POS는 접근 권한 없음 확정, 행정동 집계류 공공데이터는 부적합 판정 | `11_ai_spec.md` §3·§7 + `AI/notebooks/06_enhancement.ipynb` §6·`10_recruit_validation.ipynb` (ai 브랜치) |

---

## 4. 이력 문서

완료 이력은 담당자별로 나눠 보관한다. 최신이 위로 오는 역시간순이다.

| 문서 | 담당자 | 담당 범위 |
|---|---|---|
| [PROGRESS_HT.md](PROGRESS_HT.md) | 임형택 | Backend + Frontend + 문서·플랜 운영 |
| [PROGRESS_DY.md](PROGRESS_DY.md) | 정동욱 | AI 모델링 — 모델 선정·전처리·서빙·AI spec |
| [PROGRESS_MY.md](PROGRESS_MY.md) | 이민욱 | AI 모델링 |
| [PROGRESS_CH.md](PROGRESS_CH.md) | 서창현 | Backend + Frontend — 8월 리디자인·실데이터 연동 |

새 항목은 본인 문서에 쓴다. 새 정책·방향 결정은 사람과 무관하므로 위 §3에 쓴다.
