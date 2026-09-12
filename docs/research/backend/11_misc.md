# DI · ID/시간 유틸 · 결제 · 개발 편의

> **카테고리**: 의존성 주입·DTO, ID·시간·로케일·검증 유틸, 결제·외부 거래 도구(MVP 외), 개발 편의 도구
> **연결 spec**: `docs/spec/09_service_design.md` §1·§2·§3, `docs/spec/04_feature_spec.md` §9, `docs/spec/08_schema.md` §2

---

## 0. 카테고리 구성 & 결정 항목

| 하위 카테고리 | 후보 수 | 본 카테고리 신규 결정 | 다른 research 결정 ratify |
|------------|--------|--------------------|----------------------|
| §1 DI / 도메인 계층 | 4 | 0 | 2 (FastAPI Depends · Pydantic DTO) |
| §2 ID / 시간 / 검증 | 6 | 1 (phonenumbers) | 2 (UUIDv4 · datetime+zoneinfo) |
| §3 결제 · 외부 거래 | 3 | 0 | 1 (쿠팡 Playwright). MVP 외 PG/Stripe는 보존 |
| §4 개발 편의 | 5 | 2 (rich · ipython) | 1 (uvicorn --reload). 도구 3개(httpie·DBeaver·n8n Desktop)는 개발자 개인 선택으로 spec 미명시 |

### 본 research가 결정하는 라이브러리·도구 (spec 반영)

| 라이브러리 | 카테고리 | 결정 근거 위치 | spec 반영 위치 |
|----------|---------|--------------|--------------|
| phonenumbers | 검증 (운영) | §2.2 + §2.4 | `09_service_design.md` §1 운영 라이브러리 (신규) |
| rich | 개발 콘솔 | §4.2 + §4.4 | `09_service_design.md` §1 개발·테스트 도구 (신규) |
| ipython | 개발 REPL | §4.2 + §4.4 | `09_service_design.md` §1 개발·테스트 도구 (신규) |

### 이미 결정된 항목 (ratify)

| 항목 | 결정 | 결정 위치 |
|------|------|---------|
| FastAPI Depends | ✅ 채택 (DI 표준) | `01_web_framework.md` §2 + `09_service_design.md` §2·§4 |
| Pydantic DTO 패턴 | ✅ 채택 (Request/Response/내부 DTO 분리) | `04_data_layer.md` §2.4 + `09_service_design.md` §4 메서드 반환 타입 |
| UUIDv4 (Python `uuid`) | ✅ 채택 (PK 표준 CHAR(36)) | `08_schema.md` §2 |
| 표준 datetime + zoneinfo | ✅ 채택 | `04_data_layer.md` §3.4 |
| 쿠팡 Playwright 자동화 | ✅ 채택 | `06_external_integration.md` §2.4, `04_feature_spec.md` §9 |
| uvicorn --reload | ✅ 채택 (로컬 개발) | `02_app_server.md` §4 |

### 본 research 보존 후보 (probe·요구 트리거)

| 후보 | 보류 이유 | 트리거 |
|------|---------|------|
| ULID / nanoid | UUIDv4 채택 — 정렬 가능 ID는 대량 INSERT 페이지 분할 문제 시 검토 | `sale_records`·`forecast_results` 등 대량 INSERT 테이블에서 인덱스 페이지 분할로 INSERT p95 > 100 ms |
| PG사 SDK (KCP·Toss Payments·KG이니시스) | 자체 결제 도입 시점 | `04_feature_spec.md` §9 쿠팡 자동화 외 자체 결제 요구 발생 시 (현 spec엔 없음) |
| Stripe Python SDK | 해외 확장 시점 | 해외 매장 운영 결정 시 (현 spec엔 없음) |
| Dependency Injector / Punq / Lagom | FastAPI Depends + Pydantic DTO 외 컨테이너형 DI 필요성 발생 시 | BE 외 도메인 모듈(예: 별도 ML pipeline service) 분리 시 |
| babel | 다중 로케일 운영 시 | 다국가 운영 결정 시 |
| pendulum / arrow | 04에서 미채택 | 04 보존 사유 동일 |

---

## 1. DI / 도메인 계층

### 1.1 전체 후보 목록 및 1차 평가

| # | 후보 | 분류 | 결과 |
|---|------|------|:----|
| 1 | FastAPI Depends | DI | ✅ (`01_web_framework.md` §2 ratify) — FastAPI 표준. 함수 시그니처로 표현·캐싱·sub-dependency. Service·Repository·DB AsyncSession·인증 의존성 주입 |
| 2 | Dependency Injector | DI 컨테이너 | 🟡 보존 — BE 외 도메인 모듈 분리 시 |
| 3 | Punq / Lagom | 경량 DI | ⛔ 생태계 작음 |
| 4 | Pydantic DTO 패턴 | 도메인 | ✅ (`04_data_layer.md` §2.4 + `09_service_design.md` §4 ratify) — `09_service_design.md` §4 메서드 반환의 `*DTO` 명세에 대응. ORM 모델과 분리 |

### 1.2 결정 사유 (ratify 정리)

| 결정 | 사유 |
|------|------|
| FastAPI Depends 단독 사용 | `09_service_design.md` §3 13개 Service 클래스 + Controller 계층 → Service · DB AsyncSession · 인증 정보 주입을 Depends로 일관 처리. `Dependency Injector` 도입 시 두 DI 패턴 혼재 — 디버깅 비용 |
| Pydantic DTO 패턴 | Request/Response/내부 도메인 DTO 분리로 API 경계·DB 모델·Service 인터페이스를 각각 명확히 표현. `04_data_layer.md` Pydantic v2 채택과 일관 |

> **본 §1은 모두 ratify** — 신규 결정 없음.

---

## 2. ID / 시간 / 검증

### 2.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | Python `uuid` (UUIDv4) | ID | schema 확정 |
| 2 | ulid-py / python-ulid | ID | 정렬 가능 |
| 3 | nanoid | ID | 짧음 |
| 4 | pendulum / arrow | 시간 | tz-aware |
| 5 | babel | 로케일 | CLDR |
| 6 | phonenumbers | 검증 | 국가별 번호 |

### 2.2 1차 벤치마크 — 필수 기능

| # | 후보 | 채택 영역 | 결과 |
|---|------|---------|:----|
| 1 | UUIDv4 | PK 표준 CHAR(36) | ✅ (08_schema.md §2 ratify) |
| 2 | ULID | 정렬 가능 시간 기반 ID | 🟡 보존 (대량 INSERT 페이지 분할 트리거) |
| 3 | nanoid | 짧은 URL ID | ⛔ (PK 표준 외, 사주라는 외부 노출 ID 없음) |
| 4 | pendulum / arrow | tz-aware datetime | ⛔ (04 §3.4 표준 datetime + zoneinfo 채택) |
| 5 | babel | 통화·숫자·날짜 로케일 (`KRW`, `ko_KR`) | ⛔ (단일 로케일 — Frontend i18n 영역) |
| 6 | phonenumbers | `stores.phone` 검증·정규화 | ✅ **통과 (신규 결정)** |

### 2.3 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| PK ID | **필수** | schema 표준 |
| 시간 처리 | **필수** | UTC ISO 저장 |
| 전화번호 검증·정규화 | **필수** | `stores.phone`(`04_feature_spec.md` §1.4 매장 정보 입력) — 형식 다양(`010-1234-5678`·`+82 10-1234-5678`·`02-123-4567` 등) → 일관 저장 형식 필요 |
| 통화/숫자 로케일 | Frontend 영역 | BE는 `INT` 원 단위(`08_schema.md` §2)로 저장 — 표시 포맷은 Frontend |

**탈락 사유:**

- **#3 nanoid** — 짧은 URL 안전 ID. 사주라는 외부 노출 ID·단축 URL 사용 사례 없음.
- **#4 pendulum / arrow** — 04 §3.4 결정에 따라 미채택 (표준 datetime + zoneinfo 충분).
- **#5 babel** — BE는 `INT` 원 단위·UTC ISO로 저장. 표시 포맷(통화 기호·날짜 포맷 등)은 Frontend i18n 영역.

### 2.4 최종 선발

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **PK ID** | **UUIDv4 (`uuid.uuid4()`)** ✅ (ratify) | `08_schema.md` §2 표준. 모든 테이블 `PRIMARY KEY CHAR(36)` |
| **시간** | **표준 `datetime` + `zoneinfo`** ✅ (ratify) | `04_data_layer.md` §3.4 결정. UTC ISO 저장, `zoneinfo.ZoneInfo("Asia/Seoul")` 필요 시 변환 |
| **전화번호 검증·정규화** | **phonenumbers** ✅ | Google libphonenumber Python 바인딩. KR 국가 코드 검증·국제 형식(`E.164`) 변환. `stores.phone` 저장 전 정규화 |

### 2.5 보존 후보 (ULID)

ULID는 대량 INSERT 시 정렬 가능 ID로 인덱스 페이지 분할을 줄일 수 있다. 사주라 MVP에선 UUIDv4 채택 — 다음 조건에 도달하면 재평가.

**재평가 트리거:**

| 지표 | 임계치 |
|------|------|
| `sale_records` 일 INSERT 수 | ≥ 50,000 건 (매장당 평균 1000건/일 × 50매장) |
| `forecast_results` 또는 `sale_records` INSERT p95 | > 100 ms |
| MySQL secondary index 페이지 분할 빈도 | 모니터링 데이터 기반 — Sentry 트랜잭션으로 감지 |

→ 2개 이상 발생 시 ULID(또는 UUIDv7) 전환 검토. 마이그레이션 시 기존 UUIDv4 PK는 유지하고 새 컬럼 추가 또는 신규 테이블부터 적용.

---

## 3. 결제 · 외부 거래

### 3.1 전체 후보 목록 및 1차 평가

| # | 후보 | 결과 |
|---|------|:----|
| 1 | 쿠팡 Playwright 자동화 | ✅ (06 §2.4 + `04_feature_spec.md` §9 ratify) — 결제 화면까지 안내, 실제 결제는 쿠팡 직접. 자체 결제 통합 없음 → PCI DSS 부담 회피. `12_security.md` §6 카드 원본 미저장 정합 |
| 2 | PG사 SDK (KCP·Toss Payments·KG이니시스) | 🟡 보존 — 자체 결제 도입 시 |
| 3 | Stripe Python SDK | 🟡 보존 — 해외 확장 시 |

### 3.2 보존 사유

자체 결제 도입은 `04_feature_spec.md` 어디에도 명시되지 않았다 — 사주라 모든 결제 흐름은 쿠팡 직접 처리. PG사 SDK·Stripe는 미래 자체 결제·해외 확장 요구 발생 시 재평가.

> **본 §3은 결정 사항 없음** — 모두 ratify 또는 보존.

---

## 4. 개발 편의

### 4.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | uvicorn --reload / watchfiles | 자동 재시작 | 02 채택 |
| 2 | ipython | REPL | — |
| 3 | rich | 콘솔 출력 | — |
| 4 | httpie / curl / Bruno | API 수동 테스트 | 개발자 개인 선택 |
| 5 | DBeaver / TablePlus / mycli | MySQL 클라이언트 | 개발자 개인 선택 |
| 6 | n8n Desktop | n8n 로컬 GUI | 개발자 개인 선택 |

### 4.2 1차 벤치마크 — 필수 기능

| # | 후보 | 결과 |
|---|------|:----|
| 1 | uvicorn --reload | ✅ (02 §4 ratify) — 로컬 개발 자동 재시작 |
| 2 | ipython | ✅ **통과 (REPL)** — `manage.py shell` 또는 `python -m IPython` 인터랙티브 디버깅·DB 조회 |
| 3 | rich | ✅ **통과 (콘솔)** — `RichHandler`로 로컬 개발 콘솔 가독성 향상. structlog dev 모드 console renderer와 결합 |
| 4 | httpie / Bruno | 🟡 개발자 개인 선택 (spec 미명시) — Swagger UI(`/docs`)로 충분 |
| 5 | DBeaver / TablePlus / mycli | 🟡 개발자 개인 선택 (spec 미명시) |
| 6 | n8n Desktop | 🟡 개발자 개인 선택 (spec 미명시) — 사주라 n8n 운영 인스턴스와 동기화는 wf JSON export/import로 처리 |

### 4.3 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| 자동 재시작 | **필수** | 02 §4 |
| 인터랙티브 REPL | **필수** | 1인 운영 디버깅·DB 조회 — 표준 Python `>>>` REPL은 가독성 부족 |
| 콘솔 가독성 | 중요 | structlog JSON 로그를 dev에서 사람이 읽기 좋게 표시 |
| API 수동 테스트 / DB 클라이언트 / n8n GUI | 개발자 개인 선택 | spec에 묶어 둘 가치 작음 — `/docs` Swagger UI + `mysql` CLI로 기본 충족 가능 |

**탈락 사유:**

- **#4 httpie / Bruno** — 사주라는 FastAPI 자동 Swagger UI(`/docs`)로 인터랙티브 API 테스트 제공. CLI 수동 테스트 도구는 개발자 환경 자유.
- **#5 DBeaver / TablePlus / mycli** — DB 클라이언트는 OS·개인 선호. spec에서 강제하지 않음.
- **#6 n8n Desktop** — n8n 운영 인스턴스에 직접 접속하거나 workflow JSON export/import로 충분.

### 4.4 최종 선발

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **자동 재시작** | **uvicorn --reload** ✅ (ratify) | 02 §4 결정 |
| **REPL** | **ipython** ✅ | 표준 REPL 대비 자동완성·매직 명령·히스토리. 1인 운영 디버깅 필수 |
| **콘솔 출력** | **rich** ✅ | dev 환경 structlog console renderer와 결합 (`structlog.dev.ConsoleRenderer`). 운영은 JSON 출력(`07_cache_observability.md` §3.2) 유지 |

---

## 5. 통합 최종 결정 (spec 반영)

### 5.1 라이브러리 결정 (3개 신규)

**운영 라이브러리 (`09_service_design.md` §1 본 표에 추가)**

| 라이브러리 | 역할 |
|----------|------|
| **phonenumbers** | `stores.phone` 검증·E.164 정규화 (Google libphonenumber Python 바인딩) |

**개발·테스트 도구 (`09_service_design.md` §1 개발·테스트 도구 표에 추가)**

| 도구 | 역할 |
|------|------|
| **ipython** | 인터랙티브 REPL — 자동완성·매직 명령·히스토리 |
| **rich** | dev 콘솔 출력 (structlog `ConsoleRenderer`와 결합) — 운영은 JSON 유지 |

### 5.2 결정에 따라 spec에서 갱신될 항목 (참조)

| 영향 영역 | 결정 사항 | 위치 |
|---------|---------|------|
| `stores.phone` 정규화 형식 | E.164 (`+82 10-1234-5678` 또는 국내 표준 `010-1234-5678` 중 택1) | `04_feature_spec.md` §1.4 매장 정보 입력 또는 `08_schema.md` §3.3 `stores.phone` 코멘트 — 결정 필요 |

> DB 컬럼·API endpoint·서비스 시그니처 추가 없음. `stores.phone` 정규화 형식은 결정 후 spec 반영.

---

## 6. 후보 세부 정보

### 6.1 phonenumbers ✅ (신규)
- **사용처**: `stores.phone` 입력 검증·정규화. 점주가 입력한 다양한 포맷(`010-1234-5678`·`+82 10-1234-5678`·`02-123-4567`)을 일관된 저장 형식으로 변환
- **장점**: Google libphonenumber 표준, KR 국가 코드 검증·E.164 변환·휴대폰/유선 구분
- **단점**: 라이브러리 크기(~6 MB) — Docker 이미지에 큰 부담은 아님
- **세부사항**: 라이선스 Apache 2.0. `phonenumbers.parse(value, "KR")` + `phonenumbers.is_valid_number()` + `phonenumbers.format_number(num, PhoneNumberFormat.E164)`

### 6.2 ipython ✅ (신규)
- **사용처**: 인터랙티브 REPL·DB 조회·디버깅
- **장점**: 자동완성·매직 명령(`%timeit`·`%debug`·`%history`)·히스토리·풍부한 traceback
- **단점**: dev 의존성에만 포함 (운영 이미지에는 불필요)
- **세부사항**: 라이선스 BSD. uv group `dev`에 포함

### 6.3 rich ✅ (신규)
- **사용처**: dev 콘솔 출력 — structlog `ConsoleRenderer`와 결합
- **장점**: 색상·박스·테이블·tracestack 가독성 매우 좋음. structlog 통합 사례 풍부
- **단점**: 운영에서는 JSON 1줄/이벤트 유지 (`07_cache_observability.md` §3.2) — 운영 의존성에 포함되어도 무관 (사용 않음)
- **세부사항**: 라이선스 MIT

### 6.4 FastAPI Depends (ratify)
- **사용처**: Service·Repository·DB AsyncSession·인증 정보·`store_id` 주입
- **장점**: FastAPI 표준, 함수 시그니처로 표현, 캐싱·sub-dependency
- **단점**: 도메인 코어에서는 사용 어려움 (테스트 시 우회 패턴 필요)
- **세부사항**: `09_service_design.md` §2 계층 구조에 명시

### 6.5 Pydantic DTO (ratify)
- **사용처**: `09_service_design.md` §4 메서드 반환 `UserDTO`·`StoreDTO` 등
- **장점**: Request/Response/내부 DTO 분리 명확, OpenAPI 자동 스키마
- **단점**: ORM 모델 ↔ DTO 매핑 작성량 — `model_validate(orm_obj, from_attributes=True)`로 최소화

### 6.6 보존·탈락 후보 요약

| 후보 | 분류 | 결과 | 사유 |
|------|------|------|------|
| Dependency Injector | DI 컨테이너 | 🟡 보존 | BE 외 도메인 모듈 분리 시 |
| Punq / Lagom | 경량 DI | ⛔ | 생태계 작음 |
| ULID / nanoid | ID | 🟡 보존 / ⛔ | 정렬 가능 ID 필요 시 / 외부 노출 없음 |
| pendulum / arrow | 시간 | ⛔ | 04 §3.4 표준 datetime 채택 |
| babel | 로케일 | ⛔ | Frontend i18n 영역 |
| PG사 SDK / Stripe | 결제 | 🟡 보존 | 자체 결제·해외 확장 시 |
| httpie / Bruno / DBeaver / mycli / n8n Desktop | 개발 도구 | 🟡 개인 선택 | spec 미명시 |

---

## 7. 비교 요약 표

| 분류 | 후보 | 결과 | 핵심 사유 |
|------|------|------|---------|
| DI | FastAPI Depends | ✅ (01 ratify) | 표준 |
| DI 컨테이너 | Dependency Injector / Punq / Lagom | 🟡 / ⛔ | 분리 시 / 생태계 작음 |
| 도메인 | Pydantic DTO | ✅ (04·07backend ratify) | DTO 분리 명확 |
| PK ID | UUIDv4 | ✅ (schema ratify) | 표준 |
| ID 대안 | ULID / nanoid | 🟡 보존 / ⛔ | 정렬 트리거 / 외부 ID 없음 |
| 시간 | datetime + zoneinfo | ✅ (04 ratify) | 표준 |
| 시간 대안 | pendulum / arrow | ⛔ | 04 결정 |
| 로케일 | babel | ⛔ | Frontend 영역 |
| 검증 | phonenumbers | ✅ | KR 표준·E.164 |
| 결제 | 쿠팡 Playwright | ✅ (06 ratify) | PCI 부담 회피 |
| 결제 대안 | PG사 / Stripe | 🟡 보존 | 자체 결제·해외 |
| 자동 재시작 | uvicorn --reload | ✅ (02 ratify) | 로컬 개발 |
| REPL | ipython | ✅ | 자동완성·매직 명령 |
| 콘솔 | rich | ✅ | structlog dev console |
| API 테스트 / DB 클라이언트 / n8n Desktop | 개인 선택 | 🟡 미명시 | spec에 묶을 가치 작음 |
