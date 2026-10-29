# 사주라 프로젝트 진행 현황

> 프로젝트 공통 현황만 담는다. 개인별 작업 이력은 §3의 이력 문서를 본다.

---

## 1. 전체 단계

| 단계 | 내용 | 상태 |
|------|------|------|
| 1. 요구사항 정의 | `docs/spec/01_requirements.md`, `02_usecase.md` | 완료 |
| 2. 설계 (기능·API·DB·백엔드·프론트·AI) | `docs/spec/` 전체 | 완료 |
| 3. 리서치 | `docs/research/` (backend·frontend·ai) | 완료 |
| 4. 구현 계획 | `docs/plan/` | 완료 |
| 5. 구현 | Phase 2·3·4·5·6·7·8(n8n 예측 배치, 날씨 미연결)·11·12·알림 BE 구현됨 / Phase 10(쿠팡 자동 담기)은 공용 상품·단가 계산 BE만, 담기 에이전트 구조로 재설계 후 재착수 | 진행 중 |
| 6. 테스트 & 배포 | Phase 13 — 자체 운영 서버(Mac mini) SSH 배포 | 예정 |

> Phase 5·9·11은 코드가 존재하나 `docs/plan/`의 마일스톤 대조는 아직 하지 않았다.
> 구현과 spec이 어긋난 지점은 2026-09-12~13 정합 검수로 확인했다. 목록과 처리 순서는 `HANDOFF.md`에 있다.

---

## 2. 정책 결정 이력 (요약)

세부 audit 결과는 spec/research 본문에 반영되어 있어 본 표에는 **현재 살아 있는 핵심 결정**만 한 줄로 추상화한다. 신규 결정은 표에 행을 추가하고, 폐기·번복 시 해당 행만 갱신한다. 회차별 상세 변경은 §3 이력 문서의 차수 항목과 git log 참조.

| 영역 | 결정 | 근거 위치 |
|---|---|---|
| 문서 구조 | spec(확정 사실) · research(spec 작성 위한 조사) · plan(구현 계획) 3폴더 분리 + research 하위 backend/frontend/ai 도메인 폴더. research는 조사·실측 관찰만 담고 결정(채택·선발·판정)은 넣지 않는다 — backend·frontend 24개 문서에서 결정 제거 (2026-10-28) | `docs/README.md` |
| spec 파일 구성 | 기본 설계(요구사항·유즈케이스·기능·흐름·비기능) · 구현 설계(MVP·시퀀스·API·DB) · BE · FE · AI 5개. 같은 사실은 한 곳에만, 미확정·2단계 상세는 두지 않는다 (2026-10-19) | `docs/README.md` §2 |
| MVP 데이터 | CSV 업로드 + POS API 연동(토스플레이스·키움페이·OKPOS 3사 한정, 코드 `TOSSPLACE`·`KIWOOM`·`OKPOS`). 2단계 항목은 상세 없이 한 줄 목록으로만 둔다 (2026-10-25 POS API를 2단계에서 MVP로 이동) | `docs/spec/02_implementation_design.md` §1, `01_basic_design.md` §3.4.3 |
| 쿠팡 자동 담기 | 서버 Playwright 폐기 → **사주라 브라우저 확장**이 점주 브라우저에서 수행, 서버는 쿠팡 자격증명을 보유하지 않는다 (2026-09-13). 확장은 Claude in Chrome처럼 **서버 LLM이 쿠팡 화면을 보고 정한 동작을 한 걸음씩 실행하는 에이전트** — 고정 셀렉터 방식과 '검색 결과를 모아 LLM 1회 선택' 방식 기각. 보기는 쿠팡용 요소 목록 하나(캡처·좌표 없음, 개인정보는 `---`), 동작은 요소 번호 클릭·입력·스크롤. 품목마다 새 대화(최근 요소 목록만 기록), 마지막에 장바구니 검수 1회(시작 전 장바구니 비교 없음, 수량은 결제 전 점주 확인). 반복은 PWA가 주도(`automate/start`·`step`·`finish`), LLM 대화는 BE와 분리한 **담기 에이전트 서버**(DB 없음). 공용 쿠팡 상품은 담기 중 본 상품 카드 전부로 갱신. 막을 위협은 판매자 지시문이 아니라 서버 LLM 오남용(비용·사적 이용) — 규칙(크기·횟수) → 로컬 분류기(어댑터 교체, 설정으로 켜고 끔) → LLM → 도구 호출만. LLM·분류기 호출 실패만 같은 요청 3회 재시도. 개발·시연 LLM은 대회 게이트웨이 `gpt-6-sol`·`medium` (2026-10-28) | `01_basic_design.md` §3.8, `03_be.md` §2.4, `04_fe.md` §12 |
| 시연 범위 | Phase 8(n8n 배치)·10(자동 담기)·13(통합 검증·배포) 모두 범위 안. 배포 대상은 자체 운영 서버(Mac mini) SSH. Phase 10은 착수 우선순위 최하 (2026-09-13) | `plan/04_gantt.md` §6 |
| 식자재 단가 | 단가 출처는 매장 공용 쿠팡 상품 테이블 하나 — 쿠팡 옵션(`itemId`) 하나당 한 행, `productId`·마지막 `vendorItemId`·상품명(첫 쉼표 앞)·옵션 이름(첫 쉼표 뒤)·판매가·로켓프레시·용량·공용 단가. 매장 정보·LLM 답한 값은 넣지 않는다. 담기 중 화면에 나온 상품 전부로 갱신. 판매가는 조건 없이 누구나 받는 표시 가격(부풀린 취소선 가격 때문에 정가 기준 폐기), 와우 회원 할인 상품은 판매가 갱신 안 함. 용량은 옵션 이름(없으면 상품명)의 기준 용량 × 옵션 이름 개수로 매번 계산(못 하면 비움). 공용 단가는 `판매가 ÷ 용량`이 쿠팡 단위가격 표시와 2% 이내일 때만 저장 — 사용자에게 보이는 값이라 보수적으로. 재고 품목 단가 = 공용 단가를 재료 단위로 환산, 안 되면 미설정(포장 수량 경로 폐기). 저장 판매가와 20% 이상 다른 값은 가격 후보로 보관하고 다른 매장 1곳이 20% 이내로 확인하면 반영(같은 매장 반복은 확인 아님, 후보 14일 만료). 판매가 규칙과 공용 단가의 관계는 미정. 점주는 단가를 입력·수정하지 않고, 입고 구매 금액은 단가를 바꾸지 않는다. 쿠팡 Open API·서버 크롤링·봇 우회 미사용. KAMIS는 홈 시세 참고만 (2026-10-29) | `01_basic_design.md` §3.3.1, `research/backend/15_coupang_price_validation.md`·`16_coupang_page_probe.md` §6 |
| 재고 차감 | 판매는 품목별 '차감 기준 시각'(마지막으로 차감한 판매 시각, 시작값은 품목 등록 시각) 이후 것만 FIFO 차감. 소비기한 없는 로트는 뒤에 입고일 순. 로트 금액은 구매 총액으로 저장 (2026-10-19) | `01_basic_design.md` §3.3.3 |
| 예측 저장 구조 | `forecast_results`(매장 일 매출·P10/P90·근거) + `forecast_menu_items`(메뉴 분해) 2테이블. 구 메뉴별 단일 테이블 폐기 (2026-09-13) | `02_implementation_design.md` §4.3.14·§4.3.15 |
| 배치 시각 | ARQ 소비기한 점검 01:30 / n8n 예측 배치 02:00 / ARQ 탈퇴 계정 파기 03:00 — 같은 호스트라 분산 (2026-10-03 파기 추가) | `01_basic_design.md` §3.3.6·§3.11.1, `01_basic_design.md` §5.2.1 |
| 웹 프레임워크 | FastAPI + Pydantic v2 + orjson | `03_be.md` §1 |
| 앱 서버 | Gunicorn + uvicorn.workers, 로컬 개발·운영 공통 (워커 4, --max-requests 1000, --preload). 로컬 개발도 운영과 같은 compose·이미지로 띄운다 (2026-10-25 dev Uvicorn 단독 폐기) | `03_be.md` §1·§15.2 |
| 리버스 프록시 | Caddy v2 (TLS 1.3 강제, FE dist를 caddy 이미지에 COPY) | `research/backend/03_reverse_proxy.md` |
| 데이터 계층 | SQLAlchemy 2.x async + aiomysql + PyMySQL(Alembic) + pandas + numpy + datetime+zoneinfo | `03_be.md` §1 |
| 인증·암호화 | Authlib + python-jose + passlib[bcrypt] + cryptography(AES-256-GCM) | `03_be.md` §7·§10 |
| OAuth 콜백 응답 | 302 Redirect to FE root + Set-Cookie refresh_token (Access Token 본문/URL 미노출, FE 첫 진입에서 `POST /api/auth/refresh`로 동기) | `02_implementation_design.md` §3.2, `02_implementation_design.md` §2.2 |
| 외부 연동 | httpx + tenacity + aiobreaker + BeautifulSoup4(lxml) + Playwright(Chromium 단일) | `03_be.md` §1 |
| 알림 | 점주 알림은 인앱 + Web Push(pywebpush, `notifications` 테이블). 이메일(fastapi-mail)은 탈퇴 파기 증빙만. Slack은 운영자 모니터링 전용 (2026-10-28 갱신) | `03_be.md` §4, `02_implementation_design.md` §4.3.22~§4.3.23 |
| 인앱 알림 폴링 | 5분 고정 (코드 상수, 사용자 설정 미노출) + 수동 새로고침 권장 — BE rate limit 보호 | `04_fe.md`, `research/frontend/06_pwa_push.md` |
| 캐시·관측 | Redis + redis-py(async) + structlog + asgi-correlation-id + Sentry(BE+FE 동일 release `git-<sha>`, PII scrubbing, traces 5%) | `03_be.md` §1, `03_be.md` §14.4 |
| 비동기 작업 분리 | n8n = AI 파이프라인(외부 데이터 수집·AI Server 호출). ARQ cron_jobs = BE 도메인 정기 작업(소비기한 점검 등). BackgroundTasks = 짧은 후처리 | `research/backend/08_async_pipeline.md` §1 |
| 알림 발송 규칙 | 한 건의 단위 — 소비기한은 품목·조건, 재고 부족은 품목, 이상치는 업로드 한 번, 예측 완료는 매장. 소비기한은 D-3·D-1·초과 첫날에 한 번씩(초과를 매일 반복하지 않음), 같은 날 재실행은 건너뜀. 알림 설정 4묶음(소비기한 임박·재고 부족·예측 완료·이상치), 끈 묶음은 인앱·푸시 모두 만들지 않음 (2026-10-28) | `01_basic_design.md` §3.3.6·§3.12, `02_implementation_design.md` §3.10 |
| 알림 송출 단일 경로 | BE `NotificationService.create_and_push`만 사용. n8n은 BE API 트리거만, DB `notifications` 직접 INSERT 금지 | `02_implementation_design.md` §4.5 n8n_user 권한 |
| 테스트·품질 | pytest + pytest-asyncio + pytest-cov + factory_boy + Faker + testcontainers + respx + ruff + mypy + bandit + pip-audit + pre-commit | `research/backend/09_testing_quality.md` |
| 배포 | uv + Docker + Docker Compose(V2) 6서비스 + Buildx 멀티아키 + GitHub Actions + Trivy | `research/backend/10_deployment.md` |
| ID·시간·전화 | UUIDv4 + datetime+zoneinfo + phonenumbers NATIONAL 형식 | `02_implementation_design.md` §4.3.3 stores |
| Frontend 스택 | React 19 + Vite 6 + TS strict + React Router v7 + Zustand 5(auth 메모리·prefs persist 분리) + TanStack Query v5 + ky 1.x(401 단일 refresh 인터셉터) + openapi-typescript + Tailwind v4 + shadcn/ui + RHF + zod + Recharts + vite-plugin-pwa(injectManifest) + @sentry/react | `04_fe.md` |
| Git 브랜치 전략 | GitHub flow — 장수 브랜치는 `main` 하나. 짧은 작업 브랜치(`feat/`·`fix/`·`docs/`·`chore/`) → main PR, 머지 후 자동 삭제. 담당자(h-taek)는 직접 푸시 또는 PR, 그 외 PR 필수. 구 장수 브랜치 `dev`·`be`·`fe`·`ai` 폐기 (2026-10-03) | `README.md` §5 |
| 작업 전 main 동기화 | 코드·문서 수정 전 `git pull --ff-only origin main` 의무. 워크트리 미사용 | `README.md` §5, `CLAUDE.md` 규칙 5 |
| AI 미확정 항목 | 평가 지표·예측 근거 산출 방법·DNN 도입 여부·학습 데이터 사용 방식·신뢰도 임계값·재학습 교체 기준 — AI 팀 확정 시 spec에 직접 반영. spec/plan은 "별도 확정 예정"으로 표기 (30차 research 위임 폐기). ~~결측 보간·이상치 임계값~~은 38차 확정 → 아래 행 | 각 spec 본문 (`05_ai.md` 등) |
| AI 일부 확정 (22차) | Regression 방식 + Walk-forward CV + IQR 우선/Z-score 보조(임계 계수 probe 후) + 데이터 누수 방지 원칙. 모델 자체는 미확정 유지 | `05_ai.md` §3·§6, `05_ai.md` §5 |
| MVP 외부 데이터 (30차 확정) | 03 조사로 확정 — 기상청 단기예보·과거 기상·공휴일·홍익대 학사일정 [필수]; 세담터 유동인구·소상공인 상가정보 [권장]; 배달상권 [선택]. [2단계]: SK 지오비전·ECOS·네이버 데이터랩. 세종 조치원 홍익대 상권 기준 | `05_ai.md` §4 + `research/ai/03_external_data_sources.md` |
| 보안 정책 | RBAC MVP 단일 역할 점주 / 감사 로그 1년 보관·`ops_readonly` 조회·append-only / 다중 디바이스 자체 토큰 / 강제 로그아웃 `POST /api/auth/logout-all` 채택 / 결제는 쿠팡 자체 수행(사주라 미경유·미저장) | `03_be.md` §7·§8, `research/backend/14_security_open_items.md` |
| 데모 시나리오 | 9단계 SSOT — 1.로그인 2.온보딩 3.CSV 4.메뉴·재고·판매 5.n8n야간예측 6.수요예측 7.추천발주 8.대시보드·알림 9.쿠팡자동주문 | `docs/plan/01_be.md` |
| OAuth dev 운영 (29차) | (a) 카카오 scope에서 `account_email` 제거 — 동의항목 미검수 환경 대응. (b) fallback 이메일은 `{provider}_{id}@social.example.com` (valid TLD). (c) `UserMeResponse.email`은 `str` (register/login 입력 검증만 `EmailStr`). (d) Vite dev proxy `/api → BE`로 FE/BE 같은 origin 통합 + **OAuth `redirect_uri`도 proxy 경유(`localhost:5173/api/auth/callback/*`)로 통일(34차)** — Safari ITP cross-site cookie 차단 회피. 콜백을 BE:8000으로 직접 보내면 refresh 쿠키가 cross-site로 설정돼 첫 로그인이 차단(2회 클릭 필요)되던 문제 해결. **OAuth 콘솔(Google/Kakao) 승인 redirect URI에도 5173 주소 등록 필요** | `Back/app/api/oauth.py`, `Back/app/schemas/auth.py`, `Front/vite.config.ts`, `.env.example` |
| FE 자체 로그인·회원가입 (29차) | spec(`01_basic_design.md` §3.1.2)·BE(9개 라우터 + auth_test 12개)는 정상이나 27차 phase_03 작성 시 FE 마일스톤이 누락되어 OAuth 화면만 노출. `docs/plan/02_fe.md` M3.F8로 명시화하고 **다음 단계로 즉시 진행**. | `docs/plan/02_fe.md` M3.F8, `01_basic_design.md` §3.1.2, `HANDOFF.md` |
| 사업자 검증 = 온보딩 前 독립 게이트 (32차) | 사업자 검증을 회원가입에 묶지 않고 **인증 후·온보딩 진입 전 독립 단계(`/verify-business`, `POST /api/store/business/verify`)**로 분리 — 소셜·이메일 계정 공통 적용(기존엔 이메일 register에만 있어 OAuth 갭). `register`는 email·password·name만 받고 매장 행은 빈 상태로 생성. `stores.business_verified` 플래그 + `business_no`/매장필드 nullable. 검증 실패 시 **계정 유지 + 재검증**(미등록/형식 재입력·휴폐업 안내), 가드가 미검증자 온보딩 차단. 시연용 마스터 코드(`NTS_MASTER_BYPASS_CODE`)로 강제 통과 가능. **33차에서 상태 모델·소유권 검증으로 확장됨** | `01_basic_design.md` §3.1.4, `02_implementation_design.md` §3.3 등 |
| 사업자 소유권 검증 = NTS + 등록증 + 관리자 승인 (33차) | NTS 조회는 사업자 실재·영업만 확인하고 **소유권은 증명 못 하는 공백**을 보완. ① NTS 즉시 조회 ② **사업자등록증 업로드** → `PENDING` ③ **관리자 승인**(`/admin` 심사) → `VERIFIED`/반려 `REJECTED`. `business_verified`(boolean) → **`business_status` 4단계 enum**. **PENDING부터 온보딩 진입 허용(1-B)**. `users.role`(OWNER/ADMIN) 신설, 관리자 최소 심사(`/api/admin/*`)는 Phase 3 포함·종합 관리도구는 Phase 11로. 등록증 파일은 서버 볼륨 저장(DB엔 경로), ADMIN 가드 하에서만 조회. 마스터 코드→곧바로 VERIFIED | `01_basic_design.md` §3.1.4, `02_implementation_design.md` §3.2·§3.3, `02_implementation_design.md` §4(users.role·stores.business_status·cert), `03_be.md`(AdminVerificationService), `03_be.md` §7.4·§10.2·§8.1, `04_fe.md` §3, `plan/01_be.md`·`plan/02_fe.md`(M3.B8·B9·F9·F10), `04_gantt.md` |
| AI 학습 데이터 수집 경로 (37차) | **모델링(Phase 6) 학습용 수집은 오프라인 우선**: 날씨=기상자료개방포털 **다운로드 CSV**(세종 AWS 4관측소 2020~2026.05, API 미사용) / 공휴일=`holidays` 패키지 오프라인 생성+수동 보정 / 학사일정=수동 정리 CSV(검수제) / 판매=실매장 매출리포트 복호화(2025-04~2026-04 확보). **API(기상청 단기예보·KASI 등)는 운영 배치(Phase 8 n8n) 전용**. **유동인구는 세담터에서 시간대별 데이터셋 미확보 → 세종시 행정동별 월간 생활·유동인구 리포트로 대체**(조치원읍, 월 단위 — 일별 조인 시 전월 lag, 누락 월 보간은 M6.A4). 원본·가공 데이터는 git 제외(`AI/data/raw·processed`), 수동 소스만 추적 | `AI/data/README.md`, `docs/research/ai/03_external_data_sources.md`, `05_ai.md` §4 |
| AI 전처리 규칙 확정 (38차) | 타깃 이상치 = **log1p IQR k=3.0** train-fit winsorize(파일럿 개입 0건 — raw·k1.5·P1/P99는 실수요 오탐으로 기각) · 결측 = 기상 선형 보간 / 유동인구 전월 **ffill+staleness**(선형 보간은 미래 월 참조라 금지) / lag 워밍업 NaN은 트리=네이티브·선형계=완비 행만 · 검증 분할 = **월 단위 walk-forward**(검증 fold=영업일 ≥10일 월, 최종 fold test 봉인, 휴업 월 자동 배제). 유동인구 피처는 ablation 악화(+1.2%)로 모델 1군 제외 | `05_ai.md` §5 + `AI/notebooks/03_preprocessing.ipynb` + `AI/data_prep/preprocess.py` (ai 브랜치) |
| AI 초기 모델 확정 (38차) | 주 모델 = **LightGBM 비율 타깃 하이브리드**(타깃 log1p(일 매출)−log1p(7영업일 평균) — 수준은 이동평균·편차만 학습, keep 20열, Optuna 튜닝) + 보조 baseline **MA-7**(fallback·drift 감시). 순정 GBM·SARIMA·XGBoost·CatBoost는 MA-7도 못 이겨 기각 — 하이브리드만 유의미 우위(봉인 test sMAPE 30%·MA-7 대비 -19.6%). 평가 지표 **MAE(주)+sMAPE(보고), MAPE 제외**(소액일 왜곡 정정), 운영 목표 naive-요일 skill ≥+15%·MA-7 우위 유지(drift 경보선). **AI 산출 범위 확정(담당자): 매출 예측(+고도화)까지가 AI 책임** — 메뉴별 수요는 매장별 믹스 상이로 공통 분해 모델 없음(접근은 Phase 7), 재료 리스트업은 점주 관리(자동 산출 아님). 제품 spec의 "메뉴별 수요·추천발주" 표현 정리는 담당자 검토 항목 | `05_ai.md` §3·§2·§4·§6 + `AI/notebooks/04_baselines.ipynb`·`05_model_selection.ipynb` (ai 브랜치) |
| AI 모델 ② 메뉴 분해 확정 (39차) | 산출 구조 = **2모델**(담당자 정정 — "공통 모델 없음"은 매장 간 통일 모델 부재의 뜻, 매장별 분해 유지): 모델 ① 매출 예측(V1-t) + **모델 ② 매장별 메뉴 비중 분해 = 최근 28영업일 합산 수량 비중(S1)** — 요일 조건부는 검증 5 fold 전패로 기각(요일은 총량의 문제). recommend는 **계약 v2(A안 단일 호출)**: 서버 내부 ①×②→점주 레시피(BOM) 전개→재고·리드타임 발주 참고치 + 신뢰도 배지 전파. 재료 리스트업(레시피 등록)은 점주 관리 유지 | `05_ai.md` §3·§2 + `02_implementation_design.md` §3.8 + `AI/notebooks/11_menu_decomposition.ipynb`·`AI/app/model/decompose.py`·`AI/app/api/orders.py` (ai 브랜치) |
| AI 학습 데이터 확대 방향 (38차 후속) | **파일럿 5~7월 신규 매출분 부재 확인(담당자)** — 전향적 검증 불가. 모델링 트릭에 의한 유효 표본 확대는 **멀티 호라이즌 풀링(학습 행 3배) 실험 기각**(사전 등록 규칙 — D+1 +2.6%p 악화·개강 fold 붕괴)으로 종결, 부수 진단에서 **서빙의 h=1 단일 모델 재사용 전략이 h별 개별 모델보다 우위**로 확인(서빙 무변경 확정, MA-7 대비 D+1 -10.2/D+2 -4.1/D+3 -1.4%). 남은 확대 레버 = 실데이터: ① 2025-04 이전 과거분 소급(점주 문의) ② 유사 매장 확보 시 통합 학습. **외부 검증은 Kaggle Recruit로 완료(사전 기준 충족 — 814곳 승률 92.6%·중앙값 −10.1%, SHORT_HISTORY 60일 임계 실증)**; KADX 영수증별 POS는 접근 권한 없음 확정, 행정동 집계류 공공데이터는 부적합 판정 | `05_ai.md` §3·§6 + `AI/notebooks/06_enhancement.ipynb` §6·`10_recruit_validation.ipynb` (ai 브랜치) |
| 발주 저장 구조 | spec 5테이블(`order_recommendations`·`order_recommendation_items`·`orders`·`order_items`·`order_approval_logs`) 사용, `purchase_orders` JSON 스냅샷 폐기. 확정 요청은 `recommendation_id`로 추천안을 지목하고, 추천안 없는 발주는 `null` (2026-10-03). 추천안 하나에 발주 하나 — 재확정 409. 확정 단가는 서버가 정하고 미설정이면 단가·소계 null (2026-10-28) | `02_implementation_design.md` §3.7 |
| 발주 입고 처리 | 발주 품목마다 입고 대기 → 입고 완료(로트 생성)·입고 안 함. 품목당 1회 처리, 덜 온 양은 추적 안 함. 입고 예정량 = 입고 대기 수량 합계로 추천량에서만 뺀다(소진 예상일은 현재고 기준) (2026-10-28) | `01_basic_design.md` §3.7.2·§3.7.5 |
| 발주 추천 단일화 | 발주 추천은 수요예측 기반 추천 하나만 둔다. 재고 부족 기준 기반 임계값 추천(`GET /api/inventory/reorder-suggestions`)은 폐기. 저장된 예측이 없으면 대체 추천 없이 수동 실행을 안내 (2026-10-25, 안내 2026-10-28) | `01_basic_design.md` §3.7, `04_fe.md` §4.9 |
| 매출 집계 API | 기간별 매출은 `GET /api/sales/trends` 하나로 조회(일·주·월, 매장 전체 또는 메뉴별, 빈 구간 0). 인기 메뉴는 `GET /api/sales/top-menus`, 요약은 `GET /api/sales/summary`(누계·이번 달·오늘, 마지막 판매 시각 기준) (2026-10-25) | `02_implementation_design.md` §3.6 |
| 재고 차감 = 레시피 필수 | 재고 차감 ON 메뉴는 항상 재고 목록 재료로 된 레시피(재료 1개 이상)를 가진다. 메뉴는 OFF로 등록하고 레시피 저장 후 켠다. ON 상태에서 레시피 비우기·삭제 불가(`MENU_RECIPE_REQUIRED`). 미입력 경고 개념 폐기 (2026-10-25) | `01_basic_design.md` §3.2 |
| BE·FE 책임 경계 | BE는 저장·수집한 값을 가공 없이 전달. 예외는 FE로 다 보낼 수 없는 집계(판매 추세)와 서버가 스스로 하는 판단(알림 발송·발주 계산·판매 차감). 정렬·경고 표시·D-n·개수 세기는 FE. 공통 기준값은 spec 한 곳. 재고 목록은 전체 반환·판정값 없음, `/api/inventory/summary`·`/alerts` 폐기 (2026-10-25) | `03_be.md` §2, `04_fe.md` §4.6·§7.0 |
| 사업자 검증 게이트 BE 강제 | 매장 데이터 API는 `business_status` ∈ {PENDING, VERIFIED}이고 탈퇴 유예가 아닐 때만 통과, 상태는 요청마다 DB 조회해 관리자 반려가 즉시 반영 (2026-10-03) | `03_be.md` §8.1 |
| 회원 탈퇴 | 탈퇴 즉시 로그인 차단·철회 없음, 유예 30일 동안 같은 계정 재가입 불가, 파기 뒤 증빙 이메일 (2026-10-03, 이메일 2026-10-28) | `01_basic_design.md` §5.2.1 |
| 재고 경고 표시 | 상태 배지 없음 — 정렬로 볼 수 있는 값에 UI를 덧대지 않는다. 경고는 한 단계: 소비기한 D-3 이내(지난 것 포함)면 기한 글씨, 확인 필요·기준 이하·0이면 수량 글씨를 빨갛게 (2026-10-28) | `04_fe.md` §4.6 |
| 메뉴 관리 화면 | 레시피 관리를 메뉴 관리(`/menus`)로 바꿔 판매가·레시피를 한 화면에서 받는다. 단가 관리 화면은 폐지 — 재료 단가는 발주 추천에서 보인다 (2026-10-28) | `04_fe.md` §4.5 |
| AI 서버 수정 범위 | AI 팀원 담당은 예측 모델·학습까지. AI 서버의 API·스키마 코드는 BE 담당이 직접 고친다 (2026-10-28) | — |
| 예측 배치 책임 분리 | n8n은 모델 예측만 — 입력 조회·외부 데이터·AI 예측(매출 + 대상일별 메뉴 수량)·예측 저장·실행 기록·Slack. 추천발주는 산식이라 BE가 점주 요청 시 저장된 예측과 그 시점 재고로 계산(AI `/ai/orders/recommend` 폐지). 수동 실행은 BE가 n8n 웹훅으로 매장 하나 실행, 예측 완료 알림은 n8n → BE 내부 API (2026-10-28) | `01_basic_design.md` §3.7.2·§3.11.1, `05_ai.md` §2 |
| 추천 수정안 저장 폐지 | 확정 전 수정값은 서버에 저장하지 않는다 — 확정 버튼이 저장 시점. `PATCH /api/orders/recommend`·`adjusted_quantity` 삭제. 화면을 나가도 남기려면 FE 브라우저 저장소 (2026-10-28) | `01_basic_design.md` §3.7.4 |
| 대시보드 API | 대시보드 전용 API는 날짜별 예측 매출 vs 실제 매출(`GET /api/dashboard/forecast-vs-actual`) 하나. 매출 추이·메뉴 비중은 판매 집계 API를 쓴다. 요약(`GET /api/dashboard`)·폐기 현황(`/waste`)·대시보드 캐시 삭제 (2026-10-28) | `02_implementation_design.md` §3.9 |
| 날씨 입력 | 날씨는 매장 위치 기준 — 어제까지 기상청 ASOS 일자료(최근접 관측소), 오늘 이후 단기예보(매장 격자). 위치는 주소 저장 시 BE가 Google Geocoding으로 계산해 `stores`에 둔다. 관측 날씨는 n8n이 관측소·날짜 단위로 `weather_observations`에 쌓고 없는 날짜만 받는다(예보는 저장 안 함). 위치 없음·호출 실패는 날씨 없이 예측 (2026-10-28) | `01_basic_design.md` §3.11.1, `02_implementation_design.md` §4.3.3·§4.3.25 |
| 매출 CSV 재업로드 dedup 정책 (2026-08-17) | `UNIQUE(store_id, source, external_sale_id)`는 MySQL에서 NULL끼리 서로 다르게 취급되어, 영수증번호 컬럼 없이(FE 기본값) 업로드한 CSV는 재업로드 시 DB 레벨 중복 방지가 전혀 동작하지 않는다 — 실사례로 소주 8,984개가 98,824개(11배)로 중복 적재. `external_sale_id`가 NULL이면 `(menu_id, sold_at)` 합성 식별자를 만들어 같은 UNIQUE 제약 경로를 타도록 애플리케이션 레벨에서 정규화(스키마 변경 없음) | `Back/app/services/sale_service.py` `_insert_chunk` |

---

## 3. 이력 문서

완료 이력은 담당자별로 나눠 보관한다. 최신이 위로 오는 역시간순이다.

| 문서 | 담당자 | 담당 범위 |
|---|---|---|
| [PROGRESS_HT.md](PROGRESS_HT.md) | 임형택 | Backend + Frontend + 문서·플랜 운영 |
| [PROGRESS_DW.md](PROGRESS_DW.md) | 정동욱 | AI 모델링 — 모델 선정·전처리·서빙·AI spec |
| [PROGRESS_MW.md](PROGRESS_MW.md) | 이민욱 | AI 모델링 |
| [PROGRESS_CH.md](PROGRESS_CH.md) | 서창현 | Backend + Frontend — 8월 리디자인·실데이터 연동 |

새 항목은 본인 문서에 쓴다. 새 정책·방향 결정은 사람과 무관하므로 위 §2에 쓴다.
