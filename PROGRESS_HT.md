# 진행 이력 — 임형택 (HT)

> 담당: Backend + Frontend + 문서·플랜 운영
> 프로젝트 공통 단계·정책 결정은 [PROGRESS.md](PROGRESS.md)를 본다.
> 최신이 위로 온다(역시간순).

---

## 1. 개발 이력

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

---

## 2. 문서 수정 이력

### 2026-09-12 — 코드 ↔ 문서 전수 재검증 + 구 문서 참조 갱신

구조 정합 직후 코드와 문서를 다시 전수 비교했다. 평탄화 당시 `*.md` 안의 참조 1,083곳만 갱신하고 **코드 주석·docstring은 빠뜨린 것**이 드러났다.

**참조 갱신 (dev `0d597ec`, 80파일)**: 구 문서명 99곳 → 번호 접두 이름. `model_spec`·`ml_pipeline` 참조는 합본 절 번호로 재매핑(`model_spec §9` → `11_ai_spec.md §8`, `ml_pipeline §10` → §10). `service_design §4`는 plan 이관분을 직접 가리키게 변경. 삭제된 plan 파일 참조 7곳·구 폴더 경로 3곳 제거. `playwright.config.ts`의 "CI 6단계" → 8단계. 변경은 전부 주석·docstring이고 실행 코드는 무변경(py_compile 통과, 참조 문서 경로 17종 실존 확인).

**문서 측 잔여 (main)**: `.md` 없이 이름만 쓴 참조 8곳(`07_api_spec.md` 5·`04_feature_spec.md`·`05_user_flow.md`·`plan/01_be.md`) 갱신. `plan/03_ai.md`의 `../spec/08_ai/` 깨진 링크 1건 수정. PROGRESS 계열의 구 문서명은 이력 서술이라 그대로 둔다.

**검수 결과**: 엔드포인트 spec 79 / 구현 57 — 문서에 있고 미구현 32건(notifications 6·inventory 로트계 7·orders 추천계 5·dashboard 3·pipeline 3·sales 3·data 2·forecast 2, 쿠팡 automate 제외), 구현됐으나 문서에 없는 것 11건(KAMIS `prices/ingredients`·매출 집계 5종·`orders/confirm` 등). DB 23테이블 전부 존재하나 ORM은 10개. `purchase_orders` 테이블과 `inventory_items.current_quantity`가 `08_schema.md`에 없음. 미설치 스택: fastapi-limiter(Rate Limit 전무)·pywebpush·fastapi-mail·slack_sdk / Authlib은 설치만 되고 미사용(OAuth는 httpx 수기). `.github/workflows` 없음. `types.gen.ts`는 3줄 스텁. 상세는 `HANDOFF.md` §2.

**문서끼리 어긋난 것**: 예측 조회 경로 3방향(spec `GET /api/forecast` / plan `…/demand` / 코드 `…/predict`), 추천발주 수정 `PATCH`(spec) ↔ `PUT`(plan), 소비기한 cron 02:00(spec 6곳) ↔ 01:30(`plan/01_be.md` M5.B3, 같은 파일 메서드 표는 02:00), `plan/01_be.md`에 범위 밖 서비스 3개(Automation·SiteScraping·Pipeline) 잔존, `04_gantt.md` §2~§5가 §6의 '범위 밖' 표시와 불일치, `03_mvp_scope.md`가 쿠팡 자동화를 MVP `O`로 유지.

### 2026-09-12 — 문서 구조 정합: spec 평탄화 · plan 합치기 · PROGRESS 분할

`CLAUDE.md` 문서 규칙(파일명 `순번_이름.md`, spec에 실측치·구현 방법 금지, 덧대지 않는다)과 어긋난 구조를 일괄 정리했다. 구현에는 손대지 않았다.

**spec** 16파일 9폴더 → 13파일 0폴더. 폴더 번호 07이 backend/frontend로 중복되던 것도 해소. 흡수 3건 — `erd` → `08_schema` §7~§10, `feature_list` 분류표 → `04_feature_spec` 선두 절, `model_spec`+`ml_pipeline` → `11_ai_spec`. `09_service_design` §4 서비스별 주요 메서드(176줄·시그니처 85행)는 구현 분해라 `plan/01_be.md`로 이관하고 §번호는 포인터로 유지(참조 212곳 보호).

**AI spec 합치기**: `model_spec`과 `ml_pipeline`이 입력·학습·출력·예측근거 4쌍을 거울처럼 중복해 "초기 모델 확정 ↔ 미확정" 모순이 생겨 있었다. 한 문서로 합치고 실측치·기각 이력을 research로 이전 — `research/ai/01_model_selection.md`(신설, 30차에 폐기한 파일명 재사용 — 내용은 무관) · `02_preprocessing.md`(신설). §참조 61곳은 평탄화 직전 커밋의 줄 내용을 키로 원본 문서를 판정해 재매핑했다.

**plan** 28파일 → 4파일. 졸업 시연 범위 확정으로 실행되지 않는 계획 5개(phase_08·10·13) 폐기 후 트랙별 합침 — `01_be`·`02_fe`·`03_ai`·`04_gantt`.

**PROGRESS** 413줄 1파일 → 공통 92줄 + 담당자별 4개(HT·DY·MY·CH). 귀속은 커밋 작성자로 판정. §4 개발 이력 순서를 역시간순으로 정정하고 §1 전체 단계 표를 실제 구현 범위로 현행화.

**폐기 6건**: `docs/사주라_기술문서.md`(1,415줄 — spec 중복 + 과제 제출용 분석은 3분류 밖), `디자인_핸드오프.md`, `research/README.md`·`frontend/README.md`(3중 인덱스), `research/ai/00_ml_guide_reference.md`(외부 전재 1,189줄), `research/SUMMARY.md`(spec이 근거로 참조하는 SSOT 역전).

**연동 수정**: 참조 1,083곳 + AI §참조 61곳 갱신. `docs/README.md` 전면 재작성, `CLAUDE.md`·`AGENTS.md`가 20차에 폐기된 `docs/spec/prompts/08_ai_handoff.md`를 읽으라고 지시하던 것 정정 + 팀원 저작 문서 규칙 신설, `04_gantt.md` §6 색인 재작성.

검증: 깨진 마크다운 링크 0건, 옛 파일명 참조 0건(이력 서술 제외), `NN_NN_` 이중 접두 0건. docs 76파일 18,449줄 → 44파일 약 14,900줄.

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

**영향 문서**: `04_feature_spec.md` §1.2·§1.4, `07_api_spec.md` §2(login/me)·§3(verify multipart + `/api/admin/*` 신설), `08_schema.md`(users.role, stores.business_status·business_cert_path·business_reject_reason·business_reviewed_by), `09_service_design.md`(verify_business 업로드 + AdminVerificationService), `12_security.md` §2.4·§4.2(등록증 보관)·§5.1(ADMIN RBAC), `10_frontend_design.md` §3(/verify-business 업로드·/admin·상태 가드), `04_feature_spec.md`, `05_user_flow.md`·`06_sequence.md`·`02_usecase.md`, `plan/be`(M3.B8·B9)·`plan/fe`(M3.F9·F10)·`04_gantt.md`(Phase 3·11). 코드(BE enum·업로드·admin, FE 업로드·admin 화면)는 후속 `feat/*` — 본 회차는 문서 확정. 32차에 만든 BE(`feat/be-verify`, boolean)는 enum으로 재작업 예정.

### 2026-05-29 (32차) — 사업자 검증을 온보딩 前 독립 게이트로 분리 + 마스터 코드

검증 호출이 이메일 `register`에만 있어 OAuth 가입자는 사업자 검증을 거치지 않던 불일치(spec 내부도 register-시점 vs 온보딩-시점 혼재)를 해소. 검증을 **인증 후·온보딩 진입 전 독립 단계**(`/verify-business`, `POST /api/store/business/verify`)로 통일하여 소셜·이메일 공통 적용.

**핵심 변경**: ① `register` 페이로드에서 `business_no`·`store_name` 제거(email·password·name만), 매장 행은 가입 시 빈 상태로 생성 ② `stores.business_verified` 컬럼 신설 + `business_no`·매장필드 nullable ③ 가드 순서에 `business_verified` 단계 추가(미검증 → `/verify-business`, 검증 전 온보딩 차단) ④ 검증 실패 시 계정 유지 + 재검증(미등록/형식 재입력·휴폐업 안내) ⑤ 시연용 마스터 코드(`NTS_MASTER_BYPASS_CODE`)로 국세청 호출 없이 강제 통과(운영 빈 값, 백도어로 `12_security.md` §2.4 명시) ⑥ 국세청 API는 odcloud(`api.odcloud.kr/api/nts-businessman/v1`), `.env`/`.env.example`에 `NTS_API_SERVICE_KEY`·`NTS_API_STUB_MODE`·`NTS_MASTER_BYPASS_CODE` 추가.

**영향 문서**: `04_feature_spec.md` §1.2·§1.4, `07_api_spec.md` §2·§3(verify 엔드포인트 신설), `09_service_design.md`(register 시그니처·`verify_business`), `08_schema.md`(stores), `06_sequence.md`, `05_user_flow.md`, `02_usecase.md`, `12_security.md` §2.4, `10_frontend_design.md` §3, `04_feature_spec.md`, `plan/be·fe/phase_03_auth.md`(M3.B8·M3.F9 신설). 코드 구현(BE 마이그레이션·verify 엔드포인트, FE `/verify-business`·가드)은 후속 `feat/*` 진행 — 본 회차는 문서·`.env` 확정만.

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

Q1~Q10 정정: spec 폴더 경로 정정·FE 알림 폴링 5분·POS stub 신설로 Phase 03 분리·BE phase_12 시작일 정정·데모 시나리오 9단계 SSOT·알림 채널 책임 분리(Slack 운영자 전용)·폴링/배치 시각 분산·산출물 비대칭 정합·미정의 항목 spec 참조 추가·SLA 강도 명확화. 21개 plan 파일 + `04_gantt.md` 수정.

### 2026-05-23 (24차) — 외부 데이터 소스 조사 + Git 브랜치 전략

`docs/research/ai/03_external_data_sources.md` 신규 (조치원 홍익대 상권 특화). `README.md` §5 브랜치 전략 섹션 신설.

### 1~23차 audit 이력 (요약)

- **1~5차** (2026-05-06~07): 초기 spec 작성·일관성 검토 (`api_spec`·`schema`·`service_design`·`user_flow`·`sequence`·`mvp_scope`·`security`·`performance` 등)
- **2~13차** (2026-05-15~16): `research/backend/` 11개 카테고리 결정 일괄 진행 — 웹 프레임워크·앱 서버·리버스 프록시·데이터 계층·인증/암호화·외부 연동·캐시/관측·비동기/파이프라인·테스트/품질·배포·DI/유틸. 각 회차 결정은 §3 표로 추상화.
- **14~16차** (2026-05-16): `research/backend/12` 폐기 + `13_pos_adapter` 2단계 진입 가이드 재편. 보안 미확정 항목 정리(RBAC·감사 로그·logout-all·다중 디바이스). 종합 검증 + 책임 분리 정정(n8n=AI / ARQ=BE 도메인).
- **17~18차** (2026-05-16): `research/frontend/` 10+1개 카테고리(`11_observability.md` 신규). FE Sentry 결정·OAuth 콜백 응답 정정(200 → 302+Cookie)·인앱 폴링 5분 고정.
- **19차**: CSV-only MVP 정책 정합 + MVP/2단계 라벨 도입 + `10_frontend_design.md` FE spec 신설.
- **20차** (2026-05-16~17): 14개 미확정 AI 항목 → research 위임 + `prompts/` 폴더 폐기(`08_ai_handoff` + `consistency_check`).
- **21차** (2026-05-20): `04_gantt.md` 골격·hookup 분할(Phase 12 AI hookup 신설), 14 Phase 구조.
- **22차**: AI research 일부 확정 (Regression / Walk-forward CV / IQR / 결측 보간 / 데이터 누수 방지).
- **23차** (2026-05-23): 캡스톤 ML 통합가이드 → `research/ai/00_ml_reference_guide.md` 이동.

> 각 회차 audit 영향 파일 목록은 `git log --follow --all <파일>` 또는 git blame으로 확인. spec/research 본문이 SSOT이므로 본 §5에는 차수·결정 사유만 남긴다.
