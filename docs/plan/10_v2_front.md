# 10 Front v2 이식

목업 v2를 Front에 옮긴다. 화면 하나를 옮길 때 그 화면의 디자인·새 API·로직을 함께 넣고, 그 화면에 남은 옛 코드도 그때 지운다.

- 기준 — 화면은 목업 `docs/plan/mockup/v2/01~14`(공용 셸·토큰·아이콘·차트·하늘은 `mockup.js`), 구성·상태는 `spec/04_fe.md` §3·§4, API는 `spec/02_implementation_design.md` §3과 `src/api/types.gen.ts`
- 움직임(등장·전환·마우스오버)은 목업 그대로 옮긴다. `prefers-reduced-motion`이면 끈다
- 쿠팡 담기 FE(`08_coupang_cart.md` §4)는 추천발주 묶음(B6)에서 함께 한다

## 0. 진행 방식

두 라운드다. 라운드 안의 묶음은 서로 다른 파일만 고치므로 동시에 돈다.

| 라운드 | 묶음 | 시작 조건 |
|---|---|---|
| A | A1 하늘·라우팅, A2 메인 셸·공용 부품, A3 API 층 | 지금 |
| B | B1~B8 화면 | A 셋을 합쳐 커밋한 뒤 |

- 묶음마다 git worktree 하나에서 일한다. 시작할 때 `cd Front && pnpm install --frozen-lockfile`
- 파일 소유 — 묶음마다 아래 '파일' 목록만 만들거나 고친다. 그 밖은 읽기만 한다. 빠진 공용 부품·API 함수가 필요하면 만들지 말고 보고에 적는다
- API 함수는 `src/api/endpoints/*`에만 둔다. 화면 파일에서 `api.get(...)`을 직접 부르지 않는다
- 화면 전용 부품은 `src/components/<화면>/`에 둔다. 다른 화면의 부품을 고치지 않는다
- 데이터 요청은 TanStack Query, 정책은 `04_fe.md` §5.2. 화면 판단(정렬·경고·D-n·변화율·정확도)은 FE가 계산한다(`04_fe.md` §7.0)
- git 명령(add·commit·checkout·stash·reset 등)을 쓰지 않는다. dev 서버·`vite preview`·docker를 띄우지 않는다
- 시험은 앞에서 실행해 결과를 끝까지 받는다. 환경 탓으로 실패하면 우회 코드·설정 완화를 넣지 말고 그대로 보고한다
- 주석은 하다체 한국어, 기존 파일 문체를 따른다

검증(묶음 공통): `pnpm typecheck`, `pnpm test`, `pnpm exec biome check <고친 파일>` 모두 통과. 아래 묶음별 Vitest를 더한다. 화면 대조(목업과 웹 1440px·앱 390px 캡처 비교)와 실데이터 확인은 합친 뒤 따로 한다.

## 1. 라운드 A

### A1 하늘·라우팅

파일: `src/components/sky/*`, `src/routes/root-layout.tsx`, `src/routes/router.tsx`, `src/routes/guards.tsx`, 새 라우트 자리 파일 `src/routes/sales/index.tsx`(빈 화면만), `src/test/sky-*.test.ts`, `src/test/guards*.test.tsx`

- 하늘 — 목업 `mockup.js`의 '사장님의 하루'(`DAY_KEYS`·`dayAt`·`drawDay`·`dayBackdrop`)를 React 부품으로. 라우트 바깥 루트 레이아웃에 한 번만 두고 화면을 넘겨도 다시 그리지 않는다. 지금 시각을 이어받는다
- 화면별 하늘 시각 — 목업 `body[data-sky]`·`data-sky-steps` 값을 화면이 지정하는 훅(`useSky(시각 | "now" | "scroll")`). 단계가 바뀌면 앞뒤 중 가까운 쪽으로 흐른다(`flowTo`·`flowSky`). 하늘 위 글자 색 `--sky-fg`·`--sky-fg2`도 함께
- '아침이 밝기' — 로그인 뒤 목적지가 홈일 때만 `goDashboard`의 시계 돌리기 → 홈 등장. 목적지는 가드(`04_fe.md` §3 redirect 순서)가 정한다
- 라우터 — `04_fe.md` §3 표대로 확정한다. `/sales` 추가, `/settings/*`는 목록과 판(`account`·`notifications`·`store`·`pos`·`pos/upload`·`coupang`·`app-info`)을 한 화면이 받게 한다. 화면 파일은 지금 것을 가리키고, 없는 것은 빈 자리 파일을 만든다
- Vitest: 시각 → 하늘 색 보간(열쇠 시각 사이·자정 넘김), 가드 목적지(상태 넷 × 경로), 아침이 밝기는 홈 목적지에서만

### A2 메인 셸·공용 부품

파일: `src/index.css`, `src/components/shell/*`, `src/components/ui/*`, `src/api/endpoints/notifications.ts`, `src/test/shell-*.test.tsx`

- 토큰·유리 — 목업의 색·글자·간격 토큰과 `glass-card`(안쪽 판은 흐림 끔)·`glass-bar`·`glass-strong`·`glass-brand`를 `index.css`로
- 메인 셸 `<MainShell active title? back?>` — 열린 배치(`04_fe.md` §4.0, 목업 `renderShell`의 `data-layout="open"`). 웹 상단 판 셋(서비스 이름 / 가운데 주 메뉴 떠 있음 / 알림·설정·계정), 앱 상단 바(스크롤하면 오른쪽으로 줄어 알림·계정만), 앱 하단 탭 다섯. 옛 사이드바 셸 `components/dashboard/shell.tsx`는 건드리지 않는다(B 끝에 지운다)
- 알림 목록 — 상단 바 알림 판. `GET /api/notifications` 5분 폴링, 긴급 → 경고 → 정보 정렬, 모두 읽음, 항목을 누르면 `01_basic_design.md` §4.5 화면으로. POS 상태 `ERROR`·`DISCONNECTED`면 맨 위 고정 항목(`04_fe.md` §4.3)
- 옆 판 `<FollowPanel>` — `04_fe.md` §4.0 옆 판 규칙(목업 `followPanels`·`dropPanel`). 앱은 화면 전체를 덮는다
- 날짜 입력 `<DateField>` — 웹은 직접 만든 달력 판(목업 `openDatePop`), 앱은 기기 기본
- 알약 버튼·입력칸·카드 등 화면이 같이 쓰는 부품은 `components/ui`에서 v2 모양으로 고친다. 기존 export 이름과 props는 유지한다(옛 화면이 아직 쓴다)
- Vitest: 알림 정렬·POS 고정 항목, 옆 판 높이 계산(내용·화면·목록 중 작은 쪽), 날짜 판 월 넘김·최소/최대

### A3 API 층

파일: `src/api/endpoints/*`(단 `notifications.ts`는 A2), `src/lib/extension.ts`, `src/lib/push.ts`, `Front/.env.example`, `src/test/api-*.test.ts`

- 화면이 쓰는 API를 모두 함수로 둔다. 요청·응답 타입은 생성 타입 별칭(`04_fe.md` §7.1). 새로: 판매 `GET /api/sales/trends`·`GET /api/sales`(기간·`menu_id`), 대시보드 `GET /api/dashboard/forecast-vs-actual`, 재고 `GET /api/inventory/price-trends`, 담기 `POST /api/orders/automate/start`·`{run_id}/step`·`{run_id}/finish`, 수동 예측 `POST /api/forecast/run`, 매장 정보, 알림 설정·구독(`/api/notifications/settings`·`subscribe`)
- 확장 연결 `src/lib/extension.ts` — `chrome.runtime.sendMessage(확장 ID, …)`로 `ping`·`open`·`run`·`take_non_wow_prices`·`notice`·`progress`(형식 `Extension/src/messages.ts`, `04_fe.md` §12.3·§12.6·§12.7). 확장 ID는 `VITE_EXTENSION_ID`. 크롬이 아니거나 답이 없으면 '확장 없음'
- 푸시 `src/lib/push.ts` — `VITE_VAPID_PUBLIC_KEY`로 구독해 `subscribe`로 보낸다(`04_fe.md` §6), 해지
- 옛 화면이 쓰는 함수는 이름을 유지한다
- Vitest: 확장 없음·시간 초과·`ok: false` 처리, 푸시 키 없음·권한 거부

## 2. 라운드 B

모두 `<MainShell>`(로그인 앞 화면은 하늘 위)로 옮긴다. 묶음마다 자기 화면의 옛 부품과 옛 시험을 지우거나 바꾼다.

| 묶음 | 목업 | 파일 | 붙는 API·로직 | Vitest |
|---|---|---|---|---|
| B1 시작·인증·온보딩 | 01~05 | `routes/intro.tsx`·`login.tsx`·`register.tsx`·`verify-business.tsx`·`onboarding/*`, `components/auth/*`, `assets/*`, `schemas/*`, `stores/onboarding-store.ts` | 하늘 시각 지정(`useSky`), 단계별 하늘 흐름, 로그인 뒤 아침이 밝기 | 단계 전환·검증 문구, 하늘 시각 지정 |
| B2 홈 | 06 | `routes/home.tsx`, `components/home/*` | `forecast-vs-actual`(최근 7일), `price-trends?days=30`(변화율 상위 4), 최근 발주 4건, 확인 필요 재료, 상태 셋(`04_fe.md` §4.3) | 변화율 계산·제외, 예측 없음 칸 비우기, 매출 없음 안내 |
| B3 매출 예측 | 07 | `routes/forecast.tsx`, `components/forecast/*` | 기간 매출 주·월·년 넘김, 예측 막대, 기간 정확도, 앞으로 3일·메뉴별 예상(`04_fe.md` §4.4) | 정확도 계산(년은 달마다), 이전 기간 넘김 끝 |
| B4 판매 데이터 | 08 | `routes/sales/index.tsx`, `components/sales/*` | `sales/trends` `group_by=day`, `GET /api/sales` 하루 묶기·메뉴·전체 기록 20건씩, 판 셋 배치(`04_fe.md` §4.7) | 판매 없는 날 0 채우기, 1년 초과 문구, 하루 묶기 |
| B5 재고 | 09 | `routes/inventory.tsx`, `components/inventory/*`, `stores/preferences-store.ts` | `coupang_product`·`unit_price`, 쿠팡 상품 단가 그래프(`price-trends`), 입고 대기 카드, 쪽 25개(`04_fe.md` §4.6) | 기존 경고·정렬 유지, 단가 미설정 표시, 변화율 |
| B6 추천발주 | 10 | `routes/orders.tsx`, `components/orders/*`, `features/coupang-cart/*` | 추천 표·정렬, 쿠팡 담기 start → step 반복(확장 중계) → finish, 진행·결과 판, 409·`FORECAST_NOT_FOUND` 수동 실행(`04_fe.md` §4.8, `08_coupang_cart.md` §4) | 확장 없음 비활성, 반복 중 오류면 다음 대상, 결과 판 세 상태, 소진 시점 정렬 |
| B7 메뉴·관리자 | 11·13 | `routes/menus.tsx`, `routes/admin/*`, `components/menus/*`, `components/admin/*` | 카테고리 묶음·구분선, 검색·보기(`04_fe.md` §4.5), 심사 큐(§4.10) | 묶음 정렬·거르기, 기존 메뉴 시험 유지 |
| B8 설정 | 12 | `routes/settings/*`, `routes/sales/upload.tsx`, `components/settings/*`, `components/pwa/*`, `lib/pwa-install.ts`, `sw.ts` | 판 일곱(`04_fe.md` §4.9) — 매장 정보, 알림 설정·이 기기로 푸시(`lib/push.ts`), 쿠팡 담기 확장 상태(`ping`), 매출 올리기는 POS 판 안. PWA 결함 셋(새 버전 SW 즉시 교체로 입력 중 새로고침, 비지원 브라우저 설치 안내, `promptInstall` 예외) | 판 전환, 확장 연결/없음, 푸시 권한 거부, 설치 안내 분기 |

추천 수정값은 화면 상태로만 둔다(`PROGRESS.md` §2 '추천 수정안 저장 폐지'). 약관 항목·약관 본문·로고는 지금 것을 둔다.

## 3. 마무리

1. B 여덟을 합친 뒤 `components/dashboard/*` 등 쓰지 않게 된 옛 부품을 지운다
2. 화면 대조 — 목업과 웹 1440px·앱 390px 캡처를 나란히 비교해 어긋난 것을 고친다
3. 실데이터 — dev 환경(BE·agent·확장)으로 로그인 → 홈 → 각 화면, 쿠팡 담기 한 번
4. `00_wireflow.html`을 새 내비 구조로 다시 그리고 `04_fe.md`를 구현에 맞춘다
