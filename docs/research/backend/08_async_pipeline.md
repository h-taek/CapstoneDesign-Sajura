# 비동기 작업 · 데이터 파이프라인

> **카테고리**: BE 자체 백그라운드 작업·잡 큐·스케줄러, 데이터 파이프라인 오케스트레이션, 데이터 품질 검증 도구
> **연결 spec**: `docs/spec/03_be.md` §1, `docs/spec/01_basic_design.md` §3.6·§3.11·§3.12

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

**짧은 후처리**

| # | 후보 | 응답 직후 실행 | 영속성 | FastAPI 통합 |
|---|------|:------------:|:-----:|:-----------:|
| 1 | FastAPI BackgroundTasks | ◎ | X (워커 사망 시 손실) | ◎(내장) |

**잡 큐**

| # | 후보 | async | Redis 브로커 | 영속성·재시도 | FastAPI 친화 |
|---|------|:-----:|:----------:|:----------:|:-----------:|
| 2 | ARQ | ◎ | ◎ | ◎ | ◎ (SamuelColvin/Pydantic 저자) |
| 3 | Taskiq | ◎ | O | O | ◎ |
| 4 | Dramatiq | △ (async 부분적) | O | ◎ | △ |
| 5 | Celery | △ (async 통합 무거움) | O | ◎ | △ |
| 6 | RQ | X (sync 전용) | O | O | △ |

**스케줄러**

| # | 후보 | 단독 cron | 분산 락 |
|---|------|:--------:|:-----:|
| 7 | APScheduler | ◎ | △ (다중 인스턴스 시 별도) |

### 1.3 후보별 차이

- Taskiq — async와 브로커 추상화를 지원한다. 신생이라 생태계·운영 사례가 작다.
- Dramatiq — async를 부분적으로만 지원한다.
- Celery — 사실상 표준이나 async 통합이 무겁고 설정 학습 곡선이 가파르다.
- RQ — sync 전용이다.
- APScheduler — 애플리케이션 프로세스 안에서 도는 cron 스케줄러이며, 다중 인스턴스에서는 분산 락을 별도로 구성해야 한다.

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

| # | 후보 | GUI 워크플로우 | 외부 API 통합 | 자체 호스팅 | 운영 부담 |
|---|------|:----------:|:----------:|:--------:|:-------:|
| 1 | n8n | ◎ | ◎ (수백 노드) | ◎ | 낮음 |
| 2 | Airflow | X (코드 우선) | O | ◎ | 큼 (Scheduler·Worker·Webserver 3 컴포넌트) |
| 3 | Prefect | △ | O | ◎/SaaS | 중간 |
| 4 | Dagster | △ | O | ◎ | 중간 |

### 2.3 후보별 차이

- Airflow — 코드 기반 DAG를 쓰며 Scheduler·Worker·Webserver 3개 컴포넌트로 운영된다. Web UI로 흐름을 볼 수 있으나 노드 편집은 할 수 없다.
- Prefect·Dagster — 코드 기반이며 SaaS 또는 자체 호스팅으로 운영한다.

---

## 3. 데이터 품질 검증 도구

### 3.1 전체 후보 목록

| 후보 | 분류 |
|------|------|
| Great Expectations | 데이터 품질 (expectation suite·문서) |
| Pandera | DataFrame 스키마·통계 제약 |

---

## 4. 후보 세부 정보

### 4.1 FastAPI BackgroundTasks
- **장점**: 별도 인프라 불필요, 코드 단순, FastAPI 내장
- **단점**: 동일 워커 프로세스에서 실행 → 워커 사망 시 손실, 재시도 없음
- **세부사항**: FastAPI 자동 통합

### 4.2 ARQ
- **장점**: async-first, Redis 기반, SamuelColvin(Pydantic 저자) 제작·FastAPI 친화, 예약 작업·cron-like 작업·재시도 정책 지원
- **단점**: Celery 대비 생태계·모니터링 도구 좁음
- **세부사항**: 라이선스 MIT. 워커는 별도 프로세스로 실행 (`arq <module>.WorkerSettings`)

### 4.3 n8n
- **장점**: 노드 기반 GUI로 흐름 시각화, 수백 통합 노드(HTTP·DB·Slack·Webhook), 단일 컨테이너 자체 호스팅, JS Function 노드로 전처리 로직
- **단점**: 복잡 로직 Code 노드 유지보수 어려움, version control 통합 한계
- **세부사항**: 라이선스 Sustainable Use License

---

## 5. 비교 요약 표

| 분류 | 후보 | 특징 |
|------|------|------|
| 짧은 후처리 | FastAPI BackgroundTasks | 내장·비영속·재시도 없음 |
| 잡 큐 (async) | ARQ | async·Redis 기반·Pydantic 저자 |
| 잡 큐 (async) | Taskiq | 브로커 추상화·신생 |
| 잡 큐 (sync/혼합) | Celery / Dramatiq / RQ | async 통합 무거움 / async 부분 / sync 전용 |
| 스케줄러 | APScheduler | 프로세스 내부 cron·분산 락 별도 |
| 오케스트레이션 | n8n | GUI·외부 API 노드·자체 호스팅 |
| 오케스트레이션 | Airflow / Prefect / Dagster | 3 컴포넌트 운영 / 코드 기반·SaaS 또는 자체 호스팅 |
| 데이터 품질 | Great Expectations / Pandera | expectation suite / DataFrame 스키마 제약 |
