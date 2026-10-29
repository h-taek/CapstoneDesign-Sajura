# 08 쿠팡 자동 담기

> 범위 결정은 spec에 있다 — 단가·공용 쿠팡 상품·가격 검증 `01_basic_design.md` §3.3.1, 담기 규칙 §3.8.1·§3.8.2, API `02_implementation_design.md` §2.4·§3.7, DDL §4.3.8·§4.3.12·§4.3.24, 담기 에이전트 서버 `03_be.md` §2.4, 확장 `04_fe.md` §12. 쿠팡 페이지 실측은 `research/backend/16_coupang_page_probe.md`, LLM 실측은 `research/backend/17_llm_product_selection.md`.

## 1. BE

이미 있는 것(3ffa48f): 마이그레이션 `0017`, `CoupangProduct`·`CoupangPriceCandidate`와 재고 품목 연결 칸, `coupang_pricing.py`, 재고 PATCH `pack_quantity`, 공용 상품 저장 규칙(`AutomationService._save_product`·`_apply_price`). 아래 0번으로 고친다.

0. 공용 쿠팡 상품 구조 — `0017`을 고쳐 쓴다(push 전이라 새 번호를 만들지 않고 dev DB는 `0016`으로 내렸다 다시 올림). `coupang_products` 키를 `item_id`로, `product_id`·`vendor_item_id`·`option_name`·`unit_price` 칸, 임의 키 `coupang_product_id`·고유 제약 삭제. `coupang_price_candidates`를 `coupang_store_prices`(키 `item_id`+`store_id`, `sale_price`·`unit_price`·`received_at`)로 바꾼다. `inventory_items.coupang_item_id`, `pack_quantity` 삭제. `coupang_pricing.py` — 상품명 나누기(첫 쉼표), 용량 계산(옵션 이름 → 없으면 상품명의 기준 용량 하나 × 옵션 이름 개수, g·ml·개로), 관측 단가 대조(쿠팡 단위가격 표시와 2%), 매장 가격 덮어쓰기와 다수결(가장 많은 매장의 판매가, 동수면 최근, 단가는 그 판매가의 가장 최근 매장 가격), ARQ cron 이틀마다 00:00 매장 가격 삭제, 재고 품목 단가(공용 단가를 재료 단위로). 상품명 2% 대조·포장 수량 계산 삭제. 재고 응답·발주 상세의 `coupang_product` 필드, 재고 PATCH `pack_quantity` 삭제. `OrderService._unit_prices`.
1. 정리 — `automate/match`·`automate/result`, 행 번호 프롬프트·답 검사, 같은 입력 재사용, `LLMClient`·분류기 호출과 LLM·분류기 설정을 BE에서 뺀다. 발주 상세의 `coupang_search_required`를 뺀다.
2. `POST /api/orders/{id}/automate/start` — 발주 확인, `coupang_run:{order_id}`(로그인 여부·대상별 대화 ID·대화마다 받은 담기 결과·품목 결과) 새로 만들기, 대상 목록.
3. `POST /api/orders/{id}/automate/step` — 대상 확인(400), 새 대화면 첫 지시 만들기(연결 상품 3일·상품 페이지 주소 `?itemId=`·담지 못하면 검색·로켓프레시 비로그인 규칙, 고르는 기준, 장바구니 검수 지시), 에이전트 서버 `/agent/step` 호출(시간 제한 130초) → 오류는 그대로 돌려줌. 200이면 요소 목록에서 상품 고유 ID가 붙은 요소의 아래 깊이 요소로 매장 가격·공용 상품 저장·갱신. 동작 결과에 `cart_added`가 있으면 에이전트 서버를 부르지 않고 그 대화의 담기 결과로 기록, 발주 품목 단가·소계(`price` ÷ 용량을 재료 단위로)와 발주 예상 합계 저장, 그 상품으로 재료 연결(연결 상품 지시 대화에서 연결 상품을 담았으면 연결 시각 유지, 그 밖에는 갱신), 그 품목 대화 끝(`finish_item` 사유 없음). `finish_cart_check`면 품목별 `CHECK_NEEDED` 기록.
4. `POST /api/orders/{id}/automate/finish` — 담기 결과가 없는 품목은 `FAILED`, `orders.status`·`automated_at`·`manual_guide_url`, 품목별 결과, 진행 상태 삭제.
5. 추천발주 예상 단가 — 연결 상품이 있으면 재고 품목 단가. 없으면 공용 상품에서 재료명 포함·공용 단가 있음·재료 단위로 바뀌는 행을 단가 낮은 순 50개, `price_filter:{재료명}:{재료 단위}`(2일)가 없으면 `/agent/filter`로 거른 뒤 보관, 남은 행의 최저 재료 단위 단가. 오류·남은 행 없음은 null. 확정 저장 때 단가·소계는 null, 합계 0.

검증: `automation_test.py`(에이전트 서버는 가짜 — start 뒤가 아닌 step 400, 첫 지시의 연결 상품·검색 분기, 오류 그대로 전달, 200일 때만 카드 갱신, 카드 묶음 읽기(상품명·표시 가격·할인 표시·단위가격·로켓프레시 파일 이름), `cart_added`면 에이전트 미호출·대화 끝·발주 품목 단가·소계·합계 저장(용량 없음·단위 못 바꿈이면 null)·연결·연결 상품 지시 대화의 연결 상품이면 연결 시각 유지·검색으로 같은 상품을 고르면 연결 시각 갱신·담기 결과 없는 품목은 finish에서 FAILED(LLM 답과 무관), 검수 `CHECK_NEEDED`, finish의 AUTOMATED·MANUAL_REQUIRED·미완료 FAILED), `coupang_pricing_test.py`(상품명 나누기·쉼표 없음, 용량 — '900ml, 3개'·'양파 1kg, 1개'·'500g, 4팩'·'1개, 1.8L'·기준 용량 둘 이상·없음, 단가 대조 — 2% 경계·단위 계열 다름·단위가격 표시 없음, 실패 시 그 관측 단가 NULL, 다수결 — 매장 1곳·2:1·동수면 최근·와우 할인 관측 제외·같은 값 재관측 시 받은 시각 갱신·삭제 뒤 공용 값 유지와 첫 관측으로 재결정·매장 가격 없던 옵션 NULL, 계산 못 하면 용량 비움, 재료 단위 환산 — g→kg·ml→L·개, g→개는 미설정), `orders_test.py`(예상 단가 — 연결 상품 단가, 미연결이면 가짜 에이전트가 남긴 행 중 최저·재료 단위 환산, 보관 키가 있으면 에이전트 미호출, 에이전트 오류면 null이고 추천 200, 확정 때 단가·소계 null·합계 0), BE 전체 pytest. 연결 상품 페이지 주소 `/vp/products/{productId}?itemId={itemId}`가 그 옵션으로 열리는지 실제 쿠팡에서 확인.

## 2. 담기 에이전트 서버

저장소 루트 `Agent/`, compose 서비스 `agent`(내부 네트워크만). FastAPI, Redis.

1. 설정 — `LLM_MODEL`·`LLM_API_KEY`·`LLM_BASE_URL`·`LLM_REASONING_EFFORT`, `LLM_GUARD_ENABLED`·`LLM_GUARD_ADAPTER`·`LLM_GUARD_BASE_URL`·`LLM_GUARD_MODEL`(켜졌는데 비면 시작 안 함).
2. `LLMClient` — 메시지 목록 + 도구 목록 → 도구 호출 하나(`openai_compatible`, `tool_choice: required`, 120초). 호출 실패·형식 오류는 같은 요청 3회 재시도, 다 실패하면 503.
3. `GuardClient` — 어댑터 `openai_chat`(생각 모드 끔). 실패는 3회 재시도 후 503.
4. `POST /agent/step` — 대화 기록(`agent:conv:*`, 최근 요소 목록만 남김, 외부 글 구분 태그) → 크기 15만 자 → 호출 횟수(대화 40·매장 하루 300·전체 하루 3,000, 재시도는 세지 않음) → 분류기 → LLM → 도구 인자 검사·길이 자르기 → `action`·`done`.
5. `POST /agent/filter` — 후보 50개 이하, 분류기·호출 횟수(매장·전체 하루)·재시도, `keep_candidates` 도구, 받지 않은 `ref` 버림(`03_be.md` §2.4.6).

검증: pytest(LLM·분류기 가짜 — 크기 초과 400, 41번째 429, 분류기 거부 422와 호출 횟수 증가, LLM 형식 오류 2회 뒤 성공이면 호출 횟수 1, 4회 실패 503, 분류기 꺼짐이면 호출 0회, 이전 요소 목록 생략, `type_text` 50자 자르기, filter — 51개 후보 400, 받지 않은 `ref` 버림, 분류기 거부 422, 매장 하루 횟수에 셈). 실제 게이트웨이로 저장한 쿠팡 요소 목록을 넣어 한 품목 대화를 돌려 보기.

## 3. 확장

저장소 루트 `Extension/`(PWA와 별도 배포 단위). Chrome Manifest V3, TypeScript + Vite 빌드, Vitest.

1. `manifest.json` — `host_permissions`는 `*://*.coupang.com/*`만, `externally_connectable.matches`는 PWA 도메인(dev `http://localhost:5173/*`). 개발용 고정 확장 ID(`key`)와 PWA 환경변수 `VITE_EXTENSION_ID`.
2. 작업 탭 — 담기 시작 때 쿠팡 첫 화면 탭 하나를 열고 그 탭에서만 동작. 로그인 확인(머리글 '로그아웃' 링크, `research/backend/16` §5).
3. 요소 목록 — 화면 전체, 요소마다 번호·종류·글자·깊이, 상품 고유 ID `productId`·`itemId`·`vendorItemId`(검색 결과 화면은 카드 링크 주소에서, 상품 페이지는 페이지 주소와 페이지 데이터의 `landedItemId`·`landedVendorItemId`에서 읽어 상품명 요소에 붙이고 가격 요소를 그 아래에), 글자 없는 그림은 파일 이름, 누를 수 있는 글자 요소 포함. 번호 → 요소 대응표는 그 화면에서만.
4. 개인정보 가리기 — 머리글 이름 표시·'마이쿠팡' 링크 설명 글, 전화번호·이메일·주소 모양을 `---`로.
5. 동작 — 클릭(링크면 `target` 지움), 입력(값 설정 + `input`·`change`), 스크롤. 화면이 바뀌면 다 뜰 때까지 기다리고 `page_changed`. 없는 번호면 '요소 없음'. 상품 페이지에서 클릭 뒤 담기 완료 표시('담기 완료'·'장바구니에 담겼습니다')가 나타나면 `cart_added`에 그 페이지의 상품 고유 ID와 표시 가격(`price`).

검증: Vitest — 저장해 둔 검색·상품·장바구니 화면으로 요소 목록(상품 번호·그림 파일 이름·삭제 글자), 개인정보 가리기, 메시지 형식, 거부 사유가 HTML로 해석되지 않음. 실제 쿠팡에서 개발자 모드로 한 발주 담기.

## 4. FE

1. 발주 확정 이력 — '쿠팡에 담기' 버튼(확장 미설치면 비활성 + 설치 안내). start → 대상마다 step 반복(PWA ↔ 확장 중계) → finish. step 오류면 그 대상 실패로 두고 다음 대상. 422면 확장에 거부 표시와 사유(일반 텍스트). step 요청만 시간 제한 120초.
2. `/orders/{id}/result` — 담기 완료·확인 필요·실패 품목, 수동 처리 안내(`manual_guide_url`), 비로그인 로켓프레시 알림.
3. 재고 펼침 '쿠팡 상품 줄' — 연결 상품명·옵션 이름·판매가·단가, 단가 미설정이면 '단가 미설정'.
4. `openapi.json`·`types.gen.ts` 재생성.

검증: Vitest(확장 없음 비활성, 반복 중 오류 시 다음 대상으로, 결과 화면 세 상태, 쿠팡 상품 줄의 단가 미설정 표시), typecheck. 실서버 + 에이전트 서버 + 확장으로 확정 → 담기 → 결과 화면 → 재고의 연결 상품·단가 확인.

## 5. 마무리

- 정상 담기 실측으로 오남용 방지 상한 조정, 걸음마다 분류기 소요 시간 측정, 다른 분류기 모델(Meta Prompt Guard 2 86M 등)과 비교. 결과는 research에 먼저 기록한다.
- 목업 `11_orders.html`에 담기 버튼·결과 화면, `10_inventory.html`에 쿠팡 상품 줄.
- spec을 구현에 맞춘다.
