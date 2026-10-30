# 진행 이력 — 임형택 (HT)

> 담당: Backend + Frontend + 문서·플랜 운영
> 프로젝트 공통 단계·정책 결정은 [PROGRESS.md](PROGRESS.md)를 본다.
> 최신이 위로 온다(역시간순).

---

## 1. 개발 이력

### 리디자인 목업 v2 — 시작 화면과 유리 공용 틀 (2026-10-31)

- 목업 폴더를 `v1`(현재 구현 기준, 기존 22개 파일 이동)과 `v2`(리디자인)로 나눔(사용자 결정)
- 방향 — 시작 화면은 모션그래픽, 대시보드는 글래스(사용자 결정). 유리 값은 흰색 10% + 흐림 20px + 채도 160%, 패널 안 카드는 흐림 없이 흰색 38%(`glass`·`glass-card` 유틸리티). 굴절(리퀴드 글래스)은 기각 — `backdrop-filter`의 SVG 필터 연결을 Safari가 지원하지 않고, 캔버스로 직접 그린 방식도 사용자 확인에서 굴곡이 사라짐
- `v2/01_intro.html` 시작 화면 → '지금 시작하기' → `v2/02_frame.html` 공용 틀. 같은 배경('⑤ 흐름')을 쓰고 움직임을 현재 시각에 맞춰 페이지가 바뀌어도 이어짐. 나갈 때 구체가 퍼지고 배경에 옅은 막이 덮이며, 대시보드는 상단 바 → 왼쪽 메뉴 → 패널 → 하단 알약 → 카드 순으로 들어옴
- 공용 틀 배치 — 웹: 상단 바(패널과 시작·끝 맞춤) + 패널 왼쪽 가장자리에 반쯤 걸친 알약 메뉴 + 본문 패널 + 패널 아래 가장자리에 반쯤 걸친 하단 알약(내용 미정). 앱: 상단 바 + 본문 패널 + 하단 알약 탭 5개
- 배경 후보 비교용 ① 오로라 ② 3D 유광 ③ 선·파형 ④ 오로라(사진 참고)와 흑백 시험 배경을 도구 막대에서 고름
- 검증: 웹 1280·앱 390 콘솔 오류 없음, 전환 과정을 녹화해 프레임으로 확인(페이지 사이 배경만 보이는 틈 약 0.45초 — 목업이 페이지를 새로 읽는 탓)

### Slack 배치 실패 알림 연결 (2026-10-30)

- Slack 워크스페이스 Sajura에 앱 `sajura-alert`(Incoming Webhook 하나, 채널 `#sajura-alert`)를 만들고 `.env` `SLACK_WEBHOOK_URL`에 넣음(사용자). n8n 컨테이너를 다시 만들어 반영
- 검증: `ai`를 멈춘 채 시험 매장(weather-probe) 수동 예측 → `FAILED`(`getaddrinfo ENOTFOUND ai`), `#sajura-alert`에 '[사주라] 예측 배치 실패 — 매장 862ebe99-…: getaddrinfo ENOTFOUND ai' 수신(02:38). `ai`를 다시 켜고 같은 매장 `DONE`

### 확장 — 그림 파일 이름은 개인정보 가리기에서 뺌 (2026-10-30)

- 원인(실제 쿠팡 계란 검색 화면에서 셈): 이름 붙은 그림 162개 중 91개가 `---`로 바뀜. 체크 상자 배경 그림 `search_assets_160912@2x.png`(85개) 등 고해상도 이름의 '@2x.png'가 이메일 모양, 상품 페이지의 16진수 이름 속 숫자 묶음이 전화번호 모양에 걸림
- 그림 파일 이름·아이콘 클래스 이름에서 나온 글자는 모양 가리기를 하지 않음. 그림 설명 글(`alt`)은 그대로 가림. spec `04_fe.md` §12.4에 한 줄 추가
- 검증: 확장 Vitest 51/51(새 시험 — '@2x.png'·16진수 이름은 남고 `alt`의 전화번호는 가림), typecheck, build. 크롬에서 확장 새로고침 필요

### 보안 분류기 모델 확정 — 세 모델 시험 (2026-10-30)

- 분류기 모델은 `qwen3.6:35b-a3b`(사용자 결정). Prompt Guard 2 86M은 빠르지만(5만 자 이상 평균 3.3초) 공격 290건 중 73건만 거부, 점수 기준을 0.01로 낮춰도 177건이고 정상 10건을 막음. `qwen3.8:27b`는 상품 페이지 4건이 60초 시간 초과, 같은 21건에서 qwen3.6보다 2건 더 맞히고 시간은 302초 대 83초
- qwen3.6 — 정상 49/50, 오남용 139/140, 상품명 75/150(3만 자 이상 화면에 심은 것은 40/102), 5만 자 이상 평균 18.2초. research 17 §15, 결과 파일 `scripts/llm_eval/run_guard_bench_1030/`(git 제외)
- 분류기는 계속 꺼 둠(`.env`). API 모델(Sonnet 4.6급) 분류기는 미래 과제로 남김(사용자)

### 쿠팡 자동 담기 — 발주 수량 맞추기 기준과 분류기 시험 도구 — 89e4bc7~2ff770a (2026-10-30)

- 고르는 기준 맨 앞에 발주 수량 맞추기(`01` §3.8.1) — `올림(발주 수량 ÷ 포장 수량) × 포장 수량 ≤ 발주 수량 × 1.1`인 상품만 후보, 없으면 그 품목 실패(사용자 결정). 연결 상품에도 적용해 다른 옵션으로 맞추거나 검색 결과로 가서 그 상품(`productId`)을 빼고 다시 고른다
- 실측: 연결을 지운 검색 시험에서 양파 3000g에 '3Kg 소', 계란 30개에 30구를 담음. 연결 상품(30구)에 계란 40개를 주자 검색으로 가서 '40구, 1개' 옵션을 담음(발주 15,500원, 단가 채워짐). research 16 §6.13
- 분류기 시험 도구 — `scripts/guard-bench.sh`(분류기 Ollama + 패키지 + 공격 문구 파일 6개 + 모델 3개, 건마다 실시간 출력, `/tmp/guard_bench/`에 로그·건별 jsonl), `scripts/llm_eval/guard_bench.py`(정상 50 — 실제 쿠팡 화면 8 포함, 상품명·오남용 문구를 에이전트 서버 입력 모양 그대로 심음). 공격 문구는 사용자가 codex·agy로 만든 파일(`scripts/llm_eval/data_guard/attacks_*_{codex,agy_v1,agy_v2}.txt`). codex 오남용 파일은 붙여넣기에서 잘린 10건을 대화 기록 원문으로 복원
- 검증: BE 담기 시험 19/19

### 쿠팡 자동 담기 — 확장과 실제 쿠팡 담기 실측 (plan 08 §3) — bcb5fc6~ecd0ec8 (2026-10-29)

- `Extension/`(MV3, TypeScript + Vite, Vitest) — 요소 목록(취소선 deletion, 별 모양 별점 → '별점 4.5', 그림은 배지 파일 이름·아이콘 클래스 이름, 사진·내장 그림 제외), 상품 고유 ID는 카드 링크와 상품 페이지 제목에만(가격 영역은 제목 아래로), 개인정보 가리기(머리말 이름·'마이쿠팡' 설명 글은 위치, 전화·이메일·주소는 모양), 클릭 전 스크롤·링크 안 글자는 그 링크를 누름·담기 완료 감지 → `cart_added`, 작업 탭의 alert·confirm 가로채기(확인 창은 취소), 탭 명령 15초 제한, 와우 카드 비회원 가격 대기열. 개발용 고정 ID `cbplmciiejdjhhogkjhehfhdipocmdkf`
- 실측으로 고친 것 — 에이전트 서버 15만 자는 LLM에 넣는 글로 잼(JSON은 칸 이름 반복으로 상품 페이지 15만 4천 자), 분류기 지시문에 장바구니 검수 지시, 고른 상품 페이지에서 다시 검색하지 않게 지시문 보강, `vendorItemId`는 선택 값(연결 상품 주소는 `?itemId=`까지 — 판매자는 쿠팡의 대표 판매자, `coupang_products.vendor_item_id` NULL 허용·관측에 있을 때만 갱신, `0017` 고쳐 씀). 사용자 결정: 15만 자 측정 기준 ①, 주소에 `vendorItemId` 넣지 않음, `vendorItemId` 선택 값 ②
- 보안 분류기 — 켠 담기 대화에서 정상 승인·지시문 422. qwen 대 Prompt Guard 2 86M 비교(`scripts/llm_eval/guard_compare.py`, 공개 사본 md5 일치) — 정상 오판 없음, 은근한 주장은 둘 다 놓침(research 17 §14)
- 이어서 고친 것 — 주소 열기는 작업 탭 페이지 안 이동(`location.assign`, 탭에 주소를 바로 넣으면 차단 화면), 열리자마자 뜨는 알림 창도 막기(작업 탭 표시를 sessionStorage에, 알림 글은 문서에 적어 둠), 첫 지시를 고정 지시문(`instruction`)과 발주 데이터(`order`, DB 값·값마다 한 줄)로 나누고 분류기는 발주 데이터와 확장 실행 결과만 봄(사용자 결정 ②+구분). 분류기는 시험 뒤 끔(사용자 지시)
- 검증: 확장 Vitest 50/50·typecheck·build, 에이전트 pytest 28/28, BE pytest 164/164. 실제 쿠팡(비로그인, 개발자 모드 확장, PWA 탭 시험 스크립트, 분류기 끔)에서 양파 3000g·계란 30개 → 연결 상품 페이지에서 담기 → 장바구니 검수 OK → 발주 확정 합계 10,662원(단가·소계 채워짐). research 16 §6.13

### 쿠팡 자동 담기 — 담기 에이전트 서버 (plan 08 §2) — 3f8cad0 (2026-10-29)

- `Agent/`(FastAPI·Redis), compose 서비스 `agent`(포트 미공개, 호스트 Ollama용 `host.docker.internal`)
- `/agent/step` — 대화 기록 `agent:conv:*`(1시간, 최근 요소 목록만, 외부 글은 `<coupang_page>` 태그 안에서 꺾쇠·줄바꿈 바꿈) → 15만 자 → 호출 횟수(대화 40·매장 하루 300·전체 하루 3,000, 분류기 거부도 셈) → 분류기 `openai_chat`(생각 모드 끔) → LLM `openai_compatible`(`tool_choice: required`, 120초) → 도구 인자 검사. 형식 오류·호출 실패는 3회 다시 보내고(횟수 안 셈) 503. `type_text` 50자·`finish_item` 200자 자르기, `open_url`은 상품 페이지 주소만
- `/agent/filter` — 후보 50개 이하, `keep_candidates`, 받지 않은 ref 버림
- 요청에 대화 종류 `kind`(item | cart_check)를 더해 쓰는 도구를 정한다(spec §2.4.5·BE 호출). BE의 `anthropic`·`openai` 의존성 삭제
- 검증: 에이전트 pytest 25/25(컨테이너), BE pytest 162/162, BE → `agent:8000` 연결. 실제 게이트웨이 한 품목 대화 — 검색 7걸음·연결 상품 3걸음으로 담기까지(research 17 §13, `scripts/llm_eval/agent_trial.py`). 분류기는 꺼진 채로만 시험

### 쿠팡 자동 담기 — BE 구현 (plan 08 §1) — 466f60a~2f33e81 (2026-10-29)

- spec 빈칸 닫기(466f60a) — 요소 목록의 취소선 가격은 종류 `deletion`, 서버가 상품 값을 읽는 법(표시 가격 = 취소선이 아닌 첫 'N원', 할인 표시·단위가격·`logo_fresh` 그림), BE의 에이전트 서버 주소 `AGENT_BASE_URL`(연결 실패·시간 초과는 503 `ORDER_LLM_UNAVAILABLE`), finish 품목 `reason` 뜻. 사용자 결정: 취소선 구분은 확장이 표시(①), 단위가격 바로 앞·최소 금액 안 기각
- `0017` 고쳐 쓰기 — `coupang_products`(`itemId` 키)·`coupang_store_prices`, `inventory_items.coupang_item_id`, `pack_quantity`·`orders.status`·`automated_at` 삭제. dev DB는 옛 이미지로 `0016` 내린 뒤 새 이미지로 올림
- `coupang_pricing` — 상품명 첫 쉼표 나누기, 용량(옵션 이름 → 상품명 기준 용량 하나 × 옵션 개수, g·ml·개), 단위가격 2% 대조, 와우 할인 비회원 가격, 다수결, 재료 단위 환산
- `AutomationService` — `coupang_run:{run_id}` 진행 상태, 첫 지시(연결 상품 3일·로켓프레시 비로그인 검색), `/agent/step` 중계(오류 그대로), 200 걸음만 상품 카드 저장(upsert + `FOR UPDATE`, itemId 순), `non_wow_prices`는 와우 카드 itemId만, `cart_added`면 에이전트 미호출·연결·품목 단가, finish에서 담긴 품목만 발주 저장. ARQ 매장 가격 삭제 00:00(날짜 순번 짝수인 날)
- 추천발주 예상 단가 — 연결 상품 단가, 없으면 공용 단가 낮은 순 50개 → `/agent/filter`(동시 호출) → 최저, `price_filter:*` 이틀. 에이전트 호출은 추천안 트랜잭션 앞에서 한다
- `approve`·`match`·`result`·BE `LLMClient`·LLM 설정 삭제. 테스트는 conftest 가짜 에이전트(autouse), 발주 생성은 start → step → finish 경로(`place_order`)
- 검증: `0017` upgrade·downgrade 왕복, BE 컨테이너 pytest 162/162. FE는 아직 `approve`를 부른다(openapi 재생성 전)

### 쿠팡 자동 담기 — 공용 쿠팡 상품·가격 규칙과 발주 확정 재설계 (2026-10-29)

- 공용 쿠팡 상품(cf369da~cbfcfb3) — `itemId` 한 행, 상품명·옵션 이름 나누기, 용량은 옵션 이름 → 상품명 계산, 단가는 쿠팡 단위가격 2% 대조 통과 시만. 담기 성공·담은 상품은 확장의 `cart_added`로만. 분류기 모델 `qwen3.6:35b-a3b`로 고정(spec 미확정 절 삭제)
- DB 규칙 QA(71e8ee3~7fef29c) — 실제 사용 상황 대입으로 찾은 문제를 사용자 결정으로 고침. 검색으로 같은 상품을 다시 골라도 연결 시각 갱신, 연결 상품 못 담으면 검색, 비로그인 안내에 로그인 요청, 담기 결과가 오면 품목 대화 끝, 20% 가격 후보 → 매장당 한 표 다수결·이틀마다 초기화, 와우 할인 판매가는 비회원 가격(`nonWowMemberPrice`, 검색 결과 와우 카드는 확장이 링크를 뒤에서 받아 다음 step에 실음), 추천발주 예상 단가(연결 없으면 LLM이 거른 공용 상품 최저), 발주 확정 = [쿠팡 담기](담긴 품목으로만 finish에서 발주 저장, `approve`·`orders.status` 삭제, 확장 없으면 비활성)
- 사용자 정정 — 발주 품목 단가는 확정 시점이 아니라 담기 때의 결제 전 최종 가격, 상품명으로 찾은 후보는 LLM이 거르면 된다, 한 번 담으면 그 품목은 끝, 같은 값 재확인도 갱신이고 빈 판매가는 바로 넣는다. 기각: 단가 갱신일 칼럼(관측마다 단가를 다시 구하고 실패면 비우는 것으로 대체), 자정 배치 다수결(관측마다 계산), 14일 만료(이틀 초기화), 쿠키 뺀 검색 결과 재요청(로그인·비로그인 결과가 거의 안 겹침), 취소선 가격(비회원 가격 아님)
- 쿠팡 실측(research 16 §6.5~§6.11) — 옵션 구조·`itemId`와 판매자·어긋나는 상품·상품명 용량 대조 353개 중 343개 통과, 와우 카드 취소선은 로그인·비로그인 같고 비회원 가격은 그보다 낮음, 상품 페이지 `nonWowMemberPrice`는 로그인(와우 회원)·비로그인 모두 비회원 가격, 로그인 검색 결과 데이터에는 없음, 와우 카드 링크 `fetch` 8개 모두 200·0.55~0.84초·차단 없음
- 문서만 바꿨고 코드는 아직 1차 구조

### 쿠팡 자동 담기 — BE 1차 구현과 담기 에이전트 구조 재설계 (2026-10-28)

- BE 1차(3ffa48f~9ecf01f) — 마이그레이션 `0017_coupang_cart`(공용 쿠팡 상품·가격 후보, 재고 품목 연결 칸, `sites`·`last_price` 삭제), `coupang_pricing.py`(단위가격 표시 → 용량, 상품명 2% 대조, 단가), 공용 상품 저장 규칙(와우 할인·용량 불일치·20% 가격 후보·14일·다른 매장 확인), `automate/match`·`result`, LLM 클라이언트·보안 분류기(Ollama `qwen3.6:35b-a3b`). 검증: BE pytest 169/169, `0017` 왕복
- LLM 실측(research 17 §8~§12) — 게이트웨이 Claude는 추론 설정 무시, `gpt-6-sol`·`medium` + 행 번호 답에서 지시문 없는 세트 20/20·로그인 지시문 30/30·비로그인 지시문 6회 중 2회 4/5. 도구 호출은 두 걸음 이어 부르기 동작(작은 입력 걸음당 약 1.7초)
- 쿠팡 화면 실측(research 16 §6) — 요소 트리 검색 83,677자·상품 페이지 101,991자, 로켓프레시는 대체 글자 없는 그림, 스크립트 클릭·검색 버튼·`target` 지운 링크·수량 버튼은 되고 스크립트 엔터·수량 칸 값 설정은 안 됨, 수량 버튼 이름이 동작과 반대, 로그인 상태 본인 정보는 머리글 이름뿐
- 재설계(c4ea5df~e4877dd) — 확장을 서버 LLM이 화면을 보고 동작을 정하는 에이전트로. 사용자 정정: 확장은 Claude in Chrome 같은 것이지 셀렉터로만 움직이는 것이 아니다, 기본 흐름부터 잡고 안전장치·계산 도구를 덧붙이지 말 것, 막을 인젝션은 서버 LLM 오남용이다. 기각: 고르기만 한 번에 하고 조작만 에이전트(②), 클릭 결과에 바뀐 값 붙이기, 시작 전 장바구니 비교. spec `01` §3.3.1·§3.8, `02` §2.4·§3.7, `03_be` §2.4, `04_fe` §7.2·§12, plan `08` 다시 씀. 코드는 아직 1차 구조

### 날씨 — 매장 위치 + n8n 날씨 수집 (2026-10-28)

- 결정 — 날씨는 매장 위치 기준. 판매 이력 기간과 어제까지는 기상청 ASOS 일자료(가장 가까운 관측소), 오늘 이후는 단기예보(매장 격자). 주소 저장 시 BE가 Google Geocoding으로 좌표를 구해 격자·관측소를 `stores`에 둔다. 위치 없음·호출 실패는 날씨 없이 예측. spec `01` §3.11.1·§5.2.1, `02` §3.8·§4.3.3, `03_be` §2, `05_ai` §4.2, plan `09_weather.md`, research `backend/18`
- 논의와 기각한 대안 — 위치를 조치원 고정으로 두는 지름길 대신 매장별 위치(사용자 선택). 좌표 변환은 카카오 로컬(앱 카카오맵 설정을 못 찾음)·브이월드 대신 Google. 관측소 목록은 공공데이터포털 지점정보 서비스에 신청 버튼이 없어 기상자료개방포털 조회 결과로 받았다
- 사용자 정정 — 모델이 어떤 입력을 쓰는지는 모델 담당 몫이고, 우리는 spec대로 넘길 입력을 구성하면 끝이다
- BE — 마이그레이션 `0015_store_location`(위치 5칸), `app/integrations/geocoding.py`, `app/core/weather_location.py`(격자 변환·최근접 관측소), `app/data/asos_stations.json`(운영 중 ASOS 97곳), `StoreService.update_store`가 주소가 바뀔 때만 다시 계산, `app/scripts/backfill_store_location.py`. 테스트는 conftest가 Google 실호출을 막는다
- n8n — `forecast.json`에 '매장 위치'(MySQL)·'날씨'(Code, ASOS 999행 페이지·단기예보 오늘 02시 발표·3회 재시도) 노드, 'AI 입력'이 날씨를 넣는다. compose n8n 환경값 `KMA_SERVICE_KEY`
- 관측 날씨 저장 — 매 배치가 이력 기간 전체를 다시 받지 않게 `weather_observations`(관측소·날짜, 마이그레이션 `0016`)에 쌓고 없는 날짜만 받는다. 수집·저장 모두 n8n(외부 데이터 수집 층), BE는 위치 계산만. 예보는 저장하지 않는다. n8n 계정 권한 추가. 같은 시각 다른 세션의 쿠팡 마이그레이션과 번호가 겹쳐 쿠팡이 `0017`로 뒤에 이었다
- 검증: BE 컨테이너 pytest 132/132(신규 4), `0015` upgrade·downgrade 왕복. 실서버 — 확인용 매장(조치원 세종로 2639, 판매 60일)을 API로 만들어 위치 65·106·서청주 181 저장 확인, CLI 배치로 날씨 63일(ASOS 60 + 예보 3) → 예측 저장·`DONE`, 틀린 서비스키·위치 없음도 날씨 없이 `DONE`, BE 수동 실행(웹훅) 예측값이 날씨 있는 실행과 같음. 관측 저장 — 1회차 60행 저장, 2회차 새로 받음 0, 중간 하루 삭제 시 그 하루만 받음, `0016` 왕복. 02:00 스케줄 실제 발화는 미확인

### 대시보드 BE — 예측 vs 실제 매출 API (2026-10-28)

- 결정 — 대시보드 BE는 `GET /api/dashboard/forecast-vs-actual` 하나. 매출 추이·메뉴 비중은 기존 `GET /api/sales/trends`·`top-menus`로 그린다. 화면에 쓰는 곳 없는 요약(`GET /api/dashboard`)·폐기 현황(`/api/dashboard/waste`)과 대시보드 캐시(`dashboard:{store_id}`)는 spec에서 삭제. spec `02` §3.9, `03_be` §2·§12·§14.1.2
- 사용자 지시 — FE 그래프는 상황에 따라 바뀌거나 빠질 수 있다. 예측 데이터는 기본설계 §3.9.1 '수요예측 결과 시각화'·시연 8단계라 남을 가능성이 높아 API는 먼저 만들었다
- BE — 기간의 모든 날짜를 채워 실제 매출(마지막 판매일 이후 null, 그 이전 판매 없는 날 0)과 저장된 예측(매출·P10/P90·horizon, 없으면 null)을 돌려준다. 예측은 대상일마다 마지막 것만 남아 지난 날짜는 보통 하루 전 예측. `DashboardService`·`app/api/dashboard.py`, `Front/openapi.json`·`types.gen.ts` 재생성
- 검증: BE 컨테이너 pytest 128/128(신규 2). dev DB에 계정이 없어 실데이터 호출은 안 함

### 예측 배치 — n8n 모델 예측 + BE 추천발주 계산 (2026-10-28)

- 결정 — n8n은 모델 예측만(입력 조회·AI 예측·예측 저장·실행 기록·Slack), 추천발주는 산식이라 BE가 점주 요청 시 저장된 예측과 그 시점 재고로 계산. 확정 전 수정값은 서버에 저장하지 않는다(`PATCH /api/orders/recommend`·`adjusted_quantity` 삭제). spec `01`·`02`·`03`·`04`·`05`(사용자 지시로 `05_ai.md`도 직접 수정), plan `07_forecast_batch.md`
- 논의와 기각한 대안 — 처음 안은 'n8n은 깨우기만, 계산·저장은 전부 BE 내부 API'였다. 사용자 정정: 책임 분리 관점에서 n8n = 모델 예측, 발주 계산 = 알고리즘이라 BE. 수정안 저장은 "확정 버튼이 있는데 중간값을 서버에 둘 이유가 없다, 필요하면 FE 브라우저 저장소"로 MVP·2단계 모두에서 뺐다
- AI Server — `/ai/orders/recommend` 삭제, `/ai/forecast/predict`가 `menu_sales_history`를 받아 대상일별 `menu_forecast` 반환(이력 부족·날짜 불일치면 빈 배열)
- BE — 마이그레이션 `0014_forecast_v2`(`forecast_results` v2·`forecast_menu_items`, `adjusted_quantity` 삭제). `GET /api/forecast`는 저장분(+메뉴 이름), `POST /api/forecast/run`은 n8n 웹훅을 기다려 저장분 반환(10분 이내 RUNNING이면 429, 이력 부족 422, 실패 503). `OrderService.recommend`가 §3.7.2 산식을 직접 계산(AI 서버 산식·문구 이관). `GET /api/pipeline/status`·`/history`, `POST /api/pipeline/forecast-done`(`X-Internal-Token`). `ai_client` 삭제, `n8n.run_forecast` 추가
- n8n — `docker/n8n/forecast.json`(시작점 셋: 02:00 스케줄·웹훅·CLI 재실행 → 매장마다 작업 기록 → 일별 매출·메뉴별 판매 → AI 예측(3회 재시도) → `JSON_TABLE`로 예측·메뉴 수량 UPSERT → 완료·BE 알림, 실패는 실패 기록·Slack). 웹훅은 헤더 인증, 값은 base64로 넘겨 쉼표가 파라미터 구분을 깨지 않게 했다. `docker/n8n/setup.sh`(자격 증명·워크플로우 설치), `docker/mysql/n8n_user.sh`(§4.5 권한), compose n8n 시간대 `Asia/Seoul`·환경값
- 검증: BE 컨테이너 pytest 126/126(신규 예측 9·파이프라인 7·발주 산식 3), AI pytest 14/14, `0014` upgrade·downgrade 왕복, FE Vitest 61/61. 실서버 — 30일 매장 수동 실행 → 예측 3일·메뉴 수량·`DONE`·예측 완료 알림, 추천 원두 797g(손계산 일치), 재실행 시 행 중복 없음(3·6행), 5일 매장 422·`FAILED`. CLI로 전체 매장 실행 시 4곳 중 2곳 `DONE`·2곳 이력 부족 `FAILED`로 끝까지 진행. 날씨 수집·Slack 발송·02:00 스케줄 실제 발화는 미확인

### 알림 BE — 인앱·Web Push·소비기한 배치·파기 증빙 이메일 (2026-10-28)

- spec 결정 — 알림 단위(소비기한 품목·조건, 재고 부족 품목, 이상치 업로드당), 소비기한 초과는 첫날 한 번, 같은 날 재실행 건너뜀, 알림 설정 4묶음(`users.notify_*`, 끄면 인앱·푸시 모두 안 만듦), 설정 API 2개. `01_basic_design.md` §3.3.6·§3.12, `02_implementation_design.md` §2.7·§3.10·§4.3.1. plan `06_notifications.md`
- `NotificationService.create_and_push` — 저장 뒤 구독마다 pywebpush(워커 스레드), 404·410 구독 삭제, VAPID 키 없으면 푸시 생략. 푸시 내용 `title`·`body`·`url`(FE `sw.ts` 형식)
- API 7개(`/api/notifications`) — 목록 60/min·구독 10/min을 토큰 `sub` 기준으로 제한(`rate_limit.py` 식별자 추가)
- 트리거 — `InventoryService.check_expiry_batch`(ARQ 01:30, `worker.py`), `SaleService.upload_csv` 끝의 이상치·재고 부족 알림. 이상치 탐지기는 아직 빈 껍데기라 실제로는 이상치 알림이 나지 않는다
- 파기 증빙 이메일 — `app/integrations/mailer.py`(fastapi-mail 1.5.0), dev는 `MAIL_SUPPRESS_SEND=true`. 마이그레이션 `0013_notification_settings`. 의존성 `pywebpush==2.0.3`·`fastapi-mail==1.5.0`(기존 고정 버전을 올리지 않는 조합)
- 검증: BE 컨테이너 안 pytest 110/110(신규 18건), `0013` upgrade·downgrade 왕복, `arq-worker` 기동 시 `cron:check_expiry` 등록, FE Vitest 61/61. 실제 기기 푸시 수신은 FE 구독 화면 전이라 미확인

### 판매 조회 BE — 판매 목록·인기 메뉴 기간 지정 (2026-10-28)

- `GET /api/sales` — 기간(양 끝 포함, 366일 상한) 판매 목록과 기간 합계(`total`·`total_revenue`), 메뉴 필터, `sold_at` 정렬 `order` asc·desc, `size` 최대 100
- `GET /api/sales/top-menus` — `start_date`·`end_date`(둘 다 주거나 둘 다 생략), `limit` 최대 100
- 기간 검사·기간 조건·메뉴 조회를 `SaleService`의 추세 조회와 같이 쓰도록 묶었다
- `Front/openapi.json`·`types.gen.ts` 재생성
- 검증: BE 컨테이너 안 pytest 94/94(신규 판매 조회 13건), FE Vitest 61/61. `tsc`의 `src/sw.ts` workbox 모듈 오류 2건은 변경 전부터 있던 것

### 발주 입고 처리 + 재고·메뉴 화면 재설계 — `8f654d5` (2026-10-28)

- 같은 추천안 재확정 409(`orders.recommendation_id` 유니크). 확정 화면은 성공·409 뒤 추천을 새로 받는다
- 입고 처리 — 발주 품목 입고 대기·입고 완료·입고 안 함, `receive`(로트 생성과 상태 변경 한 트랜잭션)·`skip` API, 로트 조회에 `pending_orders`. 입고 예정량은 입고 대기 수량 합계로 AI 입력 `incoming_quantity`에 넣어 추천량에서만 뺀다(소진 예상일은 현재고 기준)
- 단가 — 출처는 매장 공용 쿠팡 상품 테이블 하나(쿠팡 Open API는 판매자 자기 상품용, 서버 크롤링 안 함). 테이블과 확장의 가격 전송은 쿠팡 자동 담기 때 만든다. 그 전까지 단가 미설정, 확정 단가·소계 null(0 하드코딩 제거)
- 화면 — 재고 상태 배지 제거, 소비기한 D-3 이내·수량 경고는 글씨 색. 재료 펼침 맨 위 입고 대기 카드. 발주 단가·예상 금액·이력 입고 상태. 레시피 관리 → 메뉴 관리 `/menus`(판매가·레시피 한 화면, 추가·삭제). 단가 관리 화면 삭제
- 문서 — spec `01` §3.3.1·§3.7.2·§3.7.4·§3.7.5, `02` §3.5·§3.7·§4.3.20, `04_fe` §4.5·§4.6·§4.9. plan `05_inventory_receipt.md`. 목업 10·11·12(메뉴 관리)·14, 16 삭제
- 논의와 기각한 대안 — 다시 꺼내지 않는다
  - 작업 순서: 전면 재구현 대신 영역별 재설계, 재고·발주부터. 나머지 FE는 BE 기능 뒤 'FE 일괄'로 한 번에
  - 하루 추천안 고정(날짜로 추천안 하나) — 입고 예정량이 확정 후 재추천을 0에 가깝게 만들어 불필요, 같은 날 재추천도 막혀 기각
  - 입고 예정량을 '확정 시각 + 리드타임'으로 추정 — 입고 처리로 대체. BE가 현재고에 합쳐 보내는 안은 소진 예상일이 늦게 나와 기각, AI 입력 칸으로 분리(AI 학습과 무관한 산식 단계)
  - 재료별 단가 칸(`inventory_items`)·단가 수동 입력·구매 금액으로 단가 갱신 — 단가는 공용 테이블 한 곳만으로 결정되며 기각
  - 가격 수집: 쿠팡 Open API 103개에 타 상품 가격 조회 없음(판매자 자기 상품용). 다나와류는 쇼핑몰 제휴 EP 피드라 해당 없음. 서버 크롤링은 쿠팡이 `robots.txt`도 403으로 막아 봇 우회가 필요하고, 우회(Scrapling 스텔스 등)는 약관·법적 위험·기존 '봇 우회 미사용' 정책으로 기각. 확장이 점주가 연 페이지를 읽는 경로만 남김
  - 공용 상품 테이블은 매장 공용(매장별 기각) — 매장이 늘수록 가격이 자주 갱신된다
  - 단가 관리 화면 — 재료 단가는 발주 추천에 보이므로 폐지, 메뉴 판매가는 메뉴 관리로
  - 기존 0원 발주의 입고 상태 처리 — dev 데이터뿐이라 불필요
- 검증: BE pytest 82 통과(컨테이너 안), FE Vitest 61 통과·typecheck 통과(`sw.ts` workbox 미설치 2건 제외), AI pytest 15 통과. `0012` upgrade·downgrade 왕복. 실서버(BE+AI) 흐름 — 추천 2,125.84g 확정 → 재확정 409 → 다음 추천 '− 입고 예정 2,125.84'로 0g → 입고 처리로 로트 생성·총 수량 3,125.84g·RECEIVED → 재입고 409. 로컬 `.env`의 `AI_SERVER_BASE_URL`이 `ai-server`로 되어 있어 `ai`로 고침. 화면은 목업·Vitest로만 확인

### FE 리디자인(PR #37) 검토·머지 + 화면 목업 갱신 — `db57753`·`78fca68` (2026-10-26)

- PR #37(CH, 웹·앱 리디자인 + PWA + `/intro`) 검토 — 바뀐 것은 화면과 동선. API·저장 데이터 변경 없음, 홈이 메뉴 목록 대신 AI 발주 추천(`getAIRecommend`)을 부르는 것 하나와 PWA(SW `NavigationRoute`·`skipWaiting`, 설치 안내)·의존성 3개 추가. 판단은 목업으로 미루고 머지
- 목업 갱신(PR #38) — `mockup.js`에 디자인 토큰·Pretendard·새 셸(웹 상단 내비 / 앱 상단바·하단 탭 5개)·lucide 아이콘 54종·'웹 / 앱 390' 프레임 보기. 01~20을 PR tsx 마크업으로 다시 옮기고 `21_intro.html` 추가. PR 동작 그대로 재현한 상태 포함(홈 'AI 추천 실패' 배너 등)
- 검증: 21개 화면 상태별 헤드리스 크롬 1440px·390px(앱 프레임) 캡처 확인, 아이콘 이름 누락 0·옛 hex 색 0. PR 빌드는 `vite build` 통과, `vite preview` + dev BE 프록시 응답 확인(로그인 후 화면은 목업으로만 확인)

### 로컬 개발·운영 통일 + 신뢰 프록시 Caddy 고정 IP — `5f861a7` (2026-10-25)

- 원인 — `261fd6e`의 compose `FORWARDED_ALLOW_IPS: "172.16.0.0/12,..."`를 gunicorn 23이 자기 설정 기본값으로 읽고 개별 IP 목록으로만 검증해 BE가 재시작 반복. 커밋 당시 검증은 호스트 uvicorn 단독이라 드러나지 않았다
- 통일 — 로컬 개발도 운영과 같은 compose·이미지·실행 명령(Gunicorn + uvicorn.workers). spec `03_be.md` §1·§15.2, `PROGRESS.md` §3 갱신
- 신뢰 프록시 — compose 기본 네트워크 `172.28.0.0/24`, Caddy `172.28.0.10`, `FORWARDED_ALLOW_IPS=172.28.0.10`. 대역 신뢰는 게이트웨이를 거친 8000 직접 접속까지 믿게 돼 고정 IP로 좁혔다(`03_be.md` §13.4)
- 검증: 7개 컨테이너 healthy, BE pytest 79 통과(컨테이너 안). 로그인 6회 — Caddy 경유 꾸민 XFF 401×5→429, 같은 시점 다른 접속자 401, 8000 직접 꾸민 XFF 401×5→429
- dev 화면 확인 — 카카오·구글 실계정 로그인 → 사업자 인증 화면, 카카오로 온보딩 완료(가게·메뉴 저장). 재고 화면 기본 정렬·방향 전환·새로고침 유지, 소비기한 열(지남·D-n·없음), 배지 6종 판정과 우선순위, 레시피 화면 재고 차감 토글(레시피 없으면 막힘, 켜면 저장). 숫자만인 마스터 코드는 FE 입력 마스크가 하이픈을 넣어 보내 BE 비교가 어긋나 `PENDING`이 됐다 — 코드는 두고 로컬 `.env` 값을 `NNN-NN-NNNNN` 형태로 바꾸고 `.env.example`에 형식 안내, 마스터 코드 테스트 2개 통과

### spec ↔ 구현 불합치 9건 정리 — `c8447dc`..`f421cc0` (2026-10-25)

- 발주·재고 — 안전재고 미설정 시 0으로 추천 요청, 재료 수정 API 500 수정(커밋 후 refresh 누락), 임계값 발주 추천 폐기(AI 추천 단일화)
- 재고 책임 경계 — BE는 원본값만(`nearest_expiry_date`·`needs_check`), 경고 배지(확인 필요 > 없음 > 지남 > D-1 긴급 > D-3 임박 > 부족)·정렬은 FE `stock-status.ts`. `/api/inventory/summary`·`/alerts` 삭제, 정렬 선택은 preferences 스토어(LocalStorage) 신설
- 메뉴 — 재고 차감 ON은 레시피(재료 1개 이상) 필수. OFF로 등록 후 레시피 저장 뒤 켬, ON 상태에서 레시피 비우기·삭제 거부(`MENU_RECIPE_REQUIRED`). 목록·상세에 `has_recipe`. 마이그레이션 `0011`(리비전 ID 32자 제한 주의). 레시피 화면 토글, 온보딩 차감 체크박스 삭제
- 판매 — 기간별 매출 4개 API를 `GET /api/sales/trends`로 통합(일·주·월, 전체·메뉴별, 빈 구간 0), 홈·수요예측 전환
- 인증 — Access TTL 1시간, OAuth를 Authlib로 교체(`SessionMiddleware`·`SESSION_SECRET`, 구글 id_token·nonce 검증), 로그인·가입 5/min·refresh 30/min Rate Limit(fastapi-limiter, 키는 `client.host`, compose `FORWARDED_ALLOW_IPS`)
- 타입 — `scripts/export_openapi.py` → `Front/openapi.json` → `pnpm gen:api`. 손 타입 55개를 생성 타입 별칭으로. 수량 Decimal 응답을 숫자로(`JsonDecimal`)
- 기타 — 오류 코드 spec 이름으로(재고·메뉴 중복, AI 연결 실패), 매장 규모 좌석 기준 문구, POS 코드값 `TOSSPLACE`·`KIWOOM`·`OKPOS`(온보딩 선택지 교체), 미들웨어 등록 순서 spec대로
- 검증: BE pytest 76 통과(신규 14, 업로드 경로 `/app` 3건은 호스트 실행 환경 실패), FE Vitest 51 통과(신규 10)·typecheck 통과. `0011` upgrade·downgrade 왕복, 실 Redis로 Rate Limit 429, 구글 로그인 시작 302 확인. 실계정 로그인·화면 확인은 미실시

### 재고 로트·FIFO 판매 차감 — `1bb672d` (2026-10-19)

- 스키마 — 마이그레이션 `0010`: `current_quantity`를 로트(`purchase_price` 0, 입고일 = 등록일 KST)로 옮기고 컬럼 삭제, `deducted_until`(초기값 등록 시각 KST)·`needs_check` 추가, `unit_price` → `purchase_price`. downgrade는 로트 합계로 수량을 복원하고 로트·조정·폐기 이력을 비운다
- 판매 차감 — `InventoryService.deduction_context`·`deduct_stock`. 업로드 시작 시 차감 기준 시각을 스냅샷으로 잡고, 청크마다 INSERT 전에 기존 `external_sale_id`를 조회해 새 행만 차감. 품목·로트 행 잠금(FOR UPDATE), 청크 커밋은 `SaleService`. 업로드 응답에 `inventory_deduction`
- 재고 API 12개 — 등록 시 첫 로트, 로트 입고·조회·조정(`STOCKTAKE`면 `needs_check` 해제)·폐기(422 `INVENTORY_DISPOSE_EXCEEDS`), `alert_status`(NEEDS_CHECK > EMPTY > EXPIRED_SOON > LOW > NORMAL)·summary·alerts. 예측 입력의 재고 수량도 로트 합계
- FE — 재고 표 행을 펼쳐 로트 입고·수정·폐기, `AlertBadge`, 홈 재고 카드, 업로드 결과의 차감 건수·'재고 확인 필요' 안내
- 수정 — 재고 등록 폼에서 안전재고·리드타임을 비우면 0이 전송되던 문제(zod union 순서). 안전재고 0은 '직접 설정'으로 판정돼 '설정 필요' 배지가 빠졌었다
- 검증: BE pytest 65 통과(신규 8), FE Vitest 42 통과(신규 5), typecheck 통과. `0010`은 임시 품목(수량 있음·없음, UTC 20시 생성)으로 upgrade → downgrade → upgrade 왕복 확인. 10만 행 합성 CSV(메뉴 96개, 재료 8개·로트 3개씩) 업로드 차감 없음 9.26초 / 차감 있음 10.28초

### 보안 3건 — POS 키 암호화·BE 사업자 검증 게이트·탈퇴 30일 유예 — `837d095` (2026-10-03)

- POS 키 — `pos_connections.api_key`를 AES-256-GCM으로 저장(`core/crypto.py`). 행마다 새 nonce, `store_id`를 연관 데이터로 묶음. 응답은 복호화 후 마스킹. 기존 평문 행은 마이그레이션 `0008`이 암호화(평문 행으로 upgrade·downgrade 왕복 확인)
- BE 단계 가드 — `require_business_access`를 메뉴·재고·판매·발주·예측·POS·단가 라우터와 매장 수정·온보딩 완료에 적용. `PENDING`·`VERIFIED`이고 탈퇴 유예가 아닐 때만 통과, 그 외 403 `BUSINESS_NOT_VERIFIED`. 상태는 요청마다 DB 조회. FE는 이 403을 받으면 me를 다시 받아 검증 화면으로 보낸다
- 탈퇴 — `users.withdrawn_at`(마이그레이션 `0009`). 탈퇴 즉시 Refresh Token 전부 폐기, 로그인 403·재가입 409 `AUTH_ACCOUNT_WITHDRAWN`, OAuth 콜백은 `/login?error=withdrawn`으로 302. 철회 없음. ARQ 크론 매일 03:00 KST `AccountPurgeService`가 30일 지난 계정을 매장 데이터·등록증 파일과 함께 삭제. 증빙 이메일은 알림 작업으로 미룸
- FE — 계정 설정에 회원 탈퇴(이메일 계정 비밀번호 확인 + 파기 동의 체크), 로그인 화면 탈퇴 안내 2종
- spec — `12_security.md` §3.1·§4.1·§5.1, `07_api_spec.md`(403 사례·POS 입력 상한·탈퇴 응답 표), `08_schema.md` users, `09_service_design.md` ARQ cron
- 검증: BE pytest 57 통과(신규 12), FE Vitest 37 통과(신규 5), typecheck 통과. 재빌드한 arq-worker가 크론 등록 상태로 기동, 컨테이너 안에서 파기 잡 1회 실행 확인

### AI 추천 → 발주 확정 연결 — `8d6a81f` (2026-10-03)

- 발주 저장을 spec 5테이블(`08_schema.md` §3.17~§3.21)로 전환. ORM 신설(`models/order.py`), `purchase_orders`·`POST /api/orders/confirm` 폐기(마이그레이션 `0007`, 기존 행 미이전)
- `GET /api/orders/recommend` — AI 결과를 추천안으로 저장하고 `recommendation_id` 반환. 발주에 연결되지 않은 당일 추천안은 대체. `config_status`를 BE가 판정(AI의 `OK` 대신 `USER_CONFIGURED`/`DEFAULT_USED`)
- `POST /api/orders/approve`·`GET /api/orders`(페이지네이션)·`GET /api/orders/{id}`·`GET /api/orders/{id}/approval-log` 구현. 수정 이력은 추천 품목 전체 + 추가 품목
- 재고 삭제 — 발주 내역에 포함된 재료는 409, 추천 스냅샷 행은 함께 삭제
- FE `orders.tsx` — AI 추천 표에 선택·수량 수정·확정 추가(`recommendation_id` 동반), 임계값 표는 `null`로 확정, 이력은 펼쳐서 상세 조회. 미설정 재료에 '설정 필요' 배지
- spec — `07_api_spec.md` §7(추천안 저장·`recommendation_id`·단가 단위·수정 이력 규칙·400/404), 재고 삭제 409
- 검증: BE pytest 45 통과(신규 7), FE Vitest 32 통과(신규 3), typecheck 통과. 실 BE + 실 AI 서버 스모크(45일 판매·레시피 2종)로 추천 → 확정 → 내역·이력 → 삭제 409 확인
- 부수: FE `node_modules`가 vitest 2.1.9로 남아 typecheck가 깨져 있던 것을 lockfile 기준 재설치로 해소(3.2.4)

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

### 2026-10-28 — 쿠팡 자동 담기 spec 정합 + research 결정 제거

- 단가·쿠팡 상품 — `02`·`03`에 남아 있던 서버 크롤링 구조(`inventory_item_sites`·`sites`·`SiteScrapingService`·재고 API `coupang_url` 입력)를 지우고 `01` §3.3.1 공용 테이블에 맞췄다. `coupang_products`(정가·용량) 신설, `inventory_items`에 연결·연결 시각·포장 수량 칸, `coupang_price_candidates`(3% 초과 가격 후보). DDL 절 번호 §4.3.14~24 → §4.3.13~23, 후보 테이블은 §4.3.24. 쓰이지 않던 `last_price` 2곳 삭제
- 자동 담기 — 검색어·LLM 호출 횟수·연결 상품 3일 규칙·확장 전송 필드(상품 ID·정가·표시 가격·단위가격 표시)·담기 결과의 상품 값. `03`의 쓸 데 없는 에러 코드 2개 삭제, 타임아웃을 `04_fe` §12.7로 이동. LLM 클라이언트 구조 `03` §2.4 신설
- research — backend·frontend 24개 문서에서 채택·선발·판정을 지우고 관찰만 남겼다(`14_security_open_items` §4-A 포함). 깨진 참조 7곳 정리. `15_coupang_price_validation.md` 신설
- 연동 참조 — spec·`PROGRESS.md`·코드 주석의 DDL 번호, `05_ai.md` 2곳
- 쿠팡 실동작 확인(`16_coupang_page_probe.md`) 뒤 후속 — 검색은 검색창 입력(주소 직접 접근 차단), 비로그인 시 로켓프레시 제외·알림, 공유 가격은 정가 대신 누구나 받는 판매가(와우 할인 상품 갱신 안 함), 가격 검증 20% + 상품명 용량 대조
### 2026-10-28 — `PROGRESS.md` 작업 흐름 절 삭제

§2 '작업 흐름'이 `docs/README.md`와 다른 규칙(파일명 자유, spec 없는 흐름)을 적고 있어 지웠다. §3·§4 → §2·§3. 번호 참조처 `docs/README.md`·`plan/01~03`·`research/backend/01_web_framework.md`를 함께 고쳤다. `PROGRESS_*` 이력 서술은 그대로 둔다.

### 2026-10-28 — 문서 규칙의 plan 정의 정정

`docs/README.md` §4 — plan은 큰 작업마다 착수 때 `NN_<작업명>.md`로 새로 만들고 끝난 plan은 고치지 않는다, `01~04`는 이전 구현 기록, 목록에 `05_inventory_receipt.md` 추가. §2-1 연동 맵에서 `plan/01_be.md`·`plan/02_fe.md` 제거. §5-1 팀원 문서 경로 `plan/ai/` → `plan/03_ai.md`.

### 2026-10-26 — 화면 목업을 FE 리디자인 기준으로 갱신

`docs/plan/mockup` 01~20 재작성, `21_intro.html` 추가, `mockup.js` 셸·토큰·아이콘·앱 프레임 보기. `00_wireflow.html`은 예전 사이드바 구조 그대로 둠.

### 2026-10-25 — spec 불합치 정리에 따른 spec 결정

`01`: 메뉴 재고 차감 = 레시피 필수(§3.2), 판매 상세 하루 단위(UC-03), POS API 연동 MVP 편입·3사 한정·코드값(§3.4.3). `02`: 재고 목록 전체 반환·판정값 없음·summary/alerts 삭제, 판매 `trends`·`top-menus`·`summary`·목록(`total_revenue`, 기간 필수) 확정, `/api/sales/{sale_id}` 삭제, `/health` 공통 규약 예외, 메뉴 API `has_recipe`·422, 알림 목록 공통 페이지네이션, 대시보드 `inventory_summary` 삭제, POS [2단계] 표시 제거·MVP 범위 이동. `03_be`: BE·FE 책임 경계(§2), 오류 코드 표 보강·`MENU_RECIPE_REQUIRED`, Rate Limit IP 판정, 미들웨어 순서에 Session 추가, 재고 요약 캐시 삭제. `04_fe`: 책임 경계(§7.0), 재고 배지·정렬(§4.6), OpenAPI 생성 절차(§7.1), Vitest 3, 온보딩 메뉴·POS 단계. `PROGRESS.md` §3에 결정 행 6개(발주 추천 단일화, 매출 집계 API, 재고 차감 = 레시피 필수, BE·FE 책임 경계, MVP 데이터 갱신 포함). plan 목업 5개 동기화. `research/backend/13_pos_adapter.md` 상태 갱신.

### 2026-10-19 — spec 14개 → 5개 재편

`01_basic_design`(요구사항·유즈케이스·기능 명세·사용자 흐름·비기능·제약) · `02_implementation_design`(MVP 범위·시퀀스·API 계약·DB 스키마) · `03_be` · `04_fe` · `05_ai`(옛 `11_ai_spec`, 절 번호 유지). 같은 사실은 정의 위치 한 곳에만 두고, 미확정·검토 중 항목, 배경·이력·근거 문장, 실측치, [2단계] 상세를 지웠다(POS API 연동은 [2단계] 표시로 남김). [2단계]는 `02` §1.4 목록에 모았다. 서버 단가 수집(발주 확정 후 갱신·초기 조회)은 장바구니 자동화(확장)와 별개 기능이라 `03_be` §6에 유지. 원본끼리 어긋난 값은 실제 코드와 맞는 쪽으로 정리했다(추천발주 산식 `일일 소모량 × (대상 기간 + 리드타임)`, FE Sentry 표본율·마스킹, OAuth 경로 `/api/auth/login/{provider}`, 관리자 경로 `/admin/verifications`). 저장소 참조(코드 주석·AI 코드·노트북·plan·research·README·CLAUDE.md·HANDOFF·`PROGRESS.md` §3)를 새 주소로 갱신. PROGRESS 이력 항목은 옛 주소 그대로 둔다. DB 계정은 `ops_readonly`에 감사 로그 조회 권한 추가, 개발 계정은 전체 권한 마스터 `dev_master`, 감사 대상은 `inventory_adjustment_logs`로 정리.

옛 → 새 대응: 01 → 기본 §1·§3·§5·§6 / 02 → 기본 §2 / 03 → 구현 §1 / 04 → 기본 §3(§4-1 → §3.5, §5~§11 → §3.6~§3.12, §12 → FE §4) / 05 → 기본 §4(§9 → FE §4, §10~§15 → §4.9~§4.14) / 06 → 구현 §2 / 07 → 구현 §3 / 08 → 구현 §4 / 09 → BE(§7 → §8, §8 → §11, §9 → §12, §10 → §13, §11 → §15) / 10 → FE(§4~§10 → §5~§11) / 12 → BE §7(§2)·§10(§4)·§8~§9(§5), 기본 §5.1·§5.2·§6.2~§6.4 / 13 → 기본 §5.3(§1), BE §14(§2~§5) / 14 → FE §12 / 11 → `05_ai`(절 번호 동일).

### 2026-10-19 — 점주 웹 와이어플로우·화면 목업

`docs/plan/mockup/` 신설. `00_wireflow.html`은 현재 `Front/src/routes` 기준 화면 22장을 4개 흐름(진입·온보딩, 가입·심사, 앱, 매출 데이터·설정)에 놓고 누르는 곳 46개와 전환 경로, 진입 분기 표, 화면별 목업 상태, 코드상 미동작 항목을 한 장에 담았다. `01`~`20`은 화면별 목업으로, 원본 tsx의 Tailwind 클래스를 그대로 옮기고 데이터만 가짜로 채웠다(Tailwind v4 브라우저 빌드, 공용 `mockup.js`가 셸·차트·상태 전환·이동 막대 담당). 상태는 `?state=`로 연다. 헤드리스 Chrome 스크린샷으로 상태별 렌더링 확인. `docs/README.md` §1 폴더 구조에 반영.

### 2026-10-19 — 재고 로트·FIFO spec 빈칸 정리

구현 전에 막히던 6건을 닫았다. 판매 차감은 품목별 '차감 기준 시각' 이후 판매만(시작값 등록 시각, 중복 행 제외), 품목 등록 수량은 첫 로트로 저장, 폐기는 로트 지정, 소비기한 없는 로트는 기한 있는 로트 뒤에 입고일 순, '재고 확인 필요'는 품목 상태(`needs_check`)로 두고 입고·실사 조정 시 해제, 로트 금액은 구매 총액(`purchase_price`). 레시피 단위는 재고 단위로 보고 환산하지 않는다. `09_service_design.md` §5의 업로드 트랜잭션을 실제 구현(청크 단위 커밋)에 맞췄다. 문서: `04_feature_spec.md` §3.1~§3.5·§8 폐기 비용·§12 폼, `05_user_flow.md` §5, `06_sequence.md` §6, `07_api_spec.md` §5·§6 업로드 응답·§8 재고 수량 주석, `08_schema.md` §3.8·§3.9, `09_service_design.md` §5, `plan/01_be.md` InventoryService, `PROGRESS.md` §3 '재고 차감' 행. 구현 중 보완: `08_schema.md` `deducted_until`은 매장 현지 시각, `07_api_spec.md` 품목 삭제 시 로트·조정·폐기 이력 함께 삭제, `plan/01_be.md` `deduction_context`·`deduct_stock` 행.

### 2026-10-03 — 브랜치 전략 GitHub flow 전환

main을 `dev`(`ef17204`)까지 fast-forward해 Phase 2~7·11·12 구현 코드를 처음으로 main에 올렸다. 장수 브랜치 `dev`·`be`·`fe`·`ai`를 폐기하고 짧은 작업 브랜치 → main PR로 바꿨다. 담당자는 직접 푸시 또는 PR, 그 외 팀원은 PR 필수. 저장소에 머지 후 브랜치 자동 삭제를 켰고, 중복된 PR #36(DW 이름 변경)은 닫았다. 문서: `README.md` §5 전면 교체, `PROGRESS.md` §3 2행 교체·1행 정리, `CLAUDE.md`·`AGENTS.md` 규칙 5, `AI/README.md`, `docs/README.md` §5-3.

### 2026-10-03 — 팀원 이력 문서 이니셜 정정

`PROGRESS_DY.md` → `PROGRESS_DW.md`(정동욱), `PROGRESS_MY.md` → `PROGRESS_MW.md`(이민욱). 참조처 `PROGRESS.md` §4·`plan/03_ai.md`·`CLAUDE.md`·`AGENTS.md`를 함께 고쳤다. 검증: 추적 파일 내 옛 파일명 0건.

### 2026-09-13 — 범위 재확정 + 쿠팡 자동 담기 구조 전환 + 문서 전수 정합

**범위 되돌림.** 9-12에 "졸업 시연까지"로 줄이며 폐기했던 Phase 8(n8n 배치)·10(쿠팡 자동 담기)·13(통합 검증·배포)을 전부 범위 안으로 복원했다. n8n은 컨테이너가 이미 떠 있고 `n8n_user` DB 직접 쓰기 설계까지 되어 있어 노드 배선만 남았고, 배포는 자체 Mac mini SSH로 확정됐다. plan 5개를 `28c6fd9^`·`efb2ea8^`에서 꺼내 `01_be`·`02_fe`에 합쳤다. Phase 10은 착수 우선순위 최하로 명시했다.

**쿠팡 자동 담기 구조 전환.** 서버 Playwright는 점주의 쿠팡 자격증명을 서버가 보관해야 하는 구조라 폐기했다. 사주라 브라우저 확장이 점주 브라우저에서 담고, 서버는 담을 상품을 고르는 판단(LLM 1회)과 결과 기록만 한다. `14_extension_design.md` 신설 — 권한을 `*://*.coupang.com/*`로 한정, 확장이 서버로 보내는 필드를 상품명·가격·용량·링크로 화이트리스트(로그인 페이지 DOM의 이름·배송지·주문이력이 외부 LLM으로 나가는 것을 차단), LLM은 검색어 생성과 상품 선택에만 사용. `POST /automate`를 `/automate/match` + `/automate/result` 2단으로 분리했다. 부수 효과로 `09_service_design` §1에서 Playwright·BeautifulSoup4가 빠지고 BE 메모리 peak가 3.6GB → 2GB로 내려갔다.

**예측 저장 구조 재설계.** `forecast_results`가 `menu_id NOT NULL`·`predicted_quantity`·`confidence_score`로 38차 이전 v1 전제였다. 원본(`11_ai_spec.md` §2·§3.3)에 맞춰 매장 일 매출 + P10/P90 + horizon + `explanation`(JSON)으로 바꾸고, 메뉴 분해는 `forecast_menu_items`로 분리했다(24테이블). §3.16 이후 절 번호가 밀려 참조 9곳을 따라 고쳤다.

**단가.** 품목별 쿠팡 최저가는 품목↔쿠팡 상품 매핑 도메인이 있어야 동작한다. 명세는 쿠팡으로 두고 KAMIS 오픈API를 현재 대체 경로로 기록했다. KAMIS는 시장 시세라 `inventory_item_sites.last_price`에 저장하지 않는다고 못 박았다 — 나중에 쿠팡 단가가 붙을 때 같은 칸을 놓고 싸우지 않게.

**입력 변수 목록 통합.** 나열이 4개 문서 7곳에 각각 다르게 있었다. SNS 노출도·지역 이벤트·주변 행사 정보는 원본 `11_ai_spec.md` §4 어디에도 없는 유령 변수였고, 반대로 학사일정은 모델의 핵심 피처인데 요구사항에 없었다. 유령 3개를 §4에 [2단계]로 정식 등록하고(수집은 전용 API 대신 AI SDK), 나머지 6곳의 나열은 §4 참조로 바꿨다.

**그 밖에** — 배치 시각 분산(ARQ 01:30 / n8n 02:00), `07_api_spec` §7 사전생성 MVP 복귀(9-12에 [2단계]로 잘못 내렸던 것), `03_mvp_scope` §8을 실측(walk-forward 5 fold, 60 영업일 초과)으로 갱신, `plan/03_ai.md` 4건 정리.

검증: 전체 `*.md` 깨진 링크 0건, §참조 스캔 0건.

**DY 통보 대기**: `11_ai_spec.md` §4 [2단계] 3항목 추가, 절 번호 변경(9-12 합본), `00_ml_guide_reference.md` 폐기(`efb2ea8^`에서 복구 가능), `plan/03_ai.md` 4건 정리.

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
