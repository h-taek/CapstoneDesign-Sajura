# 성능 설계서

## 1. 성능 목표

- 사용자 요청 시 수요예측과 추천발주 결과를 빠르게 반환한다.
- AI 추론 지연이 사용자 응답 시간에 직접 영향을 주지 않도록 한다.
- 매장 수 증가와 데이터 누적에 따른 처리 비용을 통제한다.

### 1.1 API별 목표 응답 시간

아래 수치는 MVP 기준 목표값이며, 실측 후 조정할 수 있다.

| API 유형 | 목표 응답 시간 | 비고 |
|----------|--------------|------|
| 일반 API (재고·메뉴·판매 조회 등) | 200ms 이하 | DB 단순 조회 |
| 예측 결과 조회 — 캐시 hit | 300ms 이하 | DB에서 사전 저장된 결과 반환 |
| 예측 결과 조회 — 캐시 miss | 5초 이하 | Backend → AI Server 단건 직접 호출 |
| 쿠팡 자동화 (Playwright) | 30초 이하 | 외부 웹 자동화 특성상 별도 기준 적용 |
| 배치 파이프라인 | SLA로 별도 정의 | 섹션 1.3 참조 |

### 1.2 동시 사용자·매장 수 기준

사주라는 점주 1인이 매장 1개를 운영하는 구조로, 대규모 동시 접속보다 **매장 수 확장에 따른 배치 처리량**이 주요 성능 변수다.

| 단계 | 매장 수 | 동시 접속자 |
|------|--------|------------|
| MVP (1단계) | 50개 | 20명 |
| 2단계 | 300개 | 100명 |
| 3단계 (목표) | 1,000개 | 300명 |

규모가 커질수록 배치 파이프라인의 병렬 처리 전략이 핵심 변수가 된다.

### 1.3 운영 환경 메모리 권장 (MVP)

운영 환경 가정: **Mac mini M2 Pro · 16 GB unified memory**. Docker Desktop은 기본 8 GB만 컨테이너에 할당하므로 사주라 6 서비스 stack에 부족.

| 항목 | 권장값 |
|------|------|
| Docker Desktop 메모리 할당 | **10~12 GB** (Settings → Resources → Memory) |
| MySQL `innodb_buffer_pool_size` | 2 GB (기본 128 MB는 50매장 데이터에 부족·swap 유발) |

| 컨테이너 | 예상 RSS |
|---------|-------|
| BE (Gunicorn 워커 4개) | 정상 1.2~2 GB / Playwright 동시 호출 peak 시 3~3.6 GB |
| ARQ 워커 | ~500 MB |
| MySQL | 1.5~2 GB |
| Redis | 0.3~0.5 GB |
| n8n | 0.5~1 GB |
| Caddy | < 50 MB |
| **소계** | **~4~7.5 GB** (peak 시) |

> 워커 수·옵션 상세는 `service_design.md` §1 Gunicorn 행 + `docs/research/backend/02_app_server.md` §4.1 참조. 운영 토폴로지는 `service_design.md` §11 참조.

---

## 2. 핵심 성능 전략

### 2.1 배치 예측

- AI예측시스템은 주기적으로 배치 예측을 수행한다.
- 사전 예측 결과 및 추천발주안을 DB에 저장한다.
- 사용자 요청 시 DB 조회를 우선 수행한다.

### 2.2 캐싱

- 예측 결과는 DB에 저장하여 즉시 응답에 대비한다.
- 저장된 예측 결과가 없을 경우에만 AI Server를 직접 호출한다.
- 수요예측·추천발주·대시보드·재고 요약은 Redis에 TTL 기반으로 캐싱하여 DB 부하를 줄인다.

> 캐시 대상·TTL·무효화 시점·전략 상세: service_design.md 섹션 9

### 2.3 야간 배치

- n8n은 매일 02:00에 배치 파이프라인을 실행한다.
- 파이프라인은 수집, 전처리, 학습, 예측, 캐싱, 알림 단계로 구성된다.

### 2.4 배치 처리 SLA

> 배치 실행 시각 기준: feature_spec.md 섹션 10

| 배치 종류 | 시작 | 완료 목표 | 허용 시간 | 단계 |
|----------|------|----------|----------|------|
| 야간 예측 배치 (매일) | 02:00 | 05:00 이전 | 3시간 | [MVP] |
| 주간 재학습 배치 (일요일) | 02:00 | 06:00 이전 | 4시간 | [2단계] (`mvp_scope.md` §4) |

완료 목표 시간 기준: 점주 출근 전 예측 결과가 준비되어야 한다.
재학습 배치는 예측 배치보다 연산량이 많으므로 여유 시간을 추가 확보한다.

**실패 시 처리:**
- 단계별 3회 자동 재시도 후에도 실패 시 개발팀 Slack 알림 발송
- 해당 매장은 직전 배치의 예측 결과를 유지한다.
- 점주에게 별도 안내 없음 (예측 완료 알림 미수신으로 인지)

### 2.4 서버 분리

- ML 서버와 Backend 서버를 분리 배포한다.
- 학습 작업이 Backend API 응답에 영향을 주지 않도록 한다.

## 3. 성능 리스크

| 리스크 | 설명 | 대응 방향 |
|---|---|---|
| AI 실시간 추론 지연 | 예측을 미리 생성하지 않으면 응답 지연 발생 | 배치 사전 생성 및 DB 캐싱 |
| n8n 실시간 처리 지연 | n8n 기반 파이프라인은 실시간 처리 지연 가능성 존재 | 경량 스트리밍 파이프라인 검토 |
| ML 서버/Backend 네트워크 레이턴시 | 서버 분리로 통신 비용 발생 가능 | Batch 예측 캐싱으로 런타임 영향 최소화 |
| 단일 DB 구조 확장 한계 | 단일 DB 구조는 확장 어려움 | 인덱싱, 파티셔닝, 슬레이브 복제 검토 |
| Playwright 자동화 불안정 | 쿠팡 웹 구조 변경 시 동작 불안정 가능성 | 타임아웃 기준 적용, 실패 즉시 수동 처리 안내 |

## 4. DB 성능 고려

- MySQL은 복잡한 쿼리와 JSON 필드를 지원한다.
- DB 인덱싱, 파티셔닝, 슬레이브 복제를 통한 확장 대응이 가능하다.
- 운영 인덱스는 `schema.md` §4에서 정의한다. 파티셔닝은 MVP 50매장 규모에서 필요 없으며 매장 수·데이터량 증가 시 적용 검토한다.

## 5. 모니터링

- n8n 실행 결과 모니터링 대시보드를 제공한다.
- BE 운영 시 응답 시간·에러율·DB 쿼리 시간을 모니터링한다.
- 구조화 로깅(stdout JSON)은 **structlog + asgi-correlation-id**로 처리한다. 필수 필드: `ts`(UTC ISO), `level`, `event`, `request_id`, `user_id`, `store_id`, `path`, `method`, `status`, `duration_ms` (`07_cache_observability.md` §3.2).
- 에러·성능 추적은 **Sentry SDK (sentry-sdk[fastapi])**를 사용한다. PII scrubbing 활성, `traces_sample_rate=0.1`(prod), `environment` 분리, Release tagging은 Git commit SHA 환경변수 주입 (`07_cache_observability.md` §3.3).
- **FE 에러·성능 추적은 `@sentry/react` + `@sentry/vite-plugin`을 사용한다.** BE와 동일 Sentry 플랫폼·동일 release(`git-<sha-short>`, `VITE_APP_VERSION` 주입)로 BE↔FE 에러 상관관계 추적. `sendDefaultPii: false` + `beforeSend` 마스킹(Authorization·Cookie·이메일·전화·사업자번호) 필수. 소스맵은 `@sentry/vite-plugin`이 빌드 시 Sentry 업로드 후 `deleteFilesAfterUpload: true`로 dist에서 제거(public 노출 차단). `sampleRate=1.0`(에러 100%) + `tracesSampleRate=0.05`(트랜잭션 5%). 결정 근거: `docs/research/frontend/11_observability.md`.
- 메트릭 수집(Prometheus)·분산 트레이싱(OpenTelemetry)은 MVP 미채택이며 매장 300+·BE 노드 2+·Sentry 이벤트 한도 초과 등 트리거 충족 시 도입한다 (`07_cache_observability.md` §2.5).

### 2.5 Playwright 자동화 타임아웃

> 재시도 정책 기준: feature_spec.md 섹션 7.2 (재시도 없음 확정)

| 기준 | 값 |
|------|-----|
| 품목당 최대 타임아웃 | 10초 |
| 전체 발주 건 최대 타임아웃 | 30초 |
| 타임아웃 초과 시 처리 | 해당 품목을 실패로 처리하고 나머지 품목 계속 진행 |
| 재시도 | 없음 — 실패 즉시 실패 품목 목록 반환 및 수동 처리 안내 |

> DB 인덱스 설계 상세: schema.md 인덱스 설계 요약 섹션

