# DI · ID/시간 유틸 · 결제 · 개발 편의

> **카테고리**: 의존성 주입·DTO, ID·시간·로케일·검증 유틸, 결제·외부 거래 도구, 개발 편의 도구
> **연결 spec**: `docs/spec/03_be.md` §1·§2·§3, `docs/spec/01_basic_design.md` §3.10, `docs/spec/02_implementation_design.md` §4.2

---

## 1. DI / 도메인 계층

### 1.1 전체 후보 목록

| # | 후보 | 분류 | 특징 |
|---|------|------|------|
| 1 | FastAPI Depends | DI | FastAPI 표준. 함수 시그니처로 표현·캐싱·sub-dependency |
| 2 | Dependency Injector | DI 컨테이너 | 컨테이너형 DI |
| 3 | Punq / Lagom | 경량 DI | 생태계 작음 |
| 4 | Pydantic DTO 패턴 | 도메인 | Request/Response/내부 DTO를 ORM 모델과 분리 |

### 1.2 후보별 차이

- Dependency Injector — FastAPI Depends와 함께 쓰면 DI 패턴이 두 가지로 섞인다.
- Punq / Lagom — 경량 DI이며 생태계가 작다.

---

## 2. ID / 시간 / 검증

### 2.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | Python `uuid` (UUIDv4) | ID | 표준 라이브러리 |
| 2 | ulid-py / python-ulid | ID | 정렬 가능 |
| 3 | nanoid | ID | 짧음 |
| 4 | pendulum / arrow | 시간 | tz-aware |
| 5 | babel | 로케일 | CLDR |
| 6 | phonenumbers | 검증 | 국가별 번호 |

### 2.2 1차 벤치마크 — 필수 기능

| # | 후보 | 특징 |
|---|------|------|
| 1 | UUIDv4 | 무작위 ID. 문자열 36자(`CHAR(36)`) |
| 2 | ULID | 정렬 가능 시간 기반 ID |
| 3 | nanoid | 짧은 URL 안전 ID |
| 4 | pendulum / arrow | tz-aware datetime |
| 5 | babel | 통화·숫자·날짜 로케일 포맷 (`KRW`, `ko_KR`) |
| 6 | phonenumbers | 전화번호 검증·정규화 |

### 2.3 후보별 차이

- ULID — 시간 순으로 정렬돼 대량 INSERT 시 인덱스 페이지 분할을 줄일 수 있다. UUIDv7도 같은 성질을 가진다. UUIDv4는 무작위라 정렬되지 않는다.
- nanoid — 짧은 URL 안전 ID를 만든다.
- pendulum / arrow — 표준 `datetime` + `zoneinfo`로도 tz-aware 처리를 할 수 있다.
- babel — 통화 기호·날짜 포맷 같은 표시 포맷을 다룬다.
- phonenumbers — `010-1234-5678`·`+82 10-1234-5678`·`02-123-4567`처럼 형식이 다른 입력을 같은 형식으로 정규화한다.

---

## 3. 결제 · 외부 거래

### 3.1 전체 후보 목록

| # | 후보 | 비고 |
|---|------|------|
| 1 | 쿠팡 직접 결제 | 결제는 쿠팡에서 진행된다. 자체 결제 통합이 없으면 카드 정보를 다루지 않아 PCI DSS 부담이 없다 |
| 2 | PG사 SDK (KCP·Toss Payments·KG이니시스) | 국내 PG 결제 연동 |
| 3 | Stripe Python SDK | 해외 결제 연동 |

---

## 4. 개발 편의

### 4.1 전체 후보 목록

| # | 후보 | 분류 |
|---|------|------|
| 1 | uvicorn --reload / watchfiles | 자동 재시작 |
| 2 | ipython | REPL |
| 3 | rich | 콘솔 출력 |
| 4 | httpie / curl / Bruno | API 수동 테스트 |
| 5 | DBeaver / TablePlus / mycli | MySQL 클라이언트 |
| 6 | n8n Desktop | n8n 로컬 GUI |

### 4.2 1차 벤치마크 — 필수 기능

| # | 후보 | 특징 |
|---|------|------|
| 1 | uvicorn --reload | 코드 변경 시 자동 재시작 |
| 2 | ipython | `python -m IPython` 인터랙티브 디버깅·DB 조회 |
| 3 | rich | `RichHandler`로 콘솔 가독성 향상. structlog dev 모드 console renderer와 결합 |
| 4 | httpie / Bruno | CLI·GUI API 수동 테스트 |
| 5 | DBeaver / TablePlus / mycli | MySQL GUI·CLI 클라이언트 |
| 6 | n8n Desktop | n8n 로컬 GUI |

### 4.3 후보별 차이

- ipython — 표준 Python REPL에 없는 자동완성·매직 명령·히스토리를 제공한다.
- httpie / Bruno — FastAPI가 Swagger UI(`/docs`)로 인터랙티브 API 호출을 제공해 기능이 겹친다.
- n8n Desktop — n8n 인스턴스에 직접 접속하거나 workflow JSON export/import로도 workflow를 옮길 수 있다.

---

## 5. 후보 세부 정보

### 5.1 phonenumbers
- **장점**: Google libphonenumber 표준, KR 국가 코드 검증·형식 변환·휴대폰/유선 구분
- **단점**: 라이브러리 크기(~6 MB)
- **세부사항**: 라이선스 Apache 2.0. `phonenumbers.parse(value, "KR")` + `phonenumbers.is_valid_number()` + `phonenumbers.format_number(num, PhoneNumberFormat.<형식>)` (`E164`·`INTERNATIONAL`·`NATIONAL` 등)

### 5.2 ipython
- **장점**: 자동완성·매직 명령(`%timeit`·`%debug`·`%history`)·히스토리·풍부한 traceback
- **세부사항**: 라이선스 BSD

### 5.3 rich
- **장점**: 색상·박스·테이블·tracestack 가독성 매우 좋음. structlog 통합 사례 풍부
- **세부사항**: 라이선스 MIT

### 5.4 FastAPI Depends
- **장점**: FastAPI 표준, 함수 시그니처로 표현, 캐싱·sub-dependency
- **단점**: 도메인 코어에서는 사용 어려움 (테스트 시 우회 패턴 필요)

### 5.5 Pydantic DTO
- **장점**: Request/Response/내부 DTO 분리 명확, OpenAPI 자동 스키마
- **단점**: ORM 모델 ↔ DTO 매핑 작성량 — `model_validate(orm_obj, from_attributes=True)`로 최소화

---

## 6. 비교 요약 표

| 분류 | 후보 | 특징 |
|------|------|------|
| DI | FastAPI Depends | FastAPI 표준·함수 시그니처 |
| DI 컨테이너 | Dependency Injector / Punq / Lagom | 컨테이너형 / 생태계 작음 |
| 도메인 | Pydantic DTO | DTO 분리 명확 |
| PK ID | UUIDv4 | 표준 라이브러리·무작위 |
| ID 대안 | ULID / nanoid | 시간 순 정렬 / 짧은 URL 안전 ID |
| 시간 | datetime + zoneinfo | 표준 라이브러리 |
| 시간 대안 | pendulum / arrow | tz-aware 서드파티 |
| 로케일 | babel | CLDR 기반 표시 포맷 |
| 검증 | phonenumbers | libphonenumber·KR 검증·형식 변환 |
| 결제 | 쿠팡 직접 결제 | 카드 정보 미경유 |
| 결제 대안 | PG사 / Stripe | 국내 PG / 해외 결제 |
| 자동 재시작 | uvicorn --reload | 코드 변경 감지 |
| REPL | ipython | 자동완성·매직 명령 |
| 콘솔 | rich | structlog dev console 결합 |
| API 테스트 / DB 클라이언트 / n8n GUI | httpie·Bruno / DBeaver·TablePlus·mycli / n8n Desktop | CLI·GUI 개발 도구 |
