# 08 쿠팡 자동 담기

> 범위 결정은 spec에 있다 — 단가·공용 쿠팡 상품·가격 검증 `01_basic_design.md` §3.3.1, 담기 규칙 §3.8.1, API `02_implementation_design.md` §3.5·§3.7, DDL §4.3.8·§4.3.12·§4.3.24, LLM 클라이언트·입력과 답 검사·호출 제한·보안 분류기 `03_be.md` §2.4, 확장 `04_fe.md` §12. 쿠팡 페이지 구조는 `research/backend/16_coupang_page_probe.md`.

## 1. BE

진행 순서.

1. 마이그레이션 `0016` — `coupang_products`·`coupang_price_candidates` 생성, `inventory_items`에 `coupang_product_id`·`coupang_linked_at`·`pack_quantity`, `sites`·`inventory_item_sites`·`order_recommendation_items.last_price` 삭제. `AccountPurgeService`의 `item_sites` 주석 정리.
2. 모델·스키마 — `CoupangProduct`·`CoupangPriceCandidate`, `InventoryItem` 연결 칸. 재고 응답의 `coupang_url`·`last_price`를 `coupang_product`·`pack_quantity`·`unit_price`로, PATCH에 `pack_quantity`.
3. 단가 계산 — `coupang_pricing.py` 순수 함수 한 곳: 단위가격 표시 파싱, 용량 계산(`표시 가격 ÷ 단위가격 × 기준 수량`), 상품명 용량 파싱과 2% 대조, 재료 단위 환산, 단가(판매가 ÷ 용량 → 판매가 ÷ 포장 수량). `OrderService._unit_prices`가 이것을 쓴다.
4. `LLMClient` — 인터페이스와 어댑터 `anthropic`·`openai_compatible`, 설정 `LLM_PROVIDER`·`LLM_MODEL`·`LLM_API_KEY`·`LLM_BASE_URL`·`LLM_REASONING_EFFORT`와 보안 분류기 `LLM_GUARD_ENABLED`·`LLM_GUARD_BASE_URL`·`LLM_GUARD_MODEL`(`config.py`·`.env.example`). 응답은 Pydantic 스키마로 검증한다. 분류기는 생각 모드를 끄고 부른다.
5. 발주 상세 — 품목별 `coupang_search_required`·`coupang_product`(연결 없음·3일 경과·포장 수량 미상·로켓프레시는 비로그인 시 확장이 판단).
6. `POST /api/orders/{id}/automate/match` — 요청 스키마에 `rating`·`review_count`. 연결 상품 품목은 담을 개수만 계산, 검색 품목이 있으면 요청 검사(검색 필요 품목·중복·결과 60개) → Redis 같은 입력 재사용 → 호출 횟수(발주 3·매장 하루 20·전체 하루 500, 초과 429 `ORDER_LLM_QUOTA_EXCEEDED`) → 보안 분류기(켜졌을 때 요청 승인·거부, 거부면 422 `ORDER_LLM_GUARD_REJECTED` + 사유) → LLM 1회(서버 재료명, 상품 선택 규칙 `01_basic_design.md` §3.8.1 그대로, 외부 글 구분 태그, 상품명 200자, 별점·리뷰 수 포함, 비로그인이면 로켓프레시 제외) → 답 검사(후보 밖·로켓프레시·포장 수량, 단위가격 계산 용량과 2% 대조) → `vendor_item_id`로 `product_id` 채움 → 담을 개수 서버 계산. 호출 실패·검증 실패는 그 품목들을 `selected: null`.
7. `POST /api/orders/{id}/automate/result` — 성공 품목마다 공용 상품 저장·갱신(와우 할인 표시면 판매가 갱신 안 함, 용량 대조 실패면 공용 값 갱신 안 함, 20% 초과면 가격 후보, 다른 매장 확인 시 반영·후보 삭제, 14일 지난 후보 무시), 재고 품목 연결 덮어쓰기·연결 시각·포장 수량 규칙. `orders.status`·`automated_at`·`manual_guide_url`.

검증: `coupang_pricing_test.py`(단위 기준 100g·10g·1구·100ml·1세트·표시 없음, 상품명 용량 '500g, 4개'·'30구, 1개'·'1박스, 1kg'·'30개, 10ml', 2% 대조, 환산 불가), `automation_test.py`(LLM·분류기는 가짜 어댑터 — 검색 품목 없으면 호출 0회, 비로그인 로켓프레시 제외, 실패 시 null, 검색 불필요 품목·중복·결과 61개 400, 같은 입력 재사용 시 호출 0회, 발주 4번째·매장 21번째·전체 501번째 호출 429, 답의 후보 밖 상품·포장 수량 0·포장 수량 미상·단위가격 계산 용량과 2% 초과 차이 null, `product_id`는 검색 결과 행 값, LLM이 준 개수 무시하고 서버 계산, 분류기 꺼짐이면 분류기 호출 0회·분류기 주소가 죽어 있어도 정상 선택, 켜짐인데 주소·모델 빈 값이면 설정 로드 오류, 켜짐이면 거부 시 422와 사유·선택 LLM 호출 0회·호출 횟수 증가·재사용 저장 안 함, 분류기 실패는 고정 사유로 거부; result의 와우 표시·용량 불일치·20% 경계·후보 덮어쓰기·다른 매장 확인·14일 만료·같은 매장 반복, 연결 덮어쓰기와 연결 시각, 전체 성공 AUTOMATED·일부 실패 MANUAL_REQUIRED, 다른 매장 발주 404), 재고 PATCH `pack_quantity`(연결 없으면 400). `0016` upgrade·downgrade 왕복. BE 전체 pytest. 선택 정확도는 실제 게이트웨이로 `scripts/llm_eval` 네 세트(비로그인·로그인·각 지시문)를 서버 프롬프트로 1회씩 돌려 `check_rule.py`로 확인. 분류기는 노트북에서 `scripts/guard-up.sh`로 켜고 BE 컨테이너가 `host.docker.internal:11434`로 닿는지, 지시문 세트에서 거부·사유가 나오는지 확인.

## 2. 확장

저장소 루트 `Extension/`(PWA와 별도 배포 단위). Chrome Manifest V3, TypeScript + Vite 빌드, Vitest.

1. `manifest.json` — `host_permissions`는 `*://*.coupang.com/*`만, `externally_connectable.matches`는 PWA 도메인(dev `http://localhost:5173/*`). 개발용 고정 확장 ID(`key`)와 PWA 환경변수 `VITE_EXTENSION_ID`.
2. 로그인 확인 — 머리글에 '로그아웃' 링크(`login.coupang.com/login/logout.pang`)가 있으면 로그인, '로그인' 링크(`login.pang`)면 비로그인(`research/backend/16` §5).
3. 검색 — 쿠팡 검색창에 재료명 입력. 결과 페이지 주소를 직접 열거나 요청하지 않는다. 카드(`li.ProductUnit_productUnit__…`)에서 `productId`·`vendorItemId`·상품명(`[class*="ProductUnit_productName"]` 요소 — 카드 글자 첫 줄은 배지일 수 있다, `research/backend/17` §3.3)·표시 가격·할인 표시 글자·단위가격 표시·로켓프레시(`logo_fresh` 이미지)·별점(`ProductRating_fullRating` 1점·`ProductRating_halfRating` 0.5점 요소 수)·리뷰 수('(3,991)' 글자)만 읽고, 광고 카드와 같은 `vendorItemId` 중복은 뺀다.
4. 담기 — 상품 페이지 열기, 수량 입력칸에 담을 개수, `button.prod-cart-btn` 클릭, '담겼습니다' 표시로 성공 판정. 품목당 10초·전체 30초. 담을 때 상품 페이지의 표시 가격·할인 표시·단위가격을 다시 읽어 결과에 싣는다.
5. 실패 사유 — `NO_RESULT`·`SELECTOR_MISMATCH`·`TIMEOUT`, 재시도 없음.
6. 알림 — 비로그인이면 '로그인하지 않으면 로켓프레시 상품은 담을 수 없습니다'(`04_fe.md` §12.6), `match` 거부면 '요청이 거부되었습니다'와 사유를 일반 텍스트로(§12.7).

검증: Vitest — 저장해 둔 검색·상품 페이지 HTML로 파싱(광고·중복 제외, 와우 표시, 단위가격 없음, 별점·리뷰 수), 메시지 형식, 거부 사유가 HTML로 해석되지 않음. 실제 쿠팡에서 개발자 모드로 담기 1회(판매자 상품·로켓프레시 비로그인 알림).

## 3. FE

1. 발주 확정 이력 — '쿠팡에 담기' 버튼(확장 미설치면 비활성 + 설치 안내), 확장 호출 → `automate/match` → 확장 담기 → `automate/result`. `match`가 429 `ORDER_LLM_QUOTA_EXCEEDED`나 422 `ORDER_LLM_GUARD_REJECTED`면 검색 품목은 실패로 두고 연결 상품 품목만 담는다. 거부면 확장에 거부 표시와 사유(일반 텍스트).
2. `/orders/{id}/result` — 성공 품목·실패 품목과 수동 처리 안내(`manual_guide_url`), 비로그인 로켓프레시 알림.
3. 재고 펼침 '쿠팡 상품 줄' — 연결 상품명·판매가·단가, 단가 미설정이면 포장 수량 입력.
4. `openapi.json`·`types.gen.ts` 재생성.

검증: Vitest(확장 없음 비활성, 결과 화면 세 분기, `match` 429·422 시 연결 상품만 담기, 거부 사유 표시, 포장 수량 저장), typecheck. 실서버 + 확장으로 확정 → 담기 → 결과 화면 → 재고의 연결 상품·단가 확인.

## 4. 마무리

- 목업 `11_orders.html`에 담기 버튼·결과 화면, `10_inventory.html`에 쿠팡 상품 줄.
- spec을 구현에 맞춘다.
