# 06 알림 BE

> 범위 결정은 spec에 있다 — 알림 정책·단위·설정 `01_basic_design.md` §3.12, 소비기한 배치 §3.3.6, 파기 증빙 이메일 §5.2.1, API `02_implementation_design.md` §3.10, DDL §4.3.1·§4.3.23·§4.3.24, Rate Limit `03_be.md` §13.4.
> 예측 완료 알림의 트리거(n8n → BE API)는 n8n 배치 작업에서 붙인다. 이번에는 `NotificationService`가 `FORECAST_DONE`을 받을 수 있게만 둔다. 화면(알림 목록·설정·구독)은 FE 일괄에서 만든다.

## 1. BE

진행 순서.

1. 의존성 — `pywebpush==2.0.3`, `fastapi-mail==1.5.0`. 기존 고정 버전(pydantic·starlette·cryptography·email-validator)을 올리지 않는 조합이다.
2. 마이그레이션 `0013_notification_settings` — `users`에 `notify_expiry`·`notify_stock_low`·`notify_forecast_done`·`notify_anomaly` TINYINT(1) NOT NULL DEFAULT 1. `notifications`·`push_subscriptions`는 `0001`에 이미 있다.
3. 모델 — `Notification`(`NotificationType`·`NotificationPriority` enum), `PushSubscription`, `User`에 알림 설정 칸.
4. `NotificationService`(`app/services/notification_service.py`)
   - `create_and_push(store_id, type, title, body, related_resource_type, related_resource_id)` — 매장 → 점주를 찾고, 꺼진 설정 묶음이면 만들지 않는다. 우선순위는 유형으로 정한다(§3.12 표). 저장·커밋 뒤 점주의 구독마다 Web Push를 보낸다(`asyncio.to_thread`로 pywebpush 호출). 404·410이면 구독을 지우고, 그 밖의 실패는 로그만 남긴다. VAPID 키가 비어 있으면 푸시를 건너뛴다.
   - 조회·변경 — 목록(`is_read` 필터, `created_at` 최신순, 페이지), 한 건 읽음·전체 읽음, 구독 등록(같은 `endpoint`면 갱신)·해제, 설정 조회·부분 변경.
5. 트리거
   - 소비기한 — `InventoryService.check_expiry_batch(today)`. `remaining_quantity > 0`이고 `expiry_date`가 오늘+3·오늘+1·어제인 로트를 품목·조건으로 묶어 로트 수를 본문에 넣는다. 같은 날(한국 시각, DB는 UTC라 경계를 환산한다) 같은 품목·유형 알림이 있으면 건너뛴다.
   - 업로드 — `SaleService.upload_csv` 끝에서 `anomaly_count > 0`이면 이상치 알림 한 건, `needs_check_items`마다 재고 부족 알림.
   - 배치 등록 — `worker.py`에 `check_expiry_batch` 01:30 cron.
6. API(`app/api/notifications.py`) — §3.10 7개. 목록 60/min·구독 등록 10/min을 `user_id` 키로(`rate_limit.py`에 토큰의 `sub`를 키로 쓰는 식별자 추가, 토큰이 없으면 IP).
7. 파기 증빙 이메일 — `app/integrations/mailer.py`(fastapi-mail). `AccountPurgeService._purge`가 삭제 전에 이메일 주소를 잡아 두고 커밋 뒤 보낸다. 발송 실패는 로그만 남긴다. 설정 `MAIL_*`, dev는 `MAIL_SUPPRESS_SEND=true`(실제 발송 없음).
8. `Front/openapi.json`·`types.gen.ts` 재생성.

## 2. 검증

- `notifications_test.py` — 목록 페이지·`is_read` 필터·최신순, 다른 사용자 알림 읽음 404, 전체 읽음, 구독 등록·같은 endpoint 갱신·해제·다른 사용자 구독 404, 설정 조회·부분 변경, 꺼진 묶음은 만들지 않음, 푸시 대상·410 구독 삭제(pywebpush 호출을 대체), 목록 61번째 요청 429.
- `inventory_test.py` — 소비기한 배치: D-3·D-1·초과 첫날만 만들고 D-2·초과 둘째 날·남은 수량 0은 제외, 같은 품목 로트 여러 개는 한 건, 같은 날 재실행은 새로 만들지 않음.
- `sales_test.py` — 업로드로 재고 확인 필요가 된 품목마다 재고 부족 알림, 이상치가 있으면 이상치 알림 한 건(탐지기를 대체).
- `withdrawal_test.py` — 파기 시 증빙 메일 한 통(`record_messages`).
- `0013` upgrade·downgrade 왕복, BE 전체 pytest(컨테이너 안), `arq-worker` 기동 후 cron 등록 확인.
