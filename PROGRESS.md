# 사주라 프로젝트 진행 현황

---

## 1. 전체 단계

| 단계 | 내용 | 상태 |
|------|------|------|
| 1. 요구사항 정의 | 01_requirements.md, 02_usecase.md | ✅ 완료 |
| 2. 기능·API·DB·백엔드·AI 설계 | docs/spec/ 전체 | ⬜ 진행 중 (backend 완료, AI 진행 중) |
| 3. 리서치 | 기술 조사·레퍼런스 분석 (docs/research/) | ⬜ 진행 중 (backend ✅, frontend ✅, ai 예정) |
| 4. 구현 계획 | 단계별 작업·순서·역할 분담 (docs/plan/) | ✅ 완료 (21차 + 23차 audit) |
| 5. 구현 | spec/ 기준으로 개발 진행 | ⬜ 진행 중 (Phase 2 ✅ + Phase 3 ✅) |
| 6. 테스트 & 배포 | | ⬜ 예정 |

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
| 데모 시나리오 | 9단계 SSOT — 1.로그인 2.온보딩 3.CSV 4.메뉴·재고·판매 5.n8n야간예측 6.수요예측 7.추천발주 8.대시보드·알림 9.쿠팡자동주문 | `docs/plan/be/phase_13_release.md` |
| OAuth dev 운영 (29차) | (a) 카카오 scope에서 `account_email` 제거 — 동의항목 미검수 환경 대응. (b) fallback 이메일은 `{provider}_{id}@social.example.com` (valid TLD). (c) `UserMeResponse.email`은 `str` (register/login 입력 검증만 `EmailStr`). (d) Vite dev proxy `/api → BE`로 FE/BE 같은 origin 통합 + **OAuth `redirect_uri`도 proxy 경유(`localhost:5173/api/auth/callback/*`)로 통일(34차)** — Safari ITP cross-site cookie 차단 회피. 콜백을 BE:8000으로 직접 보내면 refresh 쿠키가 cross-site로 설정돼 첫 로그인이 차단(2회 클릭 필요)되던 문제 해결. **OAuth 콘솔(Google/Kakao) 승인 redirect URI에도 5173 주소 등록 필요** | `Back/app/api/oauth.py`, `Back/app/schemas/auth.py`, `Front/vite.config.ts`, `.env.example` |
| FE 자체 로그인·회원가입 (29차) | spec(`04_feature_spec.md` §1.2)·BE(9개 라우터 + auth_test 12개)는 정상이나 27차 phase_03 작성 시 FE 마일스톤이 누락되어 OAuth 화면만 노출. `docs/plan/fe/phase_03_auth.md` M3.F8로 명시화하고 **다음 단계로 즉시 진행**. `dev` 위에서 `feat/fe-register` → `fe` → `dev` 머지 흐름. **main 릴리즈는 전체 phase 완료 후 1회**로 유보 | `docs/plan/fe/phase_03_auth.md` M3.F8, `04_feature_spec.md` §1.2, `HANDOFF.md` |
| 사업자 검증 = 온보딩 前 독립 게이트 (32차) | 사업자 검증을 회원가입에 묶지 않고 **인증 후·온보딩 진입 전 독립 단계(`/verify-business`, `POST /api/store/business/verify`)**로 분리 — 소셜·이메일 계정 공통 적용(기존엔 이메일 register에만 있어 OAuth 갭). `register`는 email·password·name만 받고 매장 행은 빈 상태로 생성. `stores.business_verified` 플래그 + `business_no`/매장필드 nullable. 검증 실패 시 **계정 유지 + 재검증**(미등록/형식 재입력·휴폐업 안내), 가드가 미검증자 온보딩 차단. 시연용 마스터 코드(`NTS_MASTER_BYPASS_CODE`)로 강제 통과 가능. **33차에서 상태 모델·소유권 검증으로 확장됨** | `04_feature_spec.md` §1.4, `07_api_spec.md` §3 등 |
| 사업자 소유권 검증 = NTS + 등록증 + 관리자 승인 (33차) | NTS 조회는 사업자 실재·영업만 확인하고 **소유권은 증명 못 하는 공백**을 보완. ① NTS 즉시 조회 ② **사업자등록증 업로드** → `PENDING` ③ **관리자 승인**(`/admin` 심사) → `VERIFIED`/반려 `REJECTED`. `business_verified`(boolean) → **`business_status` 4단계 enum**. **PENDING부터 온보딩 진입 허용(1-B)**. `users.role`(OWNER/ADMIN) 신설, 관리자 최소 심사(`/api/admin/*`)는 Phase 3 포함·종합 관리도구는 Phase 11로. 등록증 파일은 서버 볼륨 저장(DB엔 경로), ADMIN 가드 하에서만 조회. 마스터 코드→곧바로 VERIFIED | `04_feature_spec.md` §1.4, `07_api_spec.md` §2·§3, `08_schema.md`(users.role·stores.business_status·cert), `09_service_design.md`(AdminVerificationService), `12_security.md` §2.4·§4.2·§5.1, `10_frontend_design.md` §3, `plan/be·fe/phase_03_auth.md`(M3.B8·B9·F9·F10), `plan_gantt.md` |
| AI 학습 데이터 수집 경로 (37차) | **모델링(Phase 6) 학습용 수집은 오프라인 우선**: 날씨=기상자료개방포털 **다운로드 CSV**(세종 AWS 4관측소 2020~2026.05, API 미사용) / 공휴일=`holidays` 패키지 오프라인 생성+수동 보정 / 학사일정=수동 정리 CSV(검수제) / 판매=실매장 매출리포트 복호화(2025-04~2026-04 확보). **API(기상청 단기예보·KASI 등)는 운영 배치(Phase 8 n8n) 전용**. **유동인구는 세담터에서 시간대별 데이터셋 미확보 → 세종시 행정동별 월간 생활·유동인구 리포트로 대체**(조치원읍, 월 단위 — 일별 조인 시 전월 lag, 누락 월 보간은 M6.A4). 원본·가공 데이터는 git 제외(`AI/data/raw·processed`), 수동 소스만 추적 | `AI/data/README.md`, `docs/research/ai/03_external_data_sources.md`, `11_ai_spec.md` §4 |
| AI 전처리 규칙 확정 (38차) | 타깃 이상치 = **log1p IQR k=3.0** train-fit winsorize(파일럿 개입 0건 — raw·k1.5·P1/P99는 실수요 오탐으로 기각) · 결측 = 기상 선형 보간 / 유동인구 전월 **ffill+staleness**(선형 보간은 미래 월 참조라 금지) / lag 워밍업 NaN은 트리=네이티브·선형계=완비 행만 · 검증 분할 = **월 단위 walk-forward**(검증 fold=영업일 ≥10일 월, 최종 fold test 봉인, 휴업 월 자동 배제). 유동인구 피처는 ablation 악화(+1.2%)로 모델 1군 제외 | `11_ai_spec.md` §6 + `AI/notebooks/03_preprocessing.ipynb` + `AI/data_prep/preprocess.py` (ai 브랜치) |
| AI 초기 모델 확정 (38차) | 주 모델 = **LightGBM 비율 타깃 하이브리드**(타깃 log1p(일 매출)−log1p(7영업일 평균) — 수준은 이동평균·편차만 학습, keep 20열, Optuna 튜닝) + 보조 baseline **MA-7**(fallback·drift 감시). 순정 GBM·SARIMA·XGBoost·CatBoost는 MA-7도 못 이겨 기각 — 하이브리드만 유의미 우위(봉인 test sMAPE 30%·MA-7 대비 -19.6%). 평가 지표 **MAE(주)+sMAPE(보고), MAPE 제외**(소액일 왜곡 정정), 운영 목표 naive-요일 skill ≥+15%·MA-7 우위 유지(drift 경보선). **AI 산출 범위 확정(담당자): 매출 예측(+고도화)까지가 AI 책임** — 메뉴별 수요는 매장별 믹스 상이로 공통 분해 모델 없음(접근은 Phase 7), 재료 리스트업은 점주 관리(자동 산출 아님). 제품 spec의 "메뉴별 수요·추천발주" 표현 정리는 담당자 검토 항목 | `11_ai_spec.md` §2·§3·§4·§5·§7 + `AI/notebooks/04_baselines.ipynb`·`05_model_selection.ipynb` (ai 브랜치) |
| AI 모델 ② 메뉴 분해 확정 (39차) | 산출 구조 = **2모델**(담당자 정정 — "공통 모델 없음"은 매장 간 통일 모델 부재의 뜻, 매장별 분해 유지): 모델 ① 매출 예측(V1-t) + **모델 ② 매장별 메뉴 비중 분해 = 최근 28영업일 합산 수량 비중(S1)** — 요일 조건부는 검증 5 fold 전패로 기각(요일은 총량의 문제). recommend는 **계약 v2(A안 단일 호출)**: 서버 내부 ①×②→점주 레시피(BOM) 전개→재고·리드타임 발주 참고치 + 신뢰도 배지 전파. 재료 리스트업(레시피 등록)은 점주 관리 유지 | `11_ai_spec.md` §3·§4 + `07_api_spec.md` §8 + `AI/notebooks/11_menu_decomposition.ipynb`·`AI/app/model/decompose.py`·`AI/app/api/orders.py` (ai 브랜치) |
| AI 학습 데이터 확대 방향 (38차 후속) | **파일럿 5~7월 신규 매출분 부재 확인(담당자)** — 전향적 검증 불가. 모델링 트릭에 의한 유효 표본 확대는 **멀티 호라이즌 풀링(학습 행 3배) 실험 기각**(사전 등록 규칙 — D+1 +2.6%p 악화·개강 fold 붕괴)으로 종결, 부수 진단에서 **서빙의 h=1 단일 모델 재사용 전략이 h별 개별 모델보다 우위**로 확인(서빙 무변경 확정, MA-7 대비 D+1 -10.2/D+2 -4.1/D+3 -1.4%). 남은 확대 레버 = 실데이터: ① 2025-04 이전 과거분 소급(점주 문의) ② 유사 매장 확보 시 통합 학습. **외부 검증은 Kaggle Recruit로 완료(사전 기준 충족 — 814곳 승률 92.6%·중앙값 −10.1%, SHORT_HISTORY 60일 임계 실증)**; KADX 영수증별 POS는 접근 권한 없음 확정, 행정동 집계류 공공데이터는 부적합 판정 | `11_ai_spec.md` §3·§7 + `AI/notebooks/06_enhancement.ipynb` §6·`10_recruit_validation.ipynb` (ai 브랜치) |

---

## 4. 개발 이력

구현 phase별 통합·검증 결과 기록. 차수는 §5와 동일하게 PROGRESS 작성 시점 차수.

### Phase 2 — 인프라 부트스트랩 (2026-05-25, 24차)

**3트랙 동시 부트스트랩**

| 트랙 | 산출물 | 머지 |
|---|---|---|
| BE | FastAPI + Alembic + pydantic-settings + structlog/asgi-correlation-id/Sentry 미들웨어 + `GET /health` + 08_schema.md §3 전체 23개 테이블 마이그레이션 | `feat/be-infra-bootstrap` → `be` |
| FE | Vite 6 + React 19 + TS strict + Tailwind v4 + shadcn + TanStack Query v5 + ky 1.x 401 단일 refresh 인터셉터 + openapi-typescript + vite-plugin-pwa + @sentry/react + Biome + Vitest + multistage caddy Dockerfile | `feat/fe-infra-bootstrap` → `fe` |
| AI | FastAPI 빈 스켈레톤 + `GET /ai/health` (`model_loaded=false`) | `feat/ai-infra-bootstrap` → `ai` |

**docker compose 6서비스 stack** — `be · arq-worker · mysql · redis · n8n · caddy`. `docker/` 단일 루트로 통합, compose `context: .` + `dockerfile: docker/<svc>/Dockerfile` 통일.

**검증**: 6/6 컨테이너 healthy + `alembic upgrade head` 23개 테이블 + alembic_version + `GET /health` 200(be:8000 직접 + caddy:80 프록시).

**브랜치 통합**: PR #1 BE → be / #2 FE → fe / #3 AI → ai / #4 dev → main / #5 ai → main. 5개 장수 브랜치 동일 commit(`34dc58a`) 정렬.

---

### Phase 3 — 인증·온보딩 구현 (2026-05-26, 27차)

**BE M3.B1~B7** (`feat/be-auth` → `be`, PR #7)

- AuthService — 이메일 로그인(M3.B1) + 카카오/구글 OAuth 콜백 → Refresh HttpOnly Cookie + FE root 302
- StoreService — 매장 정보 CRUD + 소프트 삭제 + `POST /api/store/onboarding/complete` 멱등(M3.B2)
- 국세청 사업자등록번호 검증 어댑터 — 키 미설정 시 stub 통과(M3.B3)
- `POST /api/auth/logout-all` — 모든 디바이스 Refresh 일괄 폐기(M3.B4)
- auth_test BE 통합 12케이스(M3.B5)
- POS stub API — Phase 4 실연동 전 화면 흐름 막힘 방지용 mock 200(M3.B6)
- MenuService — 메뉴 CRUD + `POST /api/menus/bulk`(중복 메뉴 skip)(M3.B7)

**FE M3.F1~F6** (`feat/fe-auth` → `fe`, PR #8)

- 라우터·가드 — React Router v7 data router + `RequireAuth`/`RequireGuest`(부트스트랩 + onboarding 분기)
- Auth 부트스트랩 — 마운트 1회 `POST /api/auth/refresh` → 메모리 Access Token 동기 + `GET /api/auth/me`
- 로그인 화면 — 카카오/구글 버튼 → BE `/api/auth/login/{provider}` 302
- 온보딩 4스텝 (RHF + zod) — Step 1 매장 정보(phone 마스크) / Step 2 POS 연동(CSV_ONLY 시 자격증명 생략) / Step 3 메뉴 등록(`useFieldArray`) / Step 4 확인·제출(`PATCH /api/store` → POS 등록 → `POST /api/menus/bulk` → `POST /api/store/onboarding/complete`)
- 스토어 — Zustand `useAuthStore`(메모리) / `useOnboardingStore`(스텝 캐시), persist 미사용
- 테스트 — Vitest 8/8 통과 + Playwright E2E 스캐폴드(라우트 인터셉트)

**브랜치 통합**: PR #7 → be / PR #8 → fe / PR #9 → dev / PR #10 → dev.

---

### Phase 3 사후 정리 (2026-05-27, 28차)

- 머지 완료된 `feat/be-auth`·`feat/fe-auth` 원격+로컬 삭제 → 장수 브랜치 5개만 잔존
- outdated stash 1건 drop
- `HANDOFF.md` slim down (213 → 107줄, stale 4섹션 + 중복 표 제거)
- 문서 작업 main 동기화 의무 규칙 신설 (`README.md` §5, `CLAUDE.md`·`AGENTS.md` 핵심 규칙 ④로 확장)

---

### Phase 3 — dev 통합 검증 (E단계) + 골든패스 (2026-05-27, 29차)

HANDOFF.md E단계 9개 검증 시나리오 수행 + 발견된 결함 일괄 정정 + 카카오/구글 골든패스 통과.

**자동 검증 결과**

| 항목 | 결과 |
|---|---|
| dev 동기화 (7 commits FF) | ✅ |
| docker compose 6/6 healthy | ✅ |
| Alembic 23개 테이블 + alembic_version | ✅ |
| BE pytest auth_test | ✅ 12/12 |
| FE typecheck + Vitest | ✅ 8/8 |
| FE Playwright E2E | ✅ 2/2 |

**골든패스 통과** — 카카오·구글 OAuth 모두 로그인 → onboarding/1 진입 확인 (Safari 환경).

**검증 중 발견·픽스 (8건, 3 commit 묶음 + 4 commit 묶음)**

1차 묶음 (4 commit, `c2c639b..296e8a6`)
1. **BE 테스트 부재 → 재작성** — HANDOFF 기록의 auth_test 12개가 저장소에 없어 spec(api_spec §2) 기준으로 재작성. `NullPool` 기반 test engine + 이메일 prefix cleanup fixture. (`Back/tests/`)
2. **BE Dockerfile dev extras 누락** — pytest 미설치로 `docker compose exec be pytest` 실패 → `.` → `.[dev]` 변경 + `COPY Back/tests`.
3. **FE 빌드 파이프라인 vite 5/6 plugin 타입 충돌** — vitest 2.x가 vite 5 peer를 끌어들임. vitest 3.x 업그레이드로 vite 6 단일화.
4. **`workbox-precaching` 의존성 누락** — sw.ts import는 있는데 package.json에 없음 → `pnpm build` Rollup 해석 실패. 의존성 추가.
5. **E2E `login page exposes both OAuth buttons` 테스트 버그** — `beforeEach`의 refresh stub이 RequireGuest 가드를 트리거해 /login에서 리다이렉트. 해당 테스트만 refresh 401로 덮어쓰기.
6. **`arq-worker` healthcheck 실패** — `python:3.12-slim`에 `pgrep` 미설치(procps). `grep -q arq /proc/1/cmdline`로 교체.

2차 묶음 (3 commit, `14d9b6f..58d7a94`) — 골든패스 진행 중 발견

7. **BE: 카카오 OAuth 권한 부재 환경 대응**
   - `_SCOPES["kakao"]`에서 `account_email` 제거 → 신규 카카오 앱은 이메일 동의항목 검수 전이라 KOE205 발생, `profile_nickname`만 요청
   - fallback 이메일 도메인 `@no-email.local` → `@social.example.com` (valid TLD)
   - `UserMeResponse.email` 타입 `EmailStr` → `str` — OAuth fallback 이메일이 `.local` TLD라 EmailStr 검증에서 500 발생 후 FE 401 리다이렉트 루프 발생
8. **FE: Vite dev proxy로 BE 통합** — Safari ITP가 `localhost:5173 → localhost:8000`을 cross-site로 차단하여 refresh_token 쿠키 미전송. `server.proxy["/api"]` 추가 + `dev-up.sh` `API_BASE_URL` 기본값 `/api`로 변경 → same-origin 통합.

**산출물 신규**

- `scripts/dev-up.sh` — 통합 부트스트랩(docker stack + Alembic + FE dev). `--rebuild`/`--no-fe`/`--down`/`--logs`/`--status` 옵션. PID·로그는 `.dev-fe.pid`/`.dev-fe.log`로 분리(.gitignore 반영).

**브랜치 통합**

- PR #11 `dev → be` (sync) — be 브랜치를 dev에 정렬
- PR #12 `dev → fe` (sync) — fe 브랜치를 dev에 정렬
- 머지 후 be · fe · dev 동일 commit으로 lock-step 정렬 예정

**다음 (F단계)**: dev → main 릴리즈 PR (`release(phase-3): BE + FE 인증·온보딩 통합`) → 머지 후 `be`/`fe`/`ai`로 back-merge하여 5개 장수 브랜치 동일 commit 정렬.

---

### Phase 4 — POS·CSV 데이터 적재 구현 + dev 통합 (2026-05-30, 36차)

35차 plan 정합(CSV-only) 위에 BE + FE 본구현 + 골든패스 검증 완료.

**BE (M4.B1~B3, dev 3 커밋)**

| 영역 | 산출물 | 마일스톤 |
|---|---|---|
| 모델·어댑터 | `SaleRecord` ORM(0001 init에 테이블 이미 존재) + `CSVAdapter`(공통 스키마 변환·skip 사유 반환) + `AnomalyDetector` placeholder(Phase 12 hookup 자리만) | M4.B1·M4.B3 |
| 엔드포인트 | `POST /api/sales/upload` — pandas `chunksize=10_000` + 청크 단위 트랜잭션 + MySQL `INSERT IGNORE`로 UNIQUE(store_id,source,external_sale_id) 중복 자동 skip + 50 MB 상한 + 컬럼명 매핑(date/menu/quantity/price/external_sale_id) | M4.B2 |
| UX 개선(36차) | `auto_create_menus` 옵션(기본 false) — true 시 미등록 메뉴를 카테고리 `"자동등록"`/`use_inventory_deduction=false`/단가=`total_price//quantity`로 즉시 추가 후 imported 진입. `skipped_reasons` 그룹화(메뉴별·ID별·DB총건수) | — |
| stub 검증 | `pos_stub.py GET /api/store/pos/status` 응답 스키마 ↔ `api_spec §3` 키/타입 완전 일치 확인. 수정 0건 | — |

**FE (M4.F1~F3, dev 5 커밋)**

| 영역 | 산출물 | 마일스톤 |
|---|---|---|
| 설정 화면 | `/settings/pos` — 연동 상태 배지(`CSV_MODE` 등 4종) + CSV 템플릿 동적 Blob 다운로드(UTF-8 BOM) + 업로드 화면 진입. CSV 액션 허브 | M4.F1 |
| 업로드 화면 | `/sales/upload` — 드래그앤드롭 + 클릭 선택 + 컬럼명 매핑 인풋 + 50 MB/.csv 검증 + multipart 전송(120s 타임아웃) + '메뉴 자동 등록' 체크박스 | M4.F2 |
| 결과 화면 | imported/skipped/auto_created_menus(조건부)/anomaly_count 메트릭 카드 + 제외 사유 details(50건 잘림 처리) | M4.F3 |
| 부수 | `admin/verifications.tsx` TS strict 가드(빌드 차단 해소) + 라우터 등록 + 홈 진입 링크 | — |

**골든패스 검증 (사용자 수동)**: 회원가입 → 사업자 검증(마스터) → 매장 정보 → 메뉴 등록 → 설정 화면 → CSV 템플릿 다운로드 → 업로드 → 결과 확인 → DB 적재 확인(`sale_records=3,000` / `menus=97`(자동등록 96 + 음료 1) / `stores.business_status=VERIFIED`).

**10만 행 실측**: `04_Demo_Data` 합성 CSV(메뉴 카탈로그는 moomoo `.xls` 4개에서 추출 후 영업시간·시퀀스 합성). **12.61초 / 7,930 rows/s / imported 100,000 / skipped 0** — plan M4.B2 검증 기준 충족.

**OAuth 더블클릭 회귀 픽스(36차 후반)**: 34차 `redirect_uri` proxy 픽스 이후 `cd7c02f`(refresh `SELECT FOR UPDATE`) 들어가면서 React StrictMode 이중 effect로 `refreshAccessToken` 동시 2회 호출 → 두 번째가 옛 토큰 revoke 후 401 → 부트스트랩 토큰 없는 상태로 종료 → 로그인 화면 재진입(=재클릭 증상)로 재발. `Front/src/api/endpoints/auth.ts`에 module-scope in-flight Promise 공유 추가 → 동일 탭 동시 호출 BE 1회로 합쳐짐. Vitest 가드 2개 추가.

**/review 후속 픽스(8abb2b9)**: ① pandas sync 호출 → `asyncio.to_thread`로 워커 스레드 위임(이벤트 루프 블록 해소). ② `auto_create_menus` 업로드당 200개 + 매장 1,000개 상한. ③ 메뉴명 100자 초과 행 `SkipReason` 처리. **/qa 검증**: 실 BE/FE 라이브 업로드 `imported=3,000 / auto_created=96`.

**테스트**: BE pytest 36(기존 20 + 신규 16) / FE Vitest 29(기존 19 + 신규 10) / Playwright 8(기존 7 + 신규 1) — **전체 73개 통과**.

**브랜치 통합**: 본 작업은 모두 `dev` 단일 라인. main에는 35차 plan 정정 + 36차 spec/PROGRESS 갱신만 들어감. **be/fe 정렬·dev → main 릴리즈는 전체 phase 완료 후 1회 정책 유지**(33·34차와 동일).

---

### Phase 3 — 사업자 검증 게이트 구현 + dev 통합 + OAuth 픽스 (2026-05-29, 34차)

32·33차에서 문서로 확정한 사업자 검증 게이트(NTS + 등록증 업로드 + 관리자 승인)를 코드로 구현하고 `dev`에 통합. 수동 테스트로 골든패스·관리자 흐름 확인.

**구현 (PR-A 점주 측 → PR-B 관리자 측, 각 BE→FE 순)**

| 영역 | 산출물 | 마일스톤 |
|---|---|---|
| BE PR-A | `business_status` enum 마이그레이션(0003) + `core/storage.py`(등록증 저장) + `verify_business`(NTS→마스터=VERIFIED/등록증=PENDING) + verify 엔드포인트 multipart | M3.B8 |
| BE PR-B | `users.role` 마이그레이션(0004) + `AdminVerificationService`(목록·승인·반려·등록증 스트리밍) + `/api/admin/*` ADMIN 가드(`get_admin_user`, role DB 실시간 조회) | M3.B9 |
| FE PR-A | register 단순화(email·pw·name) + `/verify-business`(사업자번호+등록증 업로드, 반려 사유 표시) + `RequireStage`(verify/onboarding/app) 가드 + `landingPath()` | M3.F8·F9 |
| FE PR-B | `/admin/verifications` 심사 큐(목록·등록증 미리보기·승인/반려) + `RequireAdmin` 가드 | M3.F10 |

**docker**: `be` 서비스에 `be_uploads` 볼륨 추가(등록증 파일이 rebuild 시 유실되지 않도록).

**테스트**: BE pytest 20개(auth_test 16 + admin_test 4) + FE Vitest 19 + Playwright E2E 7 통과.

**OAuth 더블클릭 픽스**: 구글/카카오 콜백 `redirect_uri`를 BE:8000 직접 → FE proxy(`localhost:5173/api/auth/callback/*`)로 변경. cross-site refresh 쿠키를 Safari ITP가 첫 시도에 차단하던 문제 해결(§3 OAuth dev 운영 (d) 참조). OAuth 콘솔 양쪽에 5173 redirect URI 등록 후 1회 클릭 정상 동작 확인.

**수동 테스트 (`scripts/dev-up.sh`)**: 구글 로그인 → `/verify-business` 자동 진입 정상. 관리자 흐름은 `htaeky@gmail.com`을 DB에서 `role=ADMIN` 승격 후 `/admin/verifications` 접근 확인.

**브랜치 통합**: `feat/be-admin`(BE 전체) → dev, `feat/fe-admin`(FE 전체) → dev 직접 머지(BE는 `Back/`·`docker-compose`, FE는 `Front/`·`.env.example`로 파일 겹침 없음). `.env.example` OAuth redirect 수정은 dev 커밋. **be/fe 브랜치 정렬·dev → main 릴리즈는 전체 phase 완료 후 1회로 유보**.

---

## 5. 문서 수정 이력

차수별 상세 변경. 최근 항목을 위로, 옛 항목은 추상화한다. 1~27차 audit 상세는 git log + spec/research 본문 참조.

### 2026-07-29 (39차) — M7.A3 recommend 재정의: 모델 ② 메뉴 비중 분해 확정 + 계약 v2 구현

담당자 정정으로 산출 구조 재확립 — "공통 분해 모델 없음"은 **매장 간 통일 모델을 두지 않는다**는 뜻이며 **매장별 메뉴 분해(모델 ②)는 유지**. 이에 따라 ① 모델 ② v1 검증(`11_menu_decomposition.ipynb`, ai 브랜치): 후보 4개 사전 고정 평가에서 **최근 28영업일 합산 비중(S1) 채택** — TV 0.276·top-5 적중 73.1%, 요일 조건부는 5 fold 전패(요일은 총량의 문제 — 모델 ①의 몫). ② recommend **계약 v2(A안: 단일 호출)** 구현(ai `491f82b`): 서버 내부 ①(V1-t)×②(비중 분해)→점주 레시피 BOM 전개→재고·리드타임·안전재고 발주 참고치, 신뢰도 배지 전파. 구 forecast_results 입력 폐기. 테스트 13종 통과. 문서: `07_api_spec.md` §8 recommend v2(PR #20 동승), `11_ai_spec.md` §3 "모델 ② 확정"·§4 산출 구조·말미 미확정 목록 갱신, §3 정책 표 행 추가(본 PR). 잔여: 제품 spec "메뉴별 수요·추천발주" 표현 정리(참고치 성격 명시 — 담당자 검토).

**후속(같은 날) — 최신 모델 재비교 + MLflow 도입**: DNN 재평가 트리거 ④(Chronos covariates 릴리스) 발동 확인 → Chronos-2(2025-10)·TabPFN v2(Nature 2025)를 사전 등록 기준(M6.A9 동일: V1-t 대비 MAE −5% 개선 시 격상)으로 검증(`12_mlflow_model_comparison.ipynb`, ai 브랜치). **둘 다 기각** — Chronos-2+covariates +13.9%(covariates 효과 자체는 실재·bolt식 붕괴 해소), TabPFN v2 +29.0%(평시 fold 경쟁력이나 개강 fold 붕괴 — 문제의 난점은 표본 수가 아닌 비정상성임을 재확인) → **V1-t 유지, 트리거 ④ 소진**(model_spec §3 주석). 실험 관리 도구로 **MLflow 도입**(sqlite 백엔드, `AI/mlruns/` gitignore 로컬 전용 — 지표는 sMAPE·상대값만, Registry 등록은 기록용·서빙은 stateless 유지). **이어서 GBM 3사 그리드 서치**(가족별 자기 그리드 90조합 × 5 fold, `13_grid_search.ipynb`): XGB +10.2%·CatBoost +11.0%로 자기 튜닝 후에도 열세(라이브러리 격차 실재), LGBM 재탐색 −0.2% 동률(Optuna 채택값과 독립 수렴 — 파라미터 요행·과적합 가설 종결, 채택값 유지).

### 2026-07-28 (39차) — 화면 spec ↔ 라우팅 설계 정합 (디자인 핸드오프 준비)

와이어프레임 외주/디자인 핸드오프 준비 중 `04_feature_spec.md` §12(화면별 UI 구성)와 `10_frontend_design.md` §3(라우팅)·`05_user_flow.md` 간 불일치 3건 발견 → §12를 이미 확정된 정책(§1.2 이메일 로그인, 33차 검증 게이트·관리자 심사) 기준으로 정합. ① **§12.1 로그인/회원가입**: 이메일 로그인 필드 + `/register` 회원가입 화면 구성 추가(기존엔 소셜 버튼만 있어 §1.2·M3.B1 구현과 불일치) ② **§12.2 Step 1**: `/verify-business` 분리 게이트임을 명시 + 등록증 업로드 영역·PENDING 안내·반려 사유 표시 UI 추가(33차 정책 반영 누락분) ③ **§12.11 관리자 심사 신설**: `/admin` 심사 큐·등록증 뷰어·승인/반려 UI 구성(33차 "심사 큐 1화면" 화면 spec 부재 해소) ④ `05_user_flow.md` §9 IA에 회원가입·검증 게이트 주석·`/admin` 추가. **미확정(담당자 검토)**: 온보딩 진행 표시를 4단계 유지(현행, Step 1=검증 게이트로 노출)할지 검증 분리 후 3단계로 갤지 — 현행 유지로 기술함. ⑤ 디자이너 전달용 파생본 `docs/디자인_핸드오프.md` 추가 — 흐름·IA·화면별 구성 Mermaid 시각화, SSOT 아님(원본: user_flow·feature_spec §12·frontend_design §3), 원본 변경 시 함께 갱신.

### 2026-07-28 (38차 후속) — 멀티 호라이즌 풀링 실험 기각 + 다일 서빙 전략 확정 반영

배경: 담당자 확인으로 파일럿 5~7월 신규 매출분 부재 → 학습 표본 확대(영업일 ~250일)의 모델링 대안으로 **멀티 호라이즌 풀링(h∈{1,2,3} 학습 행 3배 + horizon 피처)** 을 사전 등록 규칙 하에 검증 fold 5개에서 1회 실험 — **기각**(D+1 sMAPE +2.6%p 악화, 개강 fold 2026-03 붕괴). 부수 진단으로 서빙(M7.A2)의 **h=1 단일 모델 재사용 전략이 h별 개별 모델보다 우위**임을 실측(서빙 기준 계단 MA-7 대비 D+1 -10.2/D+2 -4.1/D+3 -1.4%) → `predictor.py` 무변경 확정. 문서 작업: ① `11_ai_spec.md` §3에 "다일 서빙 전략 확정" 항목 추가(§1 계단은 h별 모델 기준임을 병기) ② §7 "학습 데이터 사용 방식 별도 확정 예정" 잔재를 expanding 확정(`11_ai_spec.md` §2 참조)으로 치환 ③ §3 정책 표 "AI 학습 데이터 확대 방향(38차 후속)" 행 추가(공공데이터 조사 결과 포함 — 행정동 집계류 부적합, KADX는 이후 접근 불가 확정). 실험 본체는 ai 브랜치 `06_enhancement.ipynb` §6(출력 제거 커밋).

**후속(같은 날) — 외부 검증 완료 (Kaggle Recruit 레시피 이식)**: 단일 매장 검증 한계 보완을 위해 V1-t 레시피를 서빙 동일 구성으로 Kaggle Recruit 일본 음식점 814곳에 동결 이식(`10_recruit_validation.ipynb`, ai 브랜치 — 데이터는 대회 규칙 동의 후 로컬 배치, gitignore). 사전 등록 기준(D+1 과반 승 + 상대 MAE 중앙값 ≤ −3%) **충족**: 승률 92.6%·중앙값 −10.1%(파일럿 −10.2%와 일치), Izakaya 95.9%, h=1 서빙 전략 D+3까지 유지, SHORT_HISTORY 60일 임계 실증(경계 불연속 59%→79%). `11_ai_spec.md` §3에 "외부 검증 통과" 항목 추가. **B단계도 완료(담당자 승인, 사전 선언 기준)**: ① pooling(기존 매장) 기각 — 글로벌 vs 매장별 승률 53.9%<55%, 매장별 fit-on-request 유지(stateless 서빙 설계 지지) ② cold-start 기준 충족 — 이력 10~59일 구간 글로벌 승률 72~79%·중앙값 −6~−7%(로컬 59.1%·−1.4%) → 다매장 확장 시 "신규 매장 첫 60일 global prior → 로컬 전환" 하이브리드 실증 근거(Chronos zero-shot의 GBM 대안, Phase 8+ 활성화·현 MVP 미적용). model_spec §3 외부 검증·DNN cold-start 메모 갱신.

### 2026-07-27 (38차) — AI M6.A2~A4 완료(ai 브랜치) + ml_pipeline §6 전처리 규칙 확정 반영

본 회차 문서 작업: ① `11_ai_spec.md` §6의 "별도 확정 예정" 2건(이상치 임계값·결측 보간)을 M6.A4 확정 규칙으로 치환 + 검증 분할(월 단위 walk-forward) 명문화 + 말미 미확정 목록 정리. ② §3 정책 표에 "AI 전처리 규칙 확정(38차)" 행 추가, "AI 미확정 항목" 행에서 확정분 제거. 모델링 산출물 본체는 ai 브랜치 M6.A2~A4 커밋(노트북 01~03 + `features_build.py`·`preprocess.py` — 공개 저장소 정책에 따라 실행 출력·매출 절대액 제외, 히스토리 재작성으로 커밋 SHA 변경됨)에 있으며 정책대로 Phase 6 마무리에 ai → main PR로 합류. EDA 핵심 발견(장기 휴업 후 낙곱새 업종 개편 = regime 변화)과 검수 대기 항목은 `AI/data/README.md` 참조.

**후속(같은 날) — M6.A5·A6 완료 + model_spec 갱신**: 베이스라인 12개 후보 비교(`04_baselines.ipynb` — MA-7이 순정 GBM·SARIMA 전부를 이기는 반전 후 비율 타깃 하이브리드가 역전) → 초기 모델 **LightGBM 비율 타깃 하이브리드(V1-t)** + 보조 MA-7 확정(`05_model_selection.ipynb`, Optuna 60 trials·test 재개봉 없음). `11_ai_spec.md` §2(비교 완료)·§3(초기 모델·라이브러리·1차 타깃=매장 일 매출)·§5(확정 피처 20열 참조)·§7(월 단위 walk-forward 구체화 + 평가 지표 MAE+sMAPE 확정·MAPE 제외)·말미 미확정 목록 갱신. §3 정책 표에 "AI 초기 모델 확정(38차)" 행 추가. plan의 "feature_spec §5.2 ROI 갱신" 참조는 현행 문서와 불일치(§5.2=예측 결과 조회, ROI=§8.2 [2단계])로 갱신 불요 판정. 담당자 확정(같은 날, 2차 조정): **AI 책임 = 매출 예측 + 고도화** — 메뉴 분해는 매장별 상이로 공통 모델 없음, 재료 리스트업은 점주 관리. §3 표·model_spec §3·§4 반영, 제품 spec 표현 정리는 담당자 검토로 이관. 남은 확인: 검수 3건.

**고도화(같은 날, `06_enhancement.ipynb`)**: ① 다일 선행 계단 실측 — D+1 -10.2%/D+2 -3.0%/D+3 +0.4%(vs MA-7) → 선행일별 신뢰도 차등 필수 ② P10/P90 예측 구간 채택(커버리지 78%) ③ 학습 윈도우 expanding 확정(rolling +15~17% 열세) — `11_ai_spec.md` §2 미확정 해소 ④ 앙상블·P50 대체 기각. model_spec §3에 다일·구간 반영.

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
- 문서: `research/ai/03` 상태 갱신(홍익대 URL·세담터 개편·날씨 확보·유동인구 대체) + `11_ai_spec.md` §4·§5 유동인구 정정 + `11_ai_spec.md` §5 + 본 §3·§5

### 2026-05-30 (36차) — Phase 4 BE+FE 본구현 + UX 정정 + OAuth 회귀 픽스 + /review·/qa

본 회차 문서 작업: ① §4 개발 이력에 **Phase 4 — POS·CSV 데이터 적재 구현** 항목 추가(BE M4.B1~B3 + FE M4.F1~F3 + 골든패스 + 10만 행 실측 + OAuth 회귀 픽스 + /review 픽스 포함). ② `04_feature_spec.md §4.4` + `07_api_spec.md §6` POST `/api/sales/upload`에 `auto_create_menus` 옵션·`auto_created_menus` 응답 필드·`skipped_reasons` 그룹화 정책 명시.

**UX 픽스 배경**: 매장 메뉴 미등록 상태에서 데모 CSV(3,000행) 업로드 시 모든 행이 매핑 실패로 빠져 `imported=0`이 되어 점주가 "업로드가 막힌다"고 체감. spec 정합 자체는 문제 없으나 시연 UX 결함. **A) auto_create_menus 옵션**(기본 `false`, true 시 카테고리 `"자동등록"`/단가 `total_price÷quantity`/`use_inventory_deduction=false`로 즉시 추가) + **C) skipped_reasons 그룹화**(메뉴별·ID별·DB 총건수) 적용.

**OAuth 회귀 픽스 배경**: 34차 `redirect_uri` proxy 통일 이후 `cd7c02f`(refresh `SELECT FOR UPDATE` race 픽스) 들어가면서 React StrictMode 이중 effect로 `refreshAccessToken` 동시 2회 호출 → 두 번째가 옛 토큰 revoke 후 401 → 부트스트랩 실패 → 로그인 화면 재진입(=재클릭 증상)로 재발. `Front/src/api/endpoints/auth.ts`에 module-scope in-flight Promise 공유 추가로 동일 탭 동시 호출 BE 1회로 합쳐짐. BE의 `SELECT FOR UPDATE`는 다른 디바이스/탭 보호용으로 그대로 유지. Vitest 가드(in-flight 공유 + 완료 후 새 promise) 2개 추가.

**/review 발견 P1·P2 픽스(8abb2b9)**: ① pandas `read_csv` + 청크 iteration + 행 정규화를 `asyncio.to_thread` 위임 — 10만 행 ~12s 동안 BE 워커 1개 다른 요청 못 받던 이벤트 루프 블록 해소(처리 시간 동일, 동시 사용자 보호). ② `auto_create_menus` 업로드당 200개 + 매장 전체 1,000개 상한 + 초과 안내 메시지. Menu 테이블에 `(store_id, name)` UNIQUE가 없는 상태에서 DoS·DB 부풀림 방지. ③ `CSVAdapter.normalize`에 메뉴명 100자(VARCHAR(100)) 초과 시 `SkipReason` 반환 — DB INSERT 시 청크 전체 롤백 방지.

**/qa 검증**: 실 브라우저 CDP + 실 BE/FE로 Phase 4 화면 동작 확인. M4.F1 설정 화면(`CSV 업로드 모드` 배지·템플릿/업로드 진입·[2단계] 안내), M4.F2 업로드 화면(드롭존·매핑 5인풋·체크박스·버튼 비활성) 정상. Live 업로드 `04_Demo_Data/sales_demo_30d.csv` + auto_create_menus=true → `imported=3,000 / skipped=0 / auto_created_menus=96`. 콘솔 401 1건은 부트스트랩 me 첫 호출 → ky 인터셉터가 refresh 후 재시도하는 정상 흐름.

**테스트**: BE pytest 36 / FE Vitest 29 / Playwright 8 — **전체 73개 통과**. dev 누계 13 커밋.

### 2026-05-30 (35차) — Phase 4 plan ↔ spec(CSV-only) 정합 + 화면 책임 분리 SSOT

Phase 4 진입 전 일관성 검토(plan-eng-review)에서 BE/FE plan이 CSV-only MVP 정책(`03_mvp_scope.md` §3·§4, `04_feature_spec.md` §4, `07_api_spec.md` §3, `research/backend/13_pos_adapter.md`, 19차 결정)과 충돌하는 것을 확인 — plan을 spec 기준으로 정정. ① **BE M4.B1**: `BARO V2 어댑터 실구현` → `CSVAdapter 구조 정리 + M3.B6 stub 유지(2단계 진입 전까지)`. 외부 POS API 어댑터(TossPlace·Kiwoom·OKPOS)는 [2단계] 명시. ② **FE M4.F1**: `자격증명 수정·연결 테스트 화면` → `연동 상태 표시 + CSV 템플릿 다운로드 + 업로드 화면 진입`(CSV 액션 허브). 자격증명 UI는 [2단계]로 이동. ③ **화면 책임 분리 SSOT**: 온보딩 Step 2 = 모드 선택만 / M4.F1 = CSV 액션 허브 / M4.F2 = 실제 업로드 — `04_feature_spec.md` §4.4의 "업로드 화면에서 템플릿 제공" 기존 문구는 본 35차로 일원화(중복·빈틈 방지). ④ **plan_gantt §4 `pos_be`/`pos_fe`** 행 문구를 위 정합에 맞춰 정정. **미해결**: M3.B6 stub 응답 스키마(dev 브랜치)와 `api_spec §3 GET /api/store/pos/status` 응답 정의 간 키/타입 대조 필요 — Phase 4 BE 본작업 첫 단계로 dev에서 확인.

### 2026-05-29 (34차) — 사업자 검증 게이트 구현·dev 통합 + OAuth redirect_uri 픽스

32·33차 문서 확정분을 코드로 구현(§4 34차 참조). 본 회차 문서 작업: ① §3 OAuth dev 운영 (d) 행에 `redirect_uri` proxy 경유(5173) 통일 + 콘솔 등록 의무 추가 ② §4 개발 이력에 34차(구현·통합·OAuth 픽스·수동 테스트) 추가 ③ `HANDOFF.md`를 검증 게이트 완료 상태로 갱신(다음 우선순위 = Phase 4 POS). `.env.example`의 OAuth redirect 기본값(5173)·설명 주석은 dev 브랜치에 커밋(코드 변경이라 main 릴리즈 때 동반).

### 2026-05-29 (33차) — 사업자 소유권 검증: NTS + 등록증 업로드 + 관리자 승인 (32차 확장)

실 사업자번호로 국세청 호출 테스트(460-07-03149 → 계속사업자) 결과, **NTS 조회는 사업자 실재·영업만 확인하고 가입자가 그 사업자의 주인인지(소유권)는 증명 못 한다**는 한계를 확인. 32차 설계(NTS 단독)를 소유권 검증까지 확장.

**상태 모델**: `business_verified`(boolean) → **`business_status` 4단계 enum**(`UNVERIFIED`→`PENDING`→`VERIFIED`/`REJECTED`). 검증 흐름: ① NTS 즉시 조회(실재·영업) → ② 사업자등록증 업로드 → `PENDING` → ③ 관리자 심사 → `VERIFIED`/반려 `REJECTED`.

**핵심 결정**: ① **온보딩 진입은 PENDING부터 허용(1-B)** — 관리자 승인을 기다리지 않고 진행, 사후 반려로 차단 ② NTS와 등록증+승인 **병행(2-A)** ③ 관리자 도입: `users.role`(OWNER/ADMIN, 운영자만 수동 지정), `/api/admin/*` ADMIN 가드, **심사 큐 1화면 + 승인/반려 + 등록증 열람**은 Phase 3에 포함, **사용자·매장 종합 관리도구는 Phase 11로** 후행. ④ 등록증 파일은 서버 볼륨 저장(DB엔 경로만), ADMIN 가드 하에서만 스트리밍. ⑤ 마스터 코드는 곧바로 `VERIFIED`.

**영향 문서**: `04_feature_spec.md` §1.2·§1.4, `07_api_spec.md` §2(login/me)·§3(verify multipart + `/api/admin/*` 신설), `08_schema.md`(users.role, stores.business_status·business_cert_path·business_reject_reason·business_reviewed_by), `09_service_design.md`(verify_business 업로드 + AdminVerificationService), `12_security.md` §2.4·§4.2(등록증 보관)·§5.1(ADMIN RBAC), `10_frontend_design.md` §3(/verify-business 업로드·/admin·상태 가드), `04_feature_spec.md`, `05_user_flow.md`·`06_sequence.md`·`02_usecase.md`, `plan/be`(M3.B8·B9)·`plan/fe`(M3.F9·F10)·`plan_gantt.md`(Phase 3·11). 코드(BE enum·업로드·admin, FE 업로드·admin 화면)는 후속 `feat/*` — 본 회차는 문서 확정. 32차에 만든 BE(`feat/be-verify`, boolean)는 enum으로 재작업 예정.

### 2026-05-29 (32차) — 사업자 검증을 온보딩 前 독립 게이트로 분리 + 마스터 코드

검증 호출이 이메일 `register`에만 있어 OAuth 가입자는 사업자 검증을 거치지 않던 불일치(spec 내부도 register-시점 vs 온보딩-시점 혼재)를 해소. 검증을 **인증 후·온보딩 진입 전 독립 단계**(`/verify-business`, `POST /api/store/business/verify`)로 통일하여 소셜·이메일 공통 적용.

**핵심 변경**: ① `register` 페이로드에서 `business_no`·`store_name` 제거(email·password·name만), 매장 행은 가입 시 빈 상태로 생성 ② `stores.business_verified` 컬럼 신설 + `business_no`·매장필드 nullable ③ 가드 순서에 `business_verified` 단계 추가(미검증 → `/verify-business`, 검증 전 온보딩 차단) ④ 검증 실패 시 계정 유지 + 재검증(미등록/형식 재입력·휴폐업 안내) ⑤ 시연용 마스터 코드(`NTS_MASTER_BYPASS_CODE`)로 국세청 호출 없이 강제 통과(운영 빈 값, 백도어로 `12_security.md` §2.4 명시) ⑥ 국세청 API는 odcloud(`api.odcloud.kr/api/nts-businessman/v1`), `.env`/`.env.example`에 `NTS_API_SERVICE_KEY`·`NTS_API_STUB_MODE`·`NTS_MASTER_BYPASS_CODE` 추가.

**영향 문서**: `04_feature_spec.md` §1.2·§1.4, `07_api_spec.md` §2·§3(verify 엔드포인트 신설), `09_service_design.md`(register 시그니처·`verify_business`), `08_schema.md`(stores), `06_sequence.md`, `05_user_flow.md`, `02_usecase.md`, `12_security.md` §2.4, `10_frontend_design.md` §3, `04_feature_spec.md`, `plan/be·fe/phase_03_auth.md`(M3.B8·M3.F9 신설). 코드 구현(BE 마이그레이션·verify 엔드포인트, FE `/verify-business`·가드)은 후속 `feat/*` 진행 — 본 회차는 문서·`.env` 확정만.

### 2026-05-28 (31차) — docs/plan/ai/ 신설 + plan_gantt §6 AI 트랙 색인 정렬

AI 트랙 plan 폴더가 부재했던 점을 30차 후속으로 보강. `be/`·`fe/`와 동일 형식의 6개 phase 파일 작성 + `plan_gantt.md` §6 색인 표에 "AI 파일" 열 신설.

**작성 방향 (사용자 지정)**: Phase 6 마일스톤은 **"데이터 수집 → EDA → 피처 관계 분석 → 모델 선정"** 순으로 분해. 모델 결정을 EDA·피처 분석 뒤로 명시적 후행화 — 30차 정합으로 모델 선정이 미확정인 상태에서 데이터·EDA 결과로 후보를 좁히는 흐름.

**신설 파일 (6)**

- `docs/plan/ai/phase_00_research.md` — M0.A1
- `docs/plan/ai/phase_02_infra.md` — M2.A1~A4 (AI Server 베이스·ML lib·Docker·env)
- `docs/plan/ai/phase_06_model.md` — M6.A1~A9 (데이터·EDA·피처·결측/이상치·모델비교·선정·XAI·신뢰도·DNN)
- `docs/plan/ai/phase_07_api.md` — M7.A1~A7 (REST API: forecast·recommend·xai·train·health)
- `docs/plan/ai/phase_12_hookup.md` — M12.A1~A6 (예측 근거 형태·임계값·n8n 규칙·평가 지표·XAI UI·회귀 검증)
- `docs/plan/ai/phase_13_release.md` — M13.A1~A5 (데모·성능·보안·CI/CD·모니터링)

**변경 (1)**

- `docs/plan/plan_gantt.md` §6 — Phase 색인 표 "AI 파일" 열 신설, Phase 6·7·12·13의 "AI 팀 영역, 본인 작업 아님" 빈 칸 채움. 마일스톤 ID 규칙에 `M{Phase}.A{n}` 추가.

브랜치: `docs/plan-ai-bootstrap` → PR → main (CLAUDE.md §4 정합).

### 2026-05-28 (30차) — research/ai/01·02 폐기 + spec 위임 표현 일괄 정리

`docs/research/ai/01_model_selection.md`(28곳) · `02_ml_pipeline_open_items.md`(13곳) 폐기. spec/plan/research 18개 파일에서 위임 문구를 일괄 제거하고 결정 대기 사항은 "별도 확정 예정" 또는 "AI 팀 확정"으로 약화 — 위임 위치 포인터(파일+섹션 ref)는 모두 제거. §3 정책 결정 이력의 "AI 미확정 → research 위임" 행은 정책 폐기 반영으로 갱신, "MVP 외부 데이터" 행은 03 조사 결과로 보강.

추가로 `docs/spec/11_ai_spec.md` §4·§5 와 `11_ai_spec.md` §5 입력 피처를 `research/ai/03_external_data_sources.md`(2026-05-24 조사, 24차) 정합으로 갱신 — 서울 생활인구→세담터, [조사 중]→[2단계] 분류, 학사일정/상가정보 추가.

**변경 파일**

- spec(10): `01_requirements/requirements·usecase_spec`, `02_mvp/mvp_scope`, `03_feature_design/feature_spec·feature_list`, `05_api/api_spec`, `06_database/schema`, `07_backend/service_design`, `08_ai/ml_pipeline·model_spec`
- plan(5): `be/phase_04_pos·08_n8n·11_dashboard·12_hookup`, `fe/phase_12_hookup`
- research/backend(3): `06_external_integration·08_async_pipeline·14_security_open_items`
- 인덱스(4): `docs/README.md` · `docs/research/README.md` · `docs/사주라_기술문서.md` · `PROGRESS.md` §3
- 삭제(2): `docs/research/ai/01_model_selection.md` · `02_ml_pipeline_open_items.md`

브랜치: `docs/cleanup-ai-research-01-02` → PR → main (`README.md` §5 · `CLAUDE.md` 핵심 규칙 ④ 정합).

### 2026-05-27 (29차) — dev 통합 검증(E단계) + 골든패스

§4 "Phase 3 — dev 통합 검증" 참조. 발견된 픽스 8건(BE 테스트 재작성 / BE Dockerfile dev extras / FE 빌드 파이프라인 vitest 3 업그레이드 / workbox-precaching / E2E 테스트 / arq healthcheck / 카카오 scope·email / Safari Vite proxy)을 `dev`에 7 commit으로 분리 푸시, PR #11(dev→be)·PR #12(dev→fe) 갱신.

**변경 파일**

- BE: `Back/tests/{__init__,conftest,auth_test}.py`(신규), `Back/pyproject.toml`(asyncio fixture loop scope), `Back/app/api/oauth.py`(scope·fallback 이메일), `Back/app/schemas/auth.py`(UserMeResponse.email)
- FE: `Front/package.json`(vitest 3·workbox-precaching) + `Front/pnpm-lock.yaml` + `Front/.gitignore`(test-results) + `Front/src/test/e2e/auth-onboarding.spec.ts` + `Front/vite.config.ts`(/api proxy)
- infra: `docker-compose.yml`(arq healthcheck) + `docker/be/Dockerfile`(`.[dev]` + `COPY Back/tests`) + `scripts/dev-up.sh`(신규) + `.gitignore`(.dev-fe.*)
- docs: `PROGRESS.md` 재구성(다이어트 + 개발 이력 §4 신설) + `HANDOFF.md` 갱신

### 2026-05-27 (28차) — Phase 3 사후 정리: 브랜치/HANDOFF/문서 작업 규칙 정합

§4 "Phase 3 사후 정리" 참조. 머지 완료 피처 브랜치 삭제 + HANDOFF slim down(50% 감축) + main 동기화 의무 규칙 신설(`README.md` §5, `CLAUDE.md`·`AGENTS.md` 핵심 규칙 ④).

### 2026-05-26 (27차) — Phase 3 인증·온보딩 구현 (BE M3.B1~B7 + FE M3.F1~F6)

§4 "Phase 3 — 인증·온보딩 구현" 참조. PR #7~#10으로 BE/FE 모두 통합 완료.

### 2026-05-25 (26차) — Phase 2 인프라 부트스트랩 + main 베이스라인 통합

§4 "Phase 2 — 인프라 부트스트랩" 참조. 3트랙 모두 main에 통합, 5개 장수 브랜치 동일 commit(`34dc58a`) 정렬.

### 2026-05-24 (25차) — `docs/plan/` 21개 phase 파일 정합성 audit

Q1~Q10 정정: spec 폴더 경로 정정·FE 알림 폴링 5분·POS stub 신설로 Phase 03 분리·BE phase_12 시작일 정정·데모 시나리오 9단계 SSOT·알림 채널 책임 분리(Slack 운영자 전용)·폴링/배치 시각 분산·산출물 비대칭 정합·미정의 항목 spec 참조 추가·SLA 강도 명확화. 21개 plan 파일 + `plan_gantt.md` 수정.

### 2026-05-23 (24차) — 외부 데이터 소스 조사 + Git 브랜치 전략

`docs/research/ai/03_external_data_sources.md` 신규 (조치원 홍익대 상권 특화). `README.md` §5 브랜치 전략 섹션 신설.

### 1~23차 audit 이력 (요약)

- **1~5차** (2026-05-06~07): 초기 spec 작성·일관성 검토 (`api_spec`·`schema`·`service_design`·`user_flow`·`sequence`·`mvp_scope`·`security`·`performance` 등)
- **2~13차** (2026-05-15~16): `research/backend/` 11개 카테고리 결정 일괄 진행 — 웹 프레임워크·앱 서버·리버스 프록시·데이터 계층·인증/암호화·외부 연동·캐시/관측·비동기/파이프라인·테스트/품질·배포·DI/유틸. 각 회차 결정은 §3 표로 추상화.
- **14~16차** (2026-05-16): `research/backend/12` 폐기 + `13_pos_adapter` 2단계 진입 가이드 재편. 보안 미확정 항목 정리(RBAC·감사 로그·logout-all·다중 디바이스). 종합 검증 + 책임 분리 정정(n8n=AI / ARQ=BE 도메인).
- **17~18차** (2026-05-16): `research/frontend/` 10+1개 카테고리(`11_observability.md` 신규). FE Sentry 결정·OAuth 콜백 응답 정정(200 → 302+Cookie)·인앱 폴링 5분 고정.
- **19차**: CSV-only MVP 정책 정합 + MVP/2단계 라벨 도입 + `10_frontend_design.md` FE spec 신설.
- **20차** (2026-05-16~17): 14개 미확정 AI 항목 → research 위임 + `prompts/` 폴더 폐기(`08_ai_handoff` + `consistency_check`).
- **21차** (2026-05-20): `plan_gantt.md` 골격·hookup 분할(Phase 12 AI hookup 신설), 14 Phase 구조.
- **22차**: AI research 일부 확정 (Regression / Walk-forward CV / IQR / 결측 보간 / 데이터 누수 방지).
- **23차** (2026-05-23): 캡스톤 ML 통합가이드 → `research/ai/00_ml_reference_guide.md` 이동.

> 각 회차 audit 영향 파일 목록은 `git log --follow --all <파일>` 또는 git blame으로 확인. spec/research 본문이 SSOT이므로 본 §5에는 차수·결정 사유만 남긴다.
