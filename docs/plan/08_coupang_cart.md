# 08 쿠팡 자동 담기

> 범위 결정은 spec에 있다 — 단가·공용 쿠팡 상품·가격 검증 `01_basic_design.md` §3.3.1, 담기 규칙 §3.8.1, API `02_implementation_design.md` §3.5·§3.7, DDL §4.3.8·§4.3.12·§4.3.24, LLM 클라이언트 `03_be.md` §2.4, 확장 `04_fe.md` §12. 쿠팡 페이지 구조는 `research/backend/16_coupang_page_probe.md`.

## 1. BE

진행 순서.

1. 마이그레이션 `0015` — `coupang_products`·`coupang_price_candidates` 생성, `inventory_items`에 `coupang_product_id`·`coupang_linked_at`·`pack_quantity`, `sites`·`inventory_item_sites`·`order_recommendation_items.last_price` 삭제. `AccountPurgeService`의 `item_sites` 주석 정리.
2. 모델·스키마 — `CoupangProduct`·`CoupangPriceCandidate`, `InventoryItem` 연결 칸. 재고 응답의 `coupang_url`·`last_price`를 `coupang_product`·`pack_quantity`·`unit_price`로, PATCH에 `pack_quantity`.
3. 단가 계산 — `coupang_pricing.py` 순수 함수 한 곳: 단위가격 표시 파싱, 용량 계산(`표시 가격 ÷ 단위가격 × 기준 수량`), 상품명 용량 파싱과 2% 대조, 재료 단위 환산, 단가(판매가 ÷ 용량 → 판매가 ÷ 포장 수량). `OrderService._unit_prices`가 이것을 쓴다.
4. `LLMClient` — 인터페이스와 어댑터 `anthropic`·`openai_compatible`, 설정 `LLM_PROVIDER`·`LLM_MODEL`·`LLM_API_KEY`·`LLM_BASE_URL`(`config.py`·`.env.example`). 응답은 Pydantic 스키마로 검증한다.
5. 발주 상세 — 품목별 `coupang_search_required`·`coupang_product`(연결 없음·3일 경과·포장 수량 미상·로켓프레시는 비로그인 시 확장이 판단).
6. `POST /api/orders/{id}/automate/match` — 연결 상품 품목은 담을 개수만 계산, 검색 품목이 있으면 LLM 1회(비로그인이면 로켓프레시 제외). 호출 실패·검증 실패는 그 품목들을 `selected: null`.
7. `POST /api/orders/{id}/automate/result` — 성공 품목마다 공용 상품 저장·갱신(와우 할인 표시면 판매가 갱신 안 함, 용량 대조 실패면 공용 값 갱신 안 함, 20% 초과면 가격 후보, 다른 매장 확인 시 반영·후보 삭제, 14일 지난 후보 무시), 재고 품목 연결 덮어쓰기·연결 시각·포장 수량 규칙. `orders.status`·`automated_at`·`manual_guide_url`.

검증: `coupang_pricing_test.py`(단위 기준 100g·10g·1구·100ml·1세트·표시 없음, 상품명 용량 '500g, 4개'·'30구, 1개'·'1박스, 1kg'·'30개, 10ml', 2% 대조, 환산 불가), `automation_test.py`(LLM은 가짜 어댑터 — 검색 품목 없으면 호출 0회, 비로그인 로켓프레시 제외, 실패 시 null; result의 와우 표시·용량 불일치·20% 경계·후보 덮어쓰기·다른 매장 확인·14일 만료·같은 매장 반복, 연결 덮어쓰기와 연결 시각, 전체 성공 AUTOMATED·일부 실패 MANUAL_REQUIRED, 다른 매장 발주 404), 재고 PATCH `pack_quantity`(연결 없으면 400). `0015` upgrade·downgrade 왕복. BE 전체 pytest.

## 2. 확장

저장소 루트 `Extension/`(PWA와 별도 배포 단위). Chrome Manifest V3, TypeScript + Vite 빌드, Vitest.

1. `manifest.json` — `host_permissions`는 `*://*.coupang.com/*`만, `externally_connectable.matches`는 PWA 도메인(dev `http://localhost:5173/*`). 개발용 고정 확장 ID(`key`)와 PWA 환경변수 `VITE_EXTENSION_ID`.
2. 로그인 확인 — 머리글 '로그인' 링크 유무. 로그인 상태 표시는 실제 로그인 화면에서 확인해 `research/backend/16`에 남기고 판별을 확정한다.
3. 검색 — 쿠팡 검색창에 재료명 입력. 결과 페이지 주소를 직접 열거나 요청하지 않는다. 카드(`li.ProductUnit_productUnit__…`)에서 `productId`·`vendorItemId`·상품명·표시 가격·할인 표시 글자·단위가격 표시·로켓프레시(`logo_fresh` 이미지)만 읽고, 광고 카드와 같은 `vendorItemId` 중복은 뺀다.
4. 담기 — 상품 페이지 열기, 수량 입력칸에 담을 개수, `button.prod-cart-btn` 클릭, '담겼습니다' 표시로 성공 판정. 품목당 10초·전체 30초. 담을 때 상품 페이지의 표시 가격·할인 표시·단위가격을 다시 읽어 결과에 싣는다.
5. 실패 사유 — `NO_RESULT`·`SELECTOR_MISMATCH`·`TIMEOUT`, 재시도 없음.

검증: Vitest — 저장해 둔 검색·상품 페이지 HTML로 파싱(광고·중복 제외, 와우 표시, 단위가격 없음), 메시지 형식. 실제 쿠팡에서 개발자 모드로 담기 1회(판매자 상품·로켓프레시 비로그인 알림).

## 3. FE

1. 발주 확정 이력 — '쿠팡에 담기' 버튼(확장 미설치면 비활성 + 설치 안내), 확장 호출 → `automate/match` → 확장 담기 → `automate/result`.
2. `/orders/{id}/result` — 성공 품목·실패 품목과 수동 처리 안내(`manual_guide_url`), 비로그인 로켓프레시 알림.
3. 재고 펼침 '쿠팡 상품 줄' — 연결 상품명·판매가·단가, 단가 미설정이면 포장 수량 입력.
4. `openapi.json`·`types.gen.ts` 재생성.

검증: Vitest(확장 없음 비활성, 결과 화면 세 분기, 포장 수량 저장), typecheck. 실서버 + 확장으로 확정 → 담기 → 결과 화면 → 재고의 연결 상품·단가 확인.

## 4. 마무리

- 목업 `11_orders.html`에 담기 버튼·결과 화면, `10_inventory.html`에 쿠팡 상품 줄.
- spec을 구현에 맞춘다.
