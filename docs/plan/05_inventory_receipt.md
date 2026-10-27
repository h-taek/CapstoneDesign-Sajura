# 05 재고·입고·메뉴 재설계

> 범위 결정은 spec에 있다 — 단가 출처 `01_basic_design.md` §3.3.1, 입고 예정량 §3.7.2, 확정 단가 §3.7.4, 입고 처리 §3.7.5, API·DDL `02_implementation_design.md` §3.5·§3.7·§4.3.20. 화면은 목업 `mockup/10_inventory.html`·`11_orders.html`·`12_menus.html`을 따른다.
> 브랜치 `fix/order-duplicate-approve`에서 이어 한다(같은 추천안 재확정 409·AI `incoming_quantity`가 이미 들어 있다).

## 1. BE

진행 순서.

1. 마이그레이션 `0012` 다시 쓰기 — 미커밋 `0012_orders_rec_unique`를 dev DB에서 되돌리고 `0012_order_receipt`로 바꾼다.
   - `orders.recommendation_id` 유니크(중복 검사 분기는 뺀다 — 운영 데이터 없음)
   - `order_items`: `unit_price` DECIMAL(12,3) NULL, `subtotal` NULL 허용, `receipt_status`·`lot_id`·`processed_at`, 인덱스 `(item_id, receipt_status)`, `lot_id` 외래 키
2. 모델·스키마 — `OrderItem`에 새 칸, `ReceiptStatus` enum. 확정 요청에서 `unit_price` 제거, 추천 응답·발주 상세에 `unit_price`(null)·`order_item_id`·`receipt_status`.
3. 단가 — 단가 출처(공용 쿠팡 상품 테이블)는 쿠팡 자동 담기 때 만든다. 이번에는 추천 응답과 확정 저장의 `unit_price`가 항상 null이다. 상수로 박지 않고 '단가 조회' 한 곳(`OrderService`)에서 null을 돌려주게 해 둔다.
4. 입고 예정량 — `ForecastService._incoming_quantities`를 `receipt_status = PENDING` 합계로 바꾼다(리드타임 추정 제거).
5. 입고 처리 — `POST /api/orders/items/{id}/receive`(로트 생성은 `InventoryService.add_lot` 재사용, 같은 트랜잭션에서 `RECEIVED`·`lot_id`·`processed_at`), `POST /api/orders/items/{id}/skip`. PENDING 아니면 409 `STATE_CONFLICT`.
6. 로트 조회 응답에 `pending_orders`.

검증: `orders_test.py`·`inventory_test.py` — 확정 시 PENDING·단가 null·소계 null·합계 0, 입고 처리 → 로트 생성·RECEIVED·재처리 409, 입고 안 함 → SKIPPED·로트 없음, 다른 매장 품목 404, `pending_orders` 정렬, 입고 예정량 = PENDING 합계. `0012` upgrade·downgrade 왕복. BE 전체 pytest.

## 2. FE

진행 순서.

1. 재고 `routes/inventory.tsx` — 상태 배지·상태 열 제거. 소비기한 D-3 이내(지난 것 포함)면 기한 글씨, 재고 없음·기준 이하·확인 필요면 수량 글씨를 `text-danger`로. 패널 맨 위에 입고 대기 카드(입고 처리·입고 안 함).
2. 발주 `routes/orders.tsx` — 품목별 '단가 ○원/단위 · 예상 ○원', null이면 '단가 미설정'. 확정 줄에 예상 합계. 확정 이력 상세에 품목별 금액·입고 상태. 확정 409 응답 처리.
3. 메뉴 관리 — `routes/recipes.tsx` → `routes/menus.tsx`, 경로 `/recipes` → `/menus`, 내비·더보기 이름 '메뉴 관리'. 메뉴명·판매가·카테고리·재고 차감·레시피를 한 화면에서 저장, 메뉴 추가·삭제(기존 메뉴 API).
4. 단가 관리 삭제 — `routes/settings/pricing.tsx`, 라우트, 설정 항목.
5. `openapi.json`·`types.gen.ts` 재생성.

검증: Vitest(재고 경고 판정, 입고 카드 기본값, 발주 단가 미설정 표시, 메뉴 저장 호출), typecheck. 실서버로 확정 → 재고 펼침 → 입고 처리 → 로트·입고 예정량 확인.

## 3. 마무리

- `04_fe.md` §4.4~§4.6·§4.10을 구현에 맞춘다(재고 경고 표시, 메뉴 관리, 단가 관리 삭제).
- `00_wireflow.html`의 레시피 관리·단가 관리 항목은 HANDOFF FE 일괄의 흐름도 다시 그리기에서 정리한다.
