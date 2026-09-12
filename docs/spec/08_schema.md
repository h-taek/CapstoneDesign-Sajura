# DB 스키마 설계서

## 1. DBMS

- **MySQL**
- Docker 기반 배포 용이, 복잡한 쿼리 및 JSON 필드 지원, 인덱싱/파티셔닝/슬레이브 복제 가능

---

## 2. 공통 규칙

- PK: `CHAR(36)` UUID 방식
- 테이블명/컬럼명: snake_case 영문
- 날짜/시간: `DATETIME` (UTC 저장)
- 금액: `INT` (원 단위, 소수점 없음)
- 수량: `DECIMAL(10,3)` (g, ml 등 소수점 단위 허용)
- 마이그레이션 도구: Alembic (FastAPI/SQLAlchemy 표준)

---

## 3. 테이블 스키마

### 3.1 users

```sql
CREATE TABLE users (
    user_id       CHAR(36)                            NOT NULL,
    email         VARCHAR(255)                        NOT NULL,
    password_hash VARCHAR(255)                        NULL COMMENT '소셜 로그인 계정은 NULL',
    name          VARCHAR(50)                         NOT NULL,
    role          ENUM('OWNER','ADMIN')               NOT NULL DEFAULT 'OWNER' COMMENT '점주/관리자 — 관리자는 운영자 계정만 수동 지정 (security.md §5.1)',
    auth_provider ENUM('LOCAL','KAKAO','GOOGLE')      NOT NULL DEFAULT 'LOCAL',
    social_id     VARCHAR(100)                        NULL COMMENT '소셜 서비스의 사용자 고유 ID',
    created_at    DATETIME                            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME                            NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    UNIQUE KEY uq_users_email (email),
    UNIQUE KEY uq_users_social (auth_provider, social_id)
);
```

### 3.2 refresh_tokens

```sql
CREATE TABLE refresh_tokens (
    token_id    CHAR(36)        NOT NULL,
    user_id     CHAR(36)        NOT NULL,
    token_hash  VARCHAR(255)    NOT NULL,
    expires_at  DATETIME        NOT NULL,
    is_revoked  TINYINT(1)      NOT NULL DEFAULT 0,
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (token_id),
    UNIQUE KEY uq_refresh_tokens_hash (token_hash),
    KEY idx_refresh_tokens_user_id (user_id),
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);
```

> `token_hash`: 원문 토큰 대신 해시값 저장. DB 침해 시 토큰 원문 복구 불가.

### 3.3 stores

```sql
CREATE TABLE stores (
    store_id              CHAR(36)                                    NOT NULL,
    user_id               CHAR(36)                                    NOT NULL,
    store_name            VARCHAR(100)                                NULL COMMENT '온보딩 전 NULL',
    business_no           VARCHAR(20)                                 NULL COMMENT '사업자 검증 전 NULL',
    business_status       ENUM('UNVERIFIED','PENDING','VERIFIED','REJECTED') NOT NULL DEFAULT 'UNVERIFIED'
                          COMMENT 'NTS통과+등록증업로드→PENDING, 관리자 승인→VERIFIED, 반려→REJECTED — 온보딩 진입 게이트',
    business_cert_path    VARCHAR(255)                                NULL COMMENT '업로드한 사업자등록증 파일 경로(서버 볼륨). 원본은 DB 미저장',
    business_reject_reason VARCHAR(255)                               NULL COMMENT '관리자 반려 사유 (REJECTED 시)',
    business_reviewed_by  CHAR(36)                                    NULL COMMENT '승인/반려한 관리자 user_id (감사)',
    business_type         VARCHAR(50)                                 NULL COMMENT '업종 (AI 예측 지역 변수), 온보딩 전 NULL',
    store_size            ENUM('SMALL','MEDIUM','LARGE')              NULL COMMENT '소형~10석 / 중형11~30석 / 대형31석~',
    operation_type        ENUM('HALL','DELIVERY','BOTH')              NULL COMMENT '홀 운영 / 배달 전용 / 홀+배달',
    address               VARCHAR(255)                                NULL,
    phone                 VARCHAR(20)                                 NULL COMMENT 'NATIONAL 형식 010-1234-5678 — BE가 phonenumbers로 정규화 후 저장',
    onboarding_completed  TINYINT(1)                                  NOT NULL DEFAULT 0,
    created_at            DATETIME                                    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            DATETIME                                    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (store_id),
    UNIQUE KEY uq_stores_user_id (user_id),
    UNIQUE KEY uq_stores_business_no (business_no),
    CONSTRAINT fk_stores_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);
```

> 매장 행은 계정 생성(소셜/이메일) 시 1:1로 함께 생성되며, `store_name`·`business_no`·`business_type` 등은 NULL로 시작해 사업자 검증·온보딩에서 채운다.
>
> **사업자 검증 상태(`business_status`) 흐름**: `UNVERIFIED`(초기) → NTS 즉시검증 통과 + 사업자등록증 업로드 → `PENDING`(관리자 심사 대기) → 관리자 승인 → `VERIFIED` / 반려 → `REJECTED`(재시도 가능). **온보딩 진입은 `PENDING` 또는 `VERIFIED`에서 허용**(`UNVERIFIED`·`REJECTED`는 차단). 마스터 코드(`NTS_MASTER_BYPASS_CODE`)는 곧바로 `VERIFIED`. 등록증 원본 파일은 서버 볼륨에 저장하고 DB엔 경로만 둔다(민감정보, `security.md` §4.1). `uq_stores_business_no`는 NULL 다중 허용(MySQL)이라 미검증 매장 공존 가능.

### 3.4 pos_connections

```sql
CREATE TABLE pos_connections (
    pos_id          CHAR(36)        NOT NULL,
    store_id        CHAR(36)        NOT NULL,
    pos_type        VARCHAR(50)     NOT NULL,
    api_key         VARCHAR(255)    NOT NULL COMMENT '암호화 저장',
    store_code      VARCHAR(50)     NOT NULL,
    status          ENUM('CONNECTED','ERROR','CSV_MODE','DISCONNECTED') NOT NULL DEFAULT 'DISCONNECTED',
    last_synced_at  DATETIME        NULL,
    error_message   VARCHAR(500)    NULL,
    connected_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (pos_id),
    UNIQUE KEY uq_pos_connections_store_id (store_id),
    CONSTRAINT fk_pos_connections_store FOREIGN KEY (store_id) REFERENCES stores (store_id) ON DELETE CASCADE
);
```

### 3.5 menus

```sql
CREATE TABLE menus (
    menu_id                  CHAR(36)      NOT NULL,
    store_id                 CHAR(36)      NOT NULL,
    name                     VARCHAR(100)  NOT NULL,
    category                 VARCHAR(50)   NULL,
    price                    INT           NOT NULL,
    is_active                TINYINT(1)    NOT NULL DEFAULT 1,
    use_inventory_deduction  TINYINT(1)    NOT NULL DEFAULT 1 COMMENT '재고 차감 사용 여부',
    is_deleted               TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '점주 삭제 표시 여부',
    deleted_at               DATETIME      NULL COMMENT '소프트 삭제 시각',
    created_at               DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (menu_id),
    KEY idx_menus_store_id (store_id),
    KEY idx_menus_store_deleted (store_id, is_deleted),
    CONSTRAINT fk_menus_store FOREIGN KEY (store_id) REFERENCES stores (store_id) ON DELETE CASCADE
);
```

### 3.6 recipes

```sql
CREATE TABLE recipes (
    recipe_id   CHAR(36)        NOT NULL,
    menu_id     CHAR(36)        NOT NULL,
    updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (recipe_id),
    UNIQUE KEY uq_recipes_menu_id (menu_id),
    CONSTRAINT fk_recipes_menu FOREIGN KEY (menu_id) REFERENCES menus (menu_id) ON DELETE CASCADE
);
```

### 3.7 recipe_ingredients

```sql
CREATE TABLE recipe_ingredients (
    id          CHAR(36)        NOT NULL,
    recipe_id   CHAR(36)        NOT NULL,
    item_id     CHAR(36)        NOT NULL,
    quantity    DECIMAL(10,3)   NOT NULL,
    unit        VARCHAR(20)     NOT NULL,
    PRIMARY KEY (id),
    KEY idx_recipe_ingredients_recipe_id (recipe_id),
    KEY idx_recipe_ingredients_item_id (item_id),
    CONSTRAINT fk_recipe_ingredients_recipe FOREIGN KEY (recipe_id) REFERENCES recipes (recipe_id) ON DELETE CASCADE,
    CONSTRAINT fk_recipe_ingredients_item FOREIGN KEY (item_id) REFERENCES inventory_items (item_id)
);
```

### 3.8 inventory_items

```sql
CREATE TABLE inventory_items (
    item_id             CHAR(36)        NOT NULL,
    store_id            CHAR(36)        NOT NULL,
    name                VARCHAR(100)    NOT NULL,
    unit                VARCHAR(20)     NOT NULL,
    low_stock_threshold DECIMAL(10,3)   NOT NULL DEFAULT 0,
    lead_time_days      INT             NULL COMMENT '추천발주 리드타임(일). NULL이면 기본값 1일 사용',
    safety_stock        DECIMAL(10,3)   NULL COMMENT '추천발주 안전재고 수량. NULL이면 기본값 0 사용',
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (item_id),
    KEY idx_inventory_items_store_id (store_id),
    CONSTRAINT fk_inventory_items_store FOREIGN KEY (store_id) REFERENCES stores (store_id) ON DELETE CASCADE
);
```

### 3.9 inventory_lots

```sql
CREATE TABLE inventory_lots (
    lot_id              CHAR(36)        NOT NULL,
    item_id             CHAR(36)        NOT NULL,
    quantity            DECIMAL(10,3)   NOT NULL,
    remaining_quantity  DECIMAL(10,3)   NOT NULL,
    unit_price          INT             NOT NULL,
    received_at         DATE            NOT NULL,
    expiry_date         DATE            NULL,
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (lot_id),
    KEY idx_inventory_lots_item_id (item_id),
    KEY idx_inventory_lots_expiry_date (expiry_date),
    CONSTRAINT fk_inventory_lots_item FOREIGN KEY (item_id) REFERENCES inventory_items (item_id) ON DELETE CASCADE
);
```

### 3.10 inventory_adjustment_logs

```sql
CREATE TABLE inventory_adjustment_logs (
    adjustment_id       CHAR(36)        NOT NULL,
    lot_id              CHAR(36)        NOT NULL,
    item_id             CHAR(36)        NOT NULL COMMENT '조회 편의용 비정규화',
    store_id            CHAR(36)        NOT NULL COMMENT '조회 편의용 비정규화',
    user_id             CHAR(36)        NOT NULL,
    before_quantity     DECIMAL(10,3)   NOT NULL,
    after_quantity      DECIMAL(10,3)   NOT NULL,
    delta_quantity      DECIMAL(10,3)   NOT NULL,
    before_expiry_date  DATE            NULL,
    after_expiry_date   DATE            NULL,
    reason              ENUM('STOCKTAKE','EXPIRY_CORRECTION','OTHER') NOT NULL,
    memo                VARCHAR(255)    NULL,
    adjusted_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (adjustment_id),
    KEY idx_inventory_adjustment_logs_store_id (store_id),
    KEY idx_inventory_adjustment_logs_item_id (item_id),
    KEY idx_inventory_adjustment_logs_lot_id (lot_id),
    CONSTRAINT fk_inventory_adjustment_logs_lot FOREIGN KEY (lot_id) REFERENCES inventory_lots (lot_id),
    CONSTRAINT fk_inventory_adjustment_logs_item FOREIGN KEY (item_id) REFERENCES inventory_items (item_id),
    CONSTRAINT fk_inventory_adjustment_logs_store FOREIGN KEY (store_id) REFERENCES stores (store_id),
    CONSTRAINT fk_inventory_adjustment_logs_user FOREIGN KEY (user_id) REFERENCES users (user_id)
);
```

### 3.11 disposal_logs

```sql
CREATE TABLE disposal_logs (
    disposal_id CHAR(36)        NOT NULL,
    lot_id      CHAR(36)        NOT NULL,
    item_id     CHAR(36)        NOT NULL COMMENT '조회 편의용 비정규화',
    store_id    CHAR(36)        NOT NULL COMMENT '조회 편의용 비정규화',
    user_id     CHAR(36)        NOT NULL COMMENT '폐기 처리 사용자 (감사 로그용)',
    quantity    DECIMAL(10,3)   NOT NULL,
    reason      VARCHAR(255)    NULL,
    disposed_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (disposal_id),
    KEY idx_disposal_logs_store_id (store_id),
    KEY idx_disposal_logs_item_id (item_id),
    CONSTRAINT fk_disposal_logs_lot FOREIGN KEY (lot_id) REFERENCES inventory_lots (lot_id),
    CONSTRAINT fk_disposal_logs_item FOREIGN KEY (item_id) REFERENCES inventory_items (item_id),
    CONSTRAINT fk_disposal_logs_store FOREIGN KEY (store_id) REFERENCES stores (store_id),
    CONSTRAINT fk_disposal_logs_user FOREIGN KEY (user_id) REFERENCES users (user_id)
);
```

### 3.12 sites

```sql
CREATE TABLE sites (
    site_id     CHAR(36)        NOT NULL,
    name        VARCHAR(50)     NOT NULL,
    base_url    VARCHAR(255)    NOT NULL,
    is_active   TINYINT(1)      NOT NULL DEFAULT 1,
    PRIMARY KEY (site_id),
    UNIQUE KEY uq_sites_name (name)
);
```

### 3.13 inventory_item_sites

```sql
CREATE TABLE inventory_item_sites (
    id              CHAR(36)        NOT NULL,
    item_id         CHAR(36)        NOT NULL,
    site_id         CHAR(36)        NOT NULL,
    product_url     VARCHAR(500)    NOT NULL,
    last_price      INT             NULL,
    last_scraped_at DATETIME        NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_item_site (item_id, site_id),
    CONSTRAINT fk_item_sites_item FOREIGN KEY (item_id) REFERENCES inventory_items (item_id) ON DELETE CASCADE,
    CONSTRAINT fk_item_sites_site FOREIGN KEY (site_id) REFERENCES sites (site_id)
);
```

> API 응답의 `coupang_url`(= `product_url`)과 `last_price`는 이 테이블에서 쿠팡 사이트(`sites.name = '쿠팡'`) 기준으로 JOIN하여 제공한다. `inventory_items`에 직접 컬럼이 없으므로 서비스 레이어에서 JOIN 처리가 필요하다. MVP에서는 쿠팡 단일 사이트만 지원한다.

### 3.14 sale_records

```sql
CREATE TABLE sale_records (
    sale_id          CHAR(36)        NOT NULL,
    store_id         CHAR(36)        NOT NULL,
    menu_id          CHAR(36)        NOT NULL,
    external_sale_id VARCHAR(100)    NULL COMMENT 'POS/CSV 원본 판매 식별자',
    quantity         INT             NOT NULL,
    unit_price       INT             NOT NULL,
    total_price      INT             NOT NULL,
    sold_at          DATETIME        NOT NULL,
    source           ENUM('POS','CSV') NOT NULL DEFAULT 'POS',
    created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (sale_id),
    UNIQUE KEY uq_sale_records_source_external (store_id, source, external_sale_id),
    KEY idx_sale_records_store_sold_at (store_id, sold_at),
    KEY idx_sale_records_menu_id (menu_id),
    CONSTRAINT fk_sale_records_store FOREIGN KEY (store_id) REFERENCES stores (store_id),
    CONSTRAINT fk_sale_records_menu FOREIGN KEY (menu_id) REFERENCES menus (menu_id)
);
```

### 3.15 forecast_results

```sql
CREATE TABLE forecast_results (
    forecast_id             CHAR(36)        NOT NULL,
    store_id                CHAR(36)        NOT NULL,
    menu_id                 CHAR(36)        NOT NULL,
    target_date             DATE            NOT NULL,
    predicted_quantity      INT             NOT NULL,
    confidence_score        DECIMAL(4,3)    NOT NULL,
    is_low_confidence       TINYINT(1)      NOT NULL DEFAULT 0,
    low_confidence_reason   VARCHAR(255)    NULL,
    generated_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- 예측 근거 저장 컬럼은 산출 방법·출력 형태 확정 후 추가
    PRIMARY KEY (forecast_id),
    UNIQUE KEY uq_forecast_store_menu_date (store_id, menu_id, target_date),
    CONSTRAINT fk_forecast_results_store FOREIGN KEY (store_id) REFERENCES stores (store_id),
    CONSTRAINT fk_forecast_results_menu FOREIGN KEY (menu_id) REFERENCES menus (menu_id)
);
```

### 3.16 order_recommendations

```sql
CREATE TABLE order_recommendations (
    recommendation_id   CHAR(36)    NOT NULL,
    store_id            CHAR(36)    NOT NULL,
    target_date         DATE        NOT NULL COMMENT '추천발주 대상 발주일 (n8n 배치 기준일)',
    generated_at        DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (recommendation_id),
    KEY idx_order_recommendations_store_id (store_id),
    CONSTRAINT fk_order_recommendations_store FOREIGN KEY (store_id) REFERENCES stores (store_id)
);
```

### 3.17 order_recommendation_items

```sql
CREATE TABLE order_recommendation_items (
    id                      CHAR(36)        NOT NULL,
    recommendation_id       CHAR(36)        NOT NULL,
    item_id                 CHAR(36)        NOT NULL,
    recommended_quantity    DECIMAL(10,3)   NOT NULL,
    adjusted_quantity       DECIMAL(10,3)   NOT NULL,
    lead_time_days          INT             NOT NULL COMMENT '추천 계산 시 사용한 리드타임 스냅샷',
    safety_stock            DECIMAL(10,3)   NOT NULL COMMENT '추천 계산 시 사용한 안전재고 스냅샷',
    config_status           ENUM('USER_CONFIGURED','DEFAULT_USED') NOT NULL COMMENT '추천 계산 시 설정값 사용 상태',
    last_price              INT             NULL,
    PRIMARY KEY (id),
    KEY idx_order_rec_items_recommendation_id (recommendation_id),
    CONSTRAINT fk_order_rec_items_recommendation FOREIGN KEY (recommendation_id) REFERENCES order_recommendations (recommendation_id) ON DELETE CASCADE,
    CONSTRAINT fk_order_rec_items_item FOREIGN KEY (item_id) REFERENCES inventory_items (item_id)
);
```

### 3.18 orders

```sql
CREATE TABLE orders (
    order_id                CHAR(36)        NOT NULL,
    store_id                CHAR(36)        NOT NULL,
    recommendation_id       CHAR(36)        NULL COMMENT '수동 발주 시 NULL 허용',
    status                  ENUM('APPROVED','AUTOMATED','MANUAL_REQUIRED') NOT NULL DEFAULT 'APPROVED',
    total_estimated_cost    INT             NOT NULL,
    note                    VARCHAR(500)    NULL,
    approved_at             DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    automated_at            DATETIME        NULL,
    PRIMARY KEY (order_id),
    KEY idx_orders_store_approved_at (store_id, approved_at),
    CONSTRAINT fk_orders_store FOREIGN KEY (store_id) REFERENCES stores (store_id),
    CONSTRAINT fk_orders_recommendation FOREIGN KEY (recommendation_id) REFERENCES order_recommendations (recommendation_id)
);
```

### 3.19 order_items

```sql
CREATE TABLE order_items (
    id              CHAR(36)        NOT NULL,
    order_id        CHAR(36)        NOT NULL,
    item_id         CHAR(36)        NOT NULL,
    final_quantity  DECIMAL(10,3)   NOT NULL,
    unit_price      INT             NOT NULL,
    subtotal        INT             NOT NULL,
    PRIMARY KEY (id),
    KEY idx_order_items_order_id (order_id),
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders (order_id) ON DELETE CASCADE,
    CONSTRAINT fk_order_items_item FOREIGN KEY (item_id) REFERENCES inventory_items (item_id)
);
```

### 3.20 order_approval_logs

```sql
CREATE TABLE order_approval_logs (
    id                      CHAR(36)        NOT NULL,
    order_id                CHAR(36)        NOT NULL,
    item_id                 CHAR(36)        NOT NULL,
    recommended_quantity    DECIMAL(10,3)   NOT NULL,
    adjusted_quantity       DECIMAL(10,3)   NOT NULL,
    final_quantity          DECIMAL(10,3)   NOT NULL,
    was_modified            TINYINT(1)      NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_order_approval_logs_order_id (order_id),
    CONSTRAINT fk_order_approval_logs_order FOREIGN KEY (order_id) REFERENCES orders (order_id) ON DELETE CASCADE,
    CONSTRAINT fk_order_approval_logs_item FOREIGN KEY (item_id) REFERENCES inventory_items (item_id)
);
```

### 3.21 pipeline_jobs

```sql
CREATE TABLE pipeline_jobs (
    job_id          CHAR(36)        NOT NULL,
    store_id        CHAR(36)        NOT NULL,
    type            ENUM('FORECAST','TRAIN') NOT NULL,
    status          ENUM('QUEUED','RUNNING','DONE','FAILED') NOT NULL DEFAULT 'QUEUED',
    triggered_by    ENUM('USER','N8N') NOT NULL DEFAULT 'USER',
    started_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at     DATETIME        NULL,
    error_message   VARCHAR(500)    NULL,
    PRIMARY KEY (job_id),
    KEY idx_pipeline_jobs_store_id (store_id),
    KEY idx_pipeline_jobs_status (status),
    CONSTRAINT fk_pipeline_jobs_store FOREIGN KEY (store_id) REFERENCES stores (store_id)
);
```

### 3.22 notifications

```sql
CREATE TABLE notifications (
    notification_id        CHAR(36)        NOT NULL,
    user_id                CHAR(36)        NOT NULL,
    store_id               CHAR(36)        NOT NULL,
    type                   ENUM('STOCK_LOW','EXPIRY_D3','EXPIRY_D1','EXPIRY_OVER','FORECAST_DONE','ANOMALY_HIGH') NOT NULL,
    priority               ENUM('INFO','WARNING','URGENT') NOT NULL DEFAULT 'INFO',
    title                  VARCHAR(200)    NOT NULL,
    body                   TEXT            NULL,
    related_resource_type  VARCHAR(50)     NULL COMMENT 'inventory_item / forecast / order 등',
    related_resource_id    CHAR(36)        NULL,
    is_read                TINYINT(1)      NOT NULL DEFAULT 0,
    created_at             DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (notification_id),
    KEY idx_notifications_user_unread (user_id, is_read, created_at),
    KEY idx_notifications_store (store_id),
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_notifications_store FOREIGN KEY (store_id) REFERENCES stores (store_id) ON DELETE CASCADE
);
```

> 인앱 알림 저장소. `feature_spec.md` §11 알림 정책 모두 본 테이블에 INSERT된다. Web Push 발송은 `push_subscriptions`를 참조해 BE Service가 비동기로 수행한다.

### 3.23 push_subscriptions

```sql
CREATE TABLE push_subscriptions (
    subscription_id  CHAR(36)        NOT NULL,
    user_id          CHAR(36)        NOT NULL,
    endpoint         VARCHAR(500)    NOT NULL COMMENT '브라우저별 Push Service endpoint URL',
    p256dh           VARCHAR(255)    NOT NULL COMMENT 'VAPID 공개 키 (브라우저 발급)',
    auth             VARCHAR(255)    NOT NULL COMMENT 'VAPID 인증 시크릿',
    user_agent       VARCHAR(255)    NULL,
    created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (subscription_id),
    UNIQUE KEY uq_push_subscriptions_endpoint (endpoint),
    KEY idx_push_subscriptions_user (user_id),
    CONSTRAINT fk_push_subscriptions_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);
```

> VAPID 표준 Web Push 구독 정보. Push Service가 410(Gone) 응답 시 endpoint 만료 → 본 행 삭제.

---

## 4. 인덱스 설계 요약

| 테이블 | 인덱스 | 목적 |
|--------|--------|------|
| `menus` | `(store_id, is_deleted)` | 운영 메뉴 목록 조회 시 삭제 메뉴 제외 |
| `inventory_adjustment_logs` | `(store_id)`, `(item_id)`, `(lot_id)` | 재고 조정 이력 조회 |
| `sale_records` | `(store_id, sold_at)` | 기간별 판매 조회 (가장 빈번) |
| `sale_records` | `(store_id, source, external_sale_id)` UNIQUE | POS/CSV 원본 ID가 있는 판매 데이터 중복 수집 방지 |
| `inventory_lots` | `expiry_date` | 소비기한 경고 배치 조회 |
| `forecast_results` | `(store_id, menu_id, target_date)` UNIQUE | 중복 예측 방지 + 빠른 조회 |
| `orders` | `(store_id, approved_at)` | 발주 이력 기간 조회 |
| `pipeline_jobs` | `status` | 실행 중 작업 모니터링 |
| `refresh_tokens` | `token_hash` UNIQUE | 토큰 검증 |
| `notifications` | `(user_id, is_read, created_at)` | 점주 미읽음 알림 목록 조회 |
| `push_subscriptions` | `endpoint` UNIQUE | 브라우저 구독 endpoint 중복 방지 |

---

## 5. DB 계정 분리 정책

DB 직접 접근은 용도별 전용 계정으로 분리한다. 개발자·운영팀의 DB 직접 접근은 VPN 또는 배스천 호스트를 경유한다.

| 계정 | 용도 | 권한 요약 |
|------|------|-----------|
| `app_user` | Backend 애플리케이션 | SELECT, INSERT, UPDATE, DELETE (운영 테이블 전체, DDL 없음) |
| `n8n_user` | n8n 배치 워크플로우 | 아래 표 참조 |
| `dev_readonly` | 개발자 디버깅·조회 | SELECT (전체 테이블), VPN 경유 필수 |
| `ops_readonly` | 운영팀 모니터링 | SELECT (`pipeline_jobs`, `stores` 집계), VPN 경유 필수 |

### n8n_user 권한 상세

| 권한 | 테이블 |
|------|--------|
| SELECT | `stores`, `menus`, `recipes`, `recipe_ingredients`, `inventory_items`, `inventory_lots`, `sale_records`, `forecast_results`, `order_recommendations`, `order_recommendation_items`, `order_approval_logs` |
| INSERT | `pipeline_jobs`, `forecast_results`, `order_recommendations`, `order_recommendation_items` |
| UPDATE | `pipeline_jobs` |
| DELETE | 없음 |

> 점주 대상 알림(`notifications`·`push_subscriptions`)은 BE `NotificationService.create_and_push`가 일관 처리한다. n8n은 AI 파이프라인 종료 시점에 BE 내부 API를 호출해 알림을 트리거할 뿐, `notifications` 테이블에 직접 INSERT하지 않는다 — 따라서 n8n_user에 해당 권한 부여 없음.

n8n은 운영 데이터 원본을 삭제하지 않는다. n8n의 쓰기 대상은 배치 산출물과 실행 이력 테이블로 제한한다.

---

## 6. 암호화 대상 컬럼

| 테이블 | 컬럼 | 방식 |
|--------|------|------|
| `users` | `password_hash` | bcrypt |
| `pos_connections` | `api_key` | AES-256-GCM (애플리케이션 레벨) |
| `refresh_tokens` | `token_hash` | SHA-256 |
