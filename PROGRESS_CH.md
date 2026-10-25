# 진행 이력 — 서창현 (CH)

> 담당: Backend + Frontend — 8월 리디자인·실데이터 연동
> 프로젝트 공통 단계·정책 결정은 [PROGRESS.md](PROGRESS.md)를 본다.
> 최신이 위로 온다(역시간순).

---

## 1. 개발 이력

### PWA(홈 화면 설치) 적용 (2026-10-25)

리디자인과 같은 `feat/fe-redesign` 브랜치. 설치 조건 검사(Chrome `Page.getInstallabilityErrors`) 오류 0건, 매니페스트 오류 0건, 오프라인에서 `/orders` 새로 열기 정상.

1. 아이콘 `Front/public/` 신규 — icon-192·icon-512·icon-maskable-512·apple-touch-icon(180)·favicon-64 (브랜드 보라 + "사").
2. `vite.config.ts` manifest 보강 — id·lang ko·scope·orientation portrait·background·icons·shortcuts(발주·재고·매출 올리기). `index.html`에 iOS 메타(apple-touch-icon, apple-mobile-web-app-*).
3. `src/sw.ts` — `NavigationRoute`(SPA 오프라인 화면 이동, `/api/*` 제외), `skipWaiting`+`clientsClaim`, `cleanupOutdatedCaches`. 의존성 `workbox-routing`·`workbox-core` 7.4.1 추가.
4. 설치 안내 UI — `src/lib/pwa-install.ts`(beforeinstallprompt 보관·standalone/iOS 판별·배너 닫기 상태), `src/components/pwa/install-banner.tsx`(앱 홈 배너 + 더보기 "홈 화면에 앱으로 설치하기" + iOS/안드로이드 단계 안내 시트). 앱 상단바에 노치 여백(`pt-safe`).
5. 문서: `docs/spec/04_fe.md` §6 표에 설치·오프라인·설치 조건 3행 추가.

**주의**: HTTPS(또는 localhost)에서만 설치된다. 휴대폰에서 `http://192.168.x.x:5173`로 열면 설치 버튼이 안 뜬다.

---

### 웹·앱(모바일 PWA) 디자인 전면 리디자인 (2026-10-25)

브랜치 `feat/fe-redesign`(origin/main e66f68e 기준). 기능·API 호출은 그대로 두고 화면만 다시 만들었다.

**방향**
- 웹(lg 이상): 수발주 B2B 서비스(발주고·마켓봄·앳트래커)처럼 흰 상단 가로 내비 + 회색 캔버스 + 흰 카드 + 큰 숫자 KPI. 좌측 사이드바 제거.
- 앱(lg 미만): 50~60대 MAU 상위 앱(카카오톡·네이버·밴드) 문법 — 상단엔 화면 이름만 크게, 글자 달린 하단 탭 5개(홈·매출 예측·재고·발주·더보기), 표 대신 카드 목록, 기본 글씨 112.5%, 버튼 48px 이상, 수량은 −/+ 스테퍼.

**변경**
1. 디자인 토큰 `Front/src/index.css` `@theme` — brand/ink/line/canvas/상태색. 화면 코드의 임의 hex(`#7a5eff` 등)를 토큰 클래스로 일괄 치환. 폰트 Pretendard(`pretendard` 패키지, self-host라 CSP `font-src 'self'` 유지).
2. 공용: `components/dashboard/shell.tsx`(웹 헤더·앱 상단바·하단 탭), `components/ui/card.tsx`(Card·PageHeader·SectionTitle·StatCard·EmptyState·Segmented 신규), `lib/format.ts`(원 표기·만원 단위 요약 신규), `button`·`field`·`alert-badge`·`revenue-chart` 재작성. `menu-share-chart.tsx` 삭제(홈 인기 메뉴를 막대 목록으로 대체).
3. 화면: 홈(맨 위 "오늘 할 일" 배너 → 발주 화면), 매출예측(D+1~3 예측을 맨 위로, 이번 달/지난 달 그래프 전환), 발주추천(AI 추천 먼저, 줄 단위 선택·스테퍼·하단 확정 바), 재고(카드 목록 + "확인 필요" 필터), 설정 허브를 앱 "더보기"로(매출 올리기·레시피·로그아웃 포함), 온보딩 단계 표시. 나머지 화면은 토큰·글씨 크기만 맞춤. 로그인/회원가입 라벨 한글화(ID→아이디(이메일), Password→비밀번호).
4. 검증: `tsc -b` 통과, vitest 42/42 통과, `vite build` 통과. API를 목업으로 띄워 1440px·390px 화면 캡처로 확인(실제 BE 연동 화면 확인은 아직).

**남은 것**: 실제 BE 데이터로 화면 확인, 시니어 사용자 테스트(글씨 크기·탭 이름), `sales/upload.tsx` 기존 biome lint 경고 3건(이번 변경과 무관).

---

### 매출 CSV 재업로드 11배 중복 적재 버그 진단·수정 (2026-08-17)

세종 AX 해커톤 본선 시연 준비 중 담당자가 인기메뉴 화면에서 소주 판매량이 비정상(약 8만 개)으로 표시되는 것을 발견 — 원본 POS CSV 4종 교차 검증으로 실제 소주 총 판매량이 8,984개(13.5개월)임을 먼저 확정하고 조사 착수.

**원인**: `sale_records`의 `UNIQUE(store_id, source, external_sale_id)` + `INSERT IGNORE` dedup 자체는 존재하나, `external_sale_id`가 nullable이고 MySQL UNIQUE 인덱스는 NULL끼리 서로 다른 값으로 취급 — 영수증번호 컬럼을 비워두면(FE `DEFAULT_COLUMNS.external_sale_id_column=""` 기본값) DB 레벨 중복 방지가 전혀 동작하지 않는다. 실서버 DB 진단 SQL로 확정: 매장 `a31dd30c-…`(칠야, 담당자 시연 계정)에 동일 CSV가 11회 재업로드되어 소주 8,984→98,824(정확히 11배), 매장 총 매출 192.4M→2,116M원으로 중복 적재됨.

**조치**:
1. 원격 DB 백업(영향받은 46,607행 mysqldump) 후 `(store_id, menu_id, sold_at)` 그룹 내 최소 `sale_id` 1건만 남기고 트랜잭션 내 정리 — 소주 8,984개로 정확히 복구, 매출은 원본 02파일(192,409,848원)과 8,000원(단일 in-file 중복행) 이내로 일치.
2. `Back/app/services/sale_service.py` `_insert_chunk` — `external_sale_id`가 None이면 `(menu_id, sold_at)` 기반 합성 식별자(`AGG:{menu_id}:{sold_at.isoformat()}`)를 만들어 기존 UNIQUE 제약·`INSERT IGNORE` 경로를 그대로 타도록 정규화(스키마 변경 없음, 청크 내·청크 간 중복 모두 방지). `Front/src/routes/sales/upload.tsx` 영수증번호 필드 힌트 문구 갱신.
3. 회귀 테스트 2종 추가(`Back/tests/sales_test.py`) — 영수증번호 없이 재업로드 시 dedup, 같은 파일 내 dedup. 원격 서버 pytest 38/38 통과.
4. 원격 배포 — SSH 세션 PATH에 `/usr/local/bin`이 빠져 있어 `docker-credential-osxkeychain`을 못 찾고 이미지 빌드가 막혔던 것을 `PATH=/usr/local/bin:$PATH`로 회피(자격증명 파일은 미변경)하여 `be` 재빌드·재시작.
5. 라이브 검증 — `SaleService.get_top_menus`/`get_summary`를 실 프로덕션 DB(칠야 매장)에 직접 호출해 소주 8,984개·매출 192,401,848원 확인.

**교훈**: nullable 컬럼을 포함한 UNIQUE 제약은 "NULL 다수 삽입" 경로에서 보호를 제공하지 못한다 — 식별자가 없는 입력은 반드시 별도의 non-null 합성 키로 정규화해야 DB 레벨 dedup이 실효를 가진다.

---


---

## 2. 문서 수정 이력

### 2026-10-25 — PWA 적용

§1 "PWA(홈 화면 설치) 적용" 추가. `docs/spec/04_fe.md` §6 PWA 표에 3행(설치·오프라인 화면 이동·설치 조건) 추가.

### 2026-10-25 — 웹·앱 디자인 리디자인

§1 "웹·앱(모바일 PWA) 디자인 전면 리디자인" 추가. 코드 변경은 `Front/` 한정(spec 문서 변경 없음). 커밋은 `feat/fe-redesign` 브랜치, PR 전.

### 2026-08-17 — 매출 CSV 재업로드 11배 중복 적재 버그 진단·수정

세종 AX 해커톤 본선 시연 임박 상황에서 발견된 데이터 정합성 버그의 원인 진단·DB 정리·코드 픽스·배포·라이브 검증 전 과정 수행. 상세는 §4 "매출 CSV 재업로드 11배 중복 적재 버그 진단·수정" 참조. §3 정책 표에 "매출 CSV 재업로드 dedup 정책(2026-08-17)" 행 추가. 코드 변경: `Back/app/services/sale_service.py`(dedup 로직 + 모듈 docstring), `Back/tests/sales_test.py`(회귀 테스트 2종), `Front/src/routes/sales/upload.tsx`(안내 문구). 아직 git 커밋되지 않은 로컬 편집 상태 — 커밋·PR은 담당자 확인 후 별도 진행.
