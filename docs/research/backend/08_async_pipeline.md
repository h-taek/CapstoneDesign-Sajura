# 비동기 작업 · 데이터 파이프라인

> **카테고리**: BE 자체 백그라운드 작업·잡 큐·스케줄러, 데이터 파이프라인 오케스트레이션, 데이터 품질 검증 도구
> **연결 spec**: `docs/spec/09_service_design.md` §1, `docs/spec/04_feature_spec.md` §5·§10·§11

---

## 0. 카테고리 구성 & 결정 항목

| 하위 카테고리 | 후보 수 | 결정 항목 수 |
|------------|--------|------------|
| §1 백그라운드 작업·잡 큐·스케줄러 | 7 | 3 (짧은 후처리 / 잡 큐 / 스케줄러) |
| §2 데이터 파이프라인 오케스트레이션 | 4 | 1 (ratify) |
| §3 데이터 품질 검증 (보류 — AI 영역 확정 후) | 2 | 0 (본 단계 결정 보류) |

### 본 research가 결정하는 라이브러리 (spec 반영)

| 라이브러리 | 카테고리 | 결정 근거 위치 | spec 반영 위치 |
|----------|---------|--------------|--------------|
| FastAPI BackgroundTasks | 짧은 후처리 | §1.2 + §1.4 | `01_web_framework.md` §2 필수 기능에서 채택. `09_service_design.md` §1 FastAPI에 포함 |
| ARQ | 잡 큐 (Redis 기반) | §1.2 + §1.4 | `09_service_design.md` §1 (신규) |
| n8n | 데이터 파이프라인 | §2.2 + §2.4 | `09_service_design.md` §1 외부 운영 도구 (기존) |

### 본 research 결정 — 미채택 (영역 위임)

| 영역 | 결정 |
|------|------|
| APScheduler | 미채택 — n8n으로 스케줄 통합 |
| Airflow / Prefect / Dagster | 미채택 — n8n 본채택 유지 |
| Celery / RQ / Taskiq / Dramatiq | 미채택 — ARQ 우위 |

### 본 research 결정 보류 — AI 영역 확정 후 작업

| 영역 | 보류 이유 |
|------|---------|
| 데이터 품질 검증 도구 (Great Expectations · Pandera) | ML 파이프라인 입력 데이터(결측·이상치) 검증 영역. `docs/spec/11_ai_spec.md`의 결측·이상치 처리 기준 확정 후 본 카테고리에서 검증 도구 결정 |

---

## 1. 백그라운드 작업 · 잡 큐 · 스케줄러

### 1.1 전체 후보 목록

짧은 후처리 1개 + 잡 큐 5개 + 스케줄러 1개 = **총 7개**.

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | FastAPI BackgroundTasks | 짧은 후처리 | 프레임워크 내장 |
| 2 | ARQ | 잡 큐 (async) | Redis 기반 |
| 3 | Taskiq | 잡 큐 (async) | 브로커 추상화 |
| 4 | Dramatiq | 잡 큐 (sync) | 단순·견고 |
| 5 | Celery | 잡 큐 (sync) | 사실상 표준 |
| 6 | RQ | 잡 큐 (sync) | 가장 단순 |
| 7 | APScheduler | 스케줄러 | BE 내부 cron |

### 1.2 1차 벤치마크 — 필수 기능

**짧은 후처리** (응답 직후 인앱 알림 INSERT 후 Web Push 발송 등)

| # | 후보 | 응답 직후 실행 | 영속성 | FastAPI 통합 | 결과 |
|---|------|:------------:|:-----:|:-----------:|:----|
| 1 | FastAPI BackgroundTasks | ◎ | ⛔ (워커 사망 시 손실) | ◎(내장) | ✅ **통과 (짧은 후처리)** |

**잡 큐** (쿠팡 자동화·단가 일괄 갱신·예약 작업 — 영속성·재시도 필요)

| # | 후보 | async | Redis 재활용 | 영속성·재시도 | FastAPI 친화 | 결과 |
|---|------|:-----:|:----------:|:----------:|:-----------:|:----|
| 2 | ARQ | ◎ | ◎ (사주라 기존 Redis 재사용) | ◎ | ◎ (SamuelColvin/Pydantic 저자) | ✅ **통과 (잡 큐)** |
| 3 | Taskiq | ◎ | O | O | ◎ | ⛔ (신생·생태계 작음 — ARQ 우위) |
| 4 | Dramatiq | △ (async 부분적) | O | ◎ | △ | ⛔ |
| 5 | Celery | △ (async 통합 무거움) | O | ◎ | △ | ⛔ (사주라 MVP 과한 수준) |
| 6 | RQ | ⛔ (sync 전용) | O | O | △ | ⛔ |

**스케줄러** (사주라 모든 cron 작업)

| # | 후보 | 단독 cron | 분산 락 | n8n과 역할 중복 | 결과 |
|---|------|:--------:|:-----:|:------------:|:----|
| 7 | APScheduler | ◎ | △ (다중 인스턴스 시 별도) | ⛔ (n8n이 스케줄 표준) | ⛔ |

### 1.3 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| 응답 직후 짧은 후처리 | **필수** | 인앱 알림 INSERT → Web Push 발송, 이메일 발송 등 응답 차단 없이 처리 |
| 영속 잡 큐 | **필수** | 쿠팡 자동화·단가 일괄 갱신은 BackgroundTasks 영속성 부재로 부적합 |
| Redis 인프라 재활용 | **필수** | `09_service_design.md` §1·§9 Redis 기존 사용 — 새 브로커 도입 부담 회피 |
| async/await | **필수** | `02_app_server.md` §4.1 I/O bound 일관성 |
| 단일 스케줄링 도구 | **필수** | n8n + APScheduler 이중 운영 시 cron 충돌·운영 부담 |

**탈락 사유:**

- **#3 Taskiq** — async + 브로커 추상화는 강점이나 신생·생태계·운영 사례 작음. 사주라 MVP는 Redis 단일 브로커로 충분 → ARQ가 우위.
- **#4 Dramatiq** — async 부분 지원. 사주라 BE async 일관성에 부적합.
- **#5 Celery** — 사실상 표준이나 async 통합 무거움·설정 곡선 가파름. 사주라 MVP 50매장에 과한 수준.
- **#6 RQ** — sync 전용. async BE 부적합.
- **#7 APScheduler** — n8n이 스케줄·외부 API·DB 작업을 통합 운영하는데 BE 내부에 별도 cron 운영 시 작업 분산·운영 복잡도 증가. n8n으로 단일화.

### 1.4 최종 선발

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **짧은 후처리** | **FastAPI BackgroundTasks** ✅ | 응답 직후 비차단 후처리 — 인앱 알림 INSERT 후 Web Push 발송, Sentry 컨텍스트 기록 등. `01_web_framework.md` §2에서 FastAPI 필수 기능으로 확정 |
| **잡 큐 (영속·재시도) + BE 도메인 cron** | **ARQ** ✅ | async-first, Redis 재활용(`09_service_design.md` §9 Redis 이미 운영)으로 인프라 추가 0, Pydantic 저자 제작으로 FastAPI 친화. 쿠팡 자동화·단가 일괄 갱신·이메일 예약 발송 + **BE 도메인 정기 작업**(소비기한 일일 체크 등)을 `cron_jobs`로 통합 처리 |
| **AI 파이프라인 오케스트레이션** | **n8n** ✅ (§2.4 참조) | AI 야간 예측·재학습 배치 + AI 흐름 외부 API 수집 등 ML 관련 자동화. **BE 도메인 cron은 책임 영역 아님** |

> **책임 분리 원칙**:
> - **n8n** = AI 파이프라인 자동화 도구 (외부 API 수집·AI Server 호출·예측 결과 저장 등 ML 흐름)
> - **ARQ** = BE 도메인 잡 큐 + cron (소비기한 체크·단가 갱신·이메일 예약 등 비즈니스 로직)
>
> "모든 cron을 n8n에 몰아넣는" 패턴은 도메인 책임 부적합. n8n은 AI 워크플로우 도구이지 BE 도메인 스케줄러가 아니다.

### 1.5 BackgroundTasks vs ARQ 사용 구분

| 작업 | 도구 | 사유 |
|------|------|------|
| 인앱 알림 INSERT 후 Web Push 발송 | BackgroundTasks | 응답 직후 1~2초 내 종료, 손실 허용 (Web Push 재발송 가능) |
| Sentry 컨텍스트 부가 메타데이터 기록 | BackgroundTasks | 동일 |
| 쿠팡 장바구니 자동화 (Playwright) | ARQ | 5~60초 소요·영속·재시도 정책(`04_feature_spec.md` §7.2) 필요 |
| 발주 확정 후 단가 일괄 갱신 (`SiteScrapingService`) | ARQ | 여러 품목 순회 — 영속·실패 추적 필요 |
| 회원 탈퇴 30일 유예 후 파기 통보 메일 | ARQ (예약 작업) | 30일 후 실행 — 영속 큐 필수 |

---

## 2. 데이터 파이프라인 오케스트레이션

### 2.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | n8n | GUI 오케스트레이션 | 노드 기반 |
| 2 | Apache Airflow | 코드(Python DAG) | 광범위 사례 |
| 3 | Prefect | 코드(Python) | 현대적 |
| 4 | Dagster | 코드(Python) | 자산 기반 |

### 2.2 1차 벤치마크 — 필수 기능

| # | 후보 | GUI 워크플로우 | 외부 API 통합 | 자체 호스팅 | 운영 부담 | 결과 |
|---|------|:----------:|:----------:|:--------:|:-------:|:----|
| 1 | n8n | ◎ | ◎ (수백 노드) | ◎ | 낮음 | ✅ **통과** |
| 2 | Airflow | ⛔ (코드 우선) | O | ◎ | 큼 (Scheduler·Worker·Webserver 3 컴포넌트) | ⛔ |
| 3 | Prefect | △ | O | ◎/SaaS | 중간 | ⛔ |
| 4 | Dagster | △ | O | ◎ | 중간 | ⛔ |

### 2.3 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| GUI 워크플로우 | **필수** | 사주라는 BE 팀(2명) + 1인 운영. GUI로 흐름 시각화·디버깅 |
| 외부 API 통합 | **필수** | `04_feature_spec.md` §10 외부 데이터 수집 — 국세청·기상청·서울시 등 다수 |
| 자체 호스팅 | **필수** | Mac mini 단일 노드 자체 운영 |
| 운영 부담 | **필수** | 1인 운영 — 컨테이너 1개로 끝나는 수준 우선 |

**탈락 사유:**

- **#2 Airflow** — 코드 기반 DAG·표준은 강점이나 Scheduler·Worker·Webserver 3개 컴포넌트로 Mac mini 자원 부담 큼. GUI 흐름 시각화는 Web UI 제공하나 노드 편집은 불가 → 1인 운영 환경에서 n8n 대비 디버깅 비용 큼.
- **#3 Prefect / #4 Dagster** — 현대적 UX·코드 기반 강점이나 SaaS·자체 호스팅 모두 운영 비용. n8n 채택으로 보류.

### 2.4 최종 선발

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **데이터 파이프라인 오케스트레이션** | **n8n** ✅ (ratify) | 노드 기반 GUI로 야간 배치(`04_feature_spec.md` §10) 9단계 + 소비기한 일일 점검(§3.1) 시각적 표현. 수백 통합 노드(HTTP·DB·Slack·Webhook)로 외부 API·DB 작업 일체 처리. 단일 컨테이너 자체 호스팅. JS Function 노드로 전처리 로직 작성 가능. Sustainable Use License는 사주라 자체 운영에 무영향 |

---

## 3. 데이터 품질 검증 도구 — 보류 (AI 영역 확정 후)

### 3.1 보류 사유

| 후보 | 분류 |
|------|------|
| Great Expectations | 데이터 품질 (expectation suite·문서) |
| Pandera | DataFrame 스키마·통계 제약 |

**보류 이유:**

데이터 품질 검증은 ML 파이프라인 입력 데이터의 결측·이상치 처리와 직결된다. 검증 규칙 자체가 다음 spec 항목 결정 이후에야 의미를 갖는다:
- `docs/spec/11_ai_spec.md` 결측·이상치 처리 기준

**보류 종료 조건:**

위 문서의 결측·이상치 처리 기준이 확정되면 본 §3을 다시 열어 Great Expectations vs Pandera vs 미채택(Pydantic + pandas 직접) 결정을 수행한다. 결정 결과는 `09_service_design.md` §1에 반영하고, n8n 전처리 단계와의 결합 흐름은 `04_feature_spec.md` §10 또는 `11_ai_spec.md`에서 별도 정의한다.

> 본 보류는 BE 8 카테고리 13개 결정 항목 중 1개에 한정된다. 본 research의 나머지 결정은 위 보류와 독립적으로 spec에 반영된다.

---

## 4. 운영 흐름 (research 결정)

### 4.1 소비기한 일일 알림 배치

`04_feature_spec.md` §11 알림 정책에 정의된 D-3·D-1·초과 알림은 매일 일관된 시각에 발송되어야 한다. 소비기한 체크는 **재고 도메인 비즈니스 로직**이므로 BE가 책임진다 — n8n(AI 파이프라인 도구)에 위임하지 않는다.

| 항목 | 결정 |
|------|------|
| 실행 도구 | **BE ARQ `cron_jobs`** (`09_service_design.md` §1 ARQ 행 정의) |
| 실행 시각 | 매일 02:00 (AI 야간 배치와 분리 — 동시 시작 자원 경합 없음, ARQ 워커가 독립 컨테이너로 처리) |
| 진입점 | `InventoryService.check_expiry_batch` (`09_service_design.md` §4) |
| 흐름 | ARQ cron 트리거 → `InventoryService.check_expiry_batch` 호출 → `inventory_lots.expiry_date` 조회·D-3/D-1/초과 매칭 → `NotificationService.create_and_push` 호출 → `notifications` INSERT + Web Push (pywebpush) |
| 실패 처리 | ARQ 자체 재시도 정책 적용 (작업별 정의). 운영 에러는 sentry-sdk가 자동 포착 |

> 본 결정은 `04_feature_spec.md` §3.6에 반영 — spec source-of-truth. n8n_user의 `notifications` 권한은 회수(`08_schema.md` §5).

### 4.2 잡 큐 인프라

| 항목 | 결정 |
|------|------|
| 브로커 | Redis (사주라 기존 인프라 재활용, `09_service_design.md` §1·§9) |
| 결과 백엔드 | Redis (동일) |
| 큐 키 prefix | `arq:queue:default` (ARQ 기본). 향후 큐 분리 필요 시 prefix로 분할 |
| 워커 프로세스 | 운영 환경에서 BE Gunicorn 컨테이너와 별도 컨테이너 1개로 실행 (`arq main.WorkerSettings`) |
| 재시도 정책 | 작업별 정의 — 쿠팡 자동화는 재시도 없음(`04_feature_spec.md` §7.2), 단가 갱신은 3회, 이메일은 5회 |

### 4.3 BackgroundTasks 사용 범위

| 적합 | 부적합 |
|------|--------|
| 1~3초 내 종료되는 비차단 후처리 | 5초 이상 또는 영속이 필요한 작업 |
| 손실 허용 작업 (재발송·재계산 가능) | 결제·발주·환불 등 손실 불가 작업 |
| 인앱 알림 INSERT 후 Web Push 발송 | 쿠팡 자동화·이메일 예약 발송 |

> 부적합 작업은 ARQ로 위임한다.

---

## 5. 통합 최종 결정 (spec 반영)

### 5.1 라이브러리 결정 (1개 신규 + 2개 기존 ratify)

| 라이브러리 | 역할 | spec 반영 위치 |
|----------|------|--------------|
| **ARQ** | Redis 기반 async 잡 큐. 쿠팡 자동화·단가 일괄 갱신·예약 발송. 별도 워커 컨테이너 1개 | `09_service_design.md` §1 (신규) |
| `FastAPI BackgroundTasks` (기존) | 짧은 후처리 (응답 후 1~3초) | `01_web_framework.md` §2 + `09_service_design.md` §1 FastAPI에 포함 |
| `n8n` (기존) | 데이터 파이프라인 오케스트레이션 | `09_service_design.md` §1 외부 운영 도구 |

### 5.2 결정에 따라 spec에서 갱신될 항목 (참조)

| 영향 영역 | 결정 사항 | 위치 |
|---------|---------|------|
| 소비기한 일일 알림 배치 실행 주체·시각·흐름 | n8n 매일 02:30 — 흐름 §4.1 | `04_feature_spec.md` (§10 파이프라인 또는 §11 알림 정책 절에 추가) |
| 잡 큐 인프라 운영 흐름 | ARQ + Redis + 별도 워커 컨테이너 | `09_service_design.md` §1 ARQ 행 + 운영 메모 |

> DB 컬럼·API endpoint·서비스 시그니처 추가 없음 — 본 카테고리 결정은 라이브러리·운영 흐름 한정.

---

## 6. 후보 세부 정보

### 6.1 FastAPI BackgroundTasks ✅
- **사용처**: 응답 후 1~3초 비차단 후처리
- **장점**: 별도 인프라 불필요, 코드 단순, FastAPI 내장
- **단점**: 동일 워커 프로세스에서 실행 → 워커 사망 시 손실, 재시도 없음
- **세부사항**: `01_web_framework.md` §2 9개 필수 기능에서 채택. FastAPI 자동 통합

### 6.2 ARQ ✅
- **사용처**: Redis 기반 async 영속 잡 큐
- **장점**: async-first, Redis 재활용으로 인프라 추가 0, SamuelColvin(Pydantic 저자) 제작·FastAPI 친화, 예약 작업·cron-like 작업·재시도 정책 지원
- **단점**: Celery 대비 생태계·모니터링 도구 좁음 (사주라 MVP 규모에 무관)
- **세부사항**: 라이선스 MIT. 별도 워커 컨테이너 1개로 운영 (`arq <module>.WorkerSettings`)

### 6.3 n8n ✅ (ratify)
- **사용처**: 야간 배치(FORECAST·TRAIN) + 소비기한 일일 점검 + 파이프라인 실패 Slack 알림
- **장점**: 노드 기반 GUI로 흐름 시각화, 수백 통합 노드(HTTP·DB·Slack·Webhook), 단일 컨테이너 자체 호스팅, JS Function 노드로 전처리 로직
- **단점**: 복잡 로직 Code 노드 유지보수 어려움 (사주라는 전처리 정도라 무관), version control 통합 한계
- **세부사항**: 라이선스 Sustainable Use License (자체 운영 무영향)

### 6.4 보존·탈락 후보 요약

| 후보 | 분류 | 결과 | 사유 |
|------|------|------|------|
| Taskiq | 잡 큐 | ⛔ | 신생·생태계 작음 — ARQ 우위 |
| Dramatiq | 잡 큐 | ⛔ | async 부분 지원 |
| Celery | 잡 큐 | ⛔ | MVP 과한 수준 |
| RQ | 잡 큐 | ⛔ | sync 전용 |
| APScheduler | 스케줄러 | ⛔ | n8n과 역할 중복 |
| Airflow | 오케스트레이션 | ⛔ | 3 컴포넌트 운영 부담 |
| Prefect / Dagster | 오케스트레이션 | ⛔ | n8n 채택으로 보류 |
| Great Expectations | 데이터 품질 | ⏸ 보류 | AI 영역 확정 후 (§3) |
| Pandera | 데이터 품질 | ⏸ 보류 | AI 영역 확정 후 (§3) |

---

## 7. 비교 요약 표

| 분류 | 후보 | 결과 | 핵심 사유 |
|------|------|------|---------|
| 짧은 후처리 | FastAPI BackgroundTasks | ✅ | 내장·1~3초 비차단 후처리 |
| 잡 큐 (async) | ARQ | ✅ | async·Redis 재활용·Pydantic 저자 |
| 잡 큐 (async) | Taskiq | ⛔ | 신생 — ARQ 우위 |
| 잡 큐 (sync/혼합) | Celery / Dramatiq / RQ | ⛔ | MVP 과함 / async 부분 / sync 전용 |
| 스케줄러 | APScheduler | ⛔ | n8n과 역할 중복 |
| 오케스트레이션 | n8n | ✅ (ratify) | GUI·외부 API·자체 호스팅 |
| 오케스트레이션 | Airflow / Prefect / Dagster | ⛔ | 운영 부담 / SaaS 비용 |
| 데이터 품질 | Great Expectations / Pandera | ⏸ 보류 | AI 영역 결정 의존 |
