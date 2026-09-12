# 데이터 계층 (ORM·DB 드라이버·검증·데이터 처리)

> **카테고리**: 영속성·검증·직렬화·데이터 처리 후보 조사
> **연결 spec**: `docs/spec/09_service_design.md` §1, `docs/spec/08_schema.md`

---

## 0. 카테고리 구성

데이터 계층은 성격이 다른 3개 하위 카테고리로 구성된다. 각 카테고리는 독립 벤치마크를 적용한다.

| 하위 카테고리 | 후보 수 | 결정 항목 수 |
|------------|--------|------------|
| §1 ORM · DB 드라이버 · 마이그레이션 | 9 | 4 (ORM / async 드라이버 / sync 드라이버 / 마이그레이션) |
| §2 검증 · 직렬화 | 6 | 4 (DTO 검증 / 설정 로딩 / JSON 직렬화 / 멀티파트) |
| §3 데이터 처리 | 7 | 3 (DataFrame / 수치 / 날짜) |
| **통합 최종 결정** | — | §4 참조 (spec 반영) |

---

## 1. ORM · DB 드라이버 · 마이그레이션

### 1.1 전체 후보 목록

ORM 4개 + async 드라이버 2개 + sync 드라이버 2개 + 마이그레이션 1개 = **총 9개**.

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | SQLAlchemy 2.x (async) | ORM | Python 표준 |
| 2 | SQLModel | ORM | SQLAlchemy + Pydantic 통합 |
| 3 | Tortoise ORM | ORM | Django 스타일 |
| 4 | Piccolo | ORM | async-first + 관리자 UI |
| 5 | aiomysql | async 드라이버 | PyMySQL 베이스 |
| 6 | asyncmy | async 드라이버 | Cython |
| 7 | PyMySQL | sync 드라이버 | 순수 Python |
| 8 | mysqlclient | sync 드라이버 | C 기반 |
| 9 | Alembic | 마이그레이션 | SQLAlchemy 공식 |

### 1.2 1차 벤치마크 — 필수 기능

| # | 후보 | async | MySQL | 복합 JOIN | 스키마 진화 | FastAPI 통합 | 결과 |
|---|------|:-----:|:-----:|:--------:|:----------:|:-----------:|:----|
| 1 | SQLAlchemy 2.x async | O | O | ◎ | O(Alembic) | O | ✅ **통과 (ORM)** |
| 2 | SQLModel | O | O | △(복잡 관계 한계) | △(Alembic 일부) | ◎ | ⛔ |
| 3 | Tortoise ORM | O | O | △ | △(Aerich) | O | ⛔ |
| 4 | Piccolo | O | △(Postgres 우선) | △ | △ | △ | ⛔ |
| 5 | aiomysql | O | O | (드라이버 무관) | — | (간접) | ✅ **통과 (async 드라이버)** |
| 6 | asyncmy | O | O | (드라이버 무관) | — | (간접) | ✅ **통과 (보존 후보)** |
| 7 | PyMySQL | X(sync) | O | — | (Alembic 표준) | — | ✅ **통과 (sync 드라이버)** |
| 8 | mysqlclient | X(sync) | O | — | O | — | ⛔ |
| 9 | Alembic | (도구) | O | — | ◎ | — | ✅ **통과 (마이그레이션)** |

### 1.3 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| async/await | **필수** (운영 경로) | `02_app_server.md` §4.1 I/O bound — async ORM·드라이버 필수 |
| MySQL 지원 | **필수** | `09_service_design.md` §1 MySQL 확정 |
| 복합 JOIN·서브쿼리 | **필수** | `08_schema.md` 21개 테이블 + FIFO·집계 |
| FastAPI 통합 | 중요 | DI·Depends 패턴과 자연스럽게 결합 |
| 스키마 진화 도구 | **필수** | Alembic 또는 동등 |

**탈락 사유:**

- **#2 SQLModel** — Pydantic 통합은 매력적이나 복잡 관계(FIFO·다단계 JOIN)에서 SQLAlchemy 직접 사용 필요. 09_service_design.md DTO 분리 정책과도 충돌 가능 (DTO와 ORM 모델 동일 클래스가 강제됨).
- **#3 Tortoise ORM** — SQLAlchemy 대비 표현력·생태계 부족. 21개 테이블 운영에 부담.
- **#4 Piccolo** — MySQL 지원 제한적 (Postgres 우선). 본 프로젝트 부적합.
- **#8 mysqlclient** — C 기반 빠르지만 시스템 의존성(`libmysqlclient-dev`)으로 컨테이너 이미지 부피 증가. PyMySQL이 Alembic 스크립트 용도에 충분.

### 1.4 최종 선발

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **ORM** | **SQLAlchemy 2.x (async)** ✅ | §1.2 1차 벤치 5개 기능(async·MySQL·복합 JOIN·스키마 진화·FastAPI 통합) 모두 ◎ 통과. 21개 테이블 운영에 필요한 Core·ORM 분리·서브쿼리·CTE 지원. `AsyncSession` + eager/selectinload 패턴. `mysql+aiomysql://...` URL로 사용 |
| **async 드라이버** | **aiomysql** ✅ | SQLAlchemy 공식 권장. PyMySQL 베이스 순수 Python으로 빌드 의존성 0. 50매장 MVP I/O bound 트래픽에서 처리량 충분 (§1.5 asyncmy 보존 사유 참조) |
| **sync 드라이버** | **PyMySQL** ✅ | Alembic은 sync 드라이버 표준. 마이그레이션 스크립트 한정 (`mysql+pymysql://...`). 순수 Python으로 빌드 의존성 없음 (mysqlclient 탈락) |
| **마이그레이션** | **Alembic** ✅ | SQLAlchemy 메타데이터 기반 autogenerate, 양방향(up/down), branch·merge 지원. 21개 테이블 진화 관리에 표준. autogenerate가 컬럼 rename·ENUM 변경은 자동 인식 못해 수동 보정 룰 필요 |

### 1.5 보존 후보 (asyncmy)

asyncmy는 Cython으로 aiomysql 대비 2~3배 빠르나 다음 사유로 보존:
- 사주라 RPS 가정(MVP 50매장 · I/O bound)에서 드라이버 처리량은 병목 아님
- aiomysql이 SQLAlchemy 공식 권장·자료·호환성 우위
- 메모리 footprint 차이 무의미

**재평가 트리거:**

| 지표 | 임계치 |
|------|------|
| 평균 DB query 처리량 | ≥ 500 q/s (지속) |
| API p95 응답 중 DB 점유 | > 100 ms |
| aiomysql 활성 issue | 보안·호환성 미해결 30일 이상 |

→ 2개 이상 1주 지속 시 asyncmy 전환 검토.

---

## 2. 검증 · 직렬화

### 2.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | Pydantic v2 | DTO 검증·직렬화 | FastAPI 표준 |
| 2 | pydantic-settings | 설정 로딩 | Pydantic 분리 모듈 |
| 3 | orjson | JSON 직렬화 가속 | Rust |
| 4 | msgspec | 검증·직렬화 대안 | C 구현 |
| 5 | python-multipart | 멀티파트 업로드 | FastAPI 권장 |
| 6 | jsonschema | 외부 JSON 검증 | JSON Schema 표준 |

### 2.2 1차 벤치마크 — 필수 기능

| # | 후보 | DTO 검증 | OpenAPI 통합 | 설정 로딩 | JSON 가속 | 멀티파트 | 결과 |
|---|------|:-------:|:-----------:|:--------:|:--------:|:-------:|:----|
| 1 | Pydantic v2 | ◎ | ◎(FastAPI 표준) | △(별도) | △(orjson 결합) | — | ✅ **통과 (DTO 검증)** |
| 2 | pydantic-settings | — | — | ◎ | — | — | ✅ **통과 (설정 로딩)** |
| 3 | orjson | — | — | — | ◎ | — | ✅ **통과 (JSON 가속)** |
| 4 | msgspec | O | △(FastAPI 통합 미흡) | — | ◎ | — | ⛔ |
| 5 | python-multipart | — | — | — | — | ◎ | ✅ **통과 (멀티파트)** |
| 6 | jsonschema | O(외부) | — | — | — | — | ⛔ (Pydantic과 중복) |

### 2.3 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| Pydantic v2 DTO | **필수** | `07_api_spec.md` Request/Response 전체 + `01_web_framework.md` 1차 기준 |
| OpenAPI 통합 | **필수** | `07_api_spec.md` §10 Swagger 자동 문서화 |
| 설정 로딩 | **필수** | `.env`·환경변수 → 타입 안전 Settings |
| JSON 직렬화 가속 | 중요 | `13_performance.md` §1.1 일반 API ≤ 200 ms |
| 멀티파트 | **필수** | `POST /api/sales/upload` CSV |
| 외부 JSON Schema | 참고 | POS Canonical Schema → Pydantic 모델로도 가능 |

**탈락 사유:**

- **#4 msgspec** — Pydantic 대비 5~80배 빠르지만 FastAPI 통합이 미흡 (Litestar 우선). FastAPI 확정 환경에서 도입 시 보일러플레이트 증가.
- **#6 jsonschema** — 표준이지만 사주라는 외부 입력(POS·쿠팡)을 Pydantic 모델로 받아 검증하므로 역할 중복. 도입 비용 대비 가치 작음.

### 2.4 최종 선발

| 역할 | 선택 | 비고 |
|------|------|------|
| **DTO 검증·직렬화** | **Pydantic v2** ✅ | `model_validate` / `model_dump` / `field_validator`. FastAPI 자동 통합 |
| **설정 로딩** | **pydantic-settings** ✅ | `BaseSettings` + `.env`·환경변수·secrets 디렉터리 |
| **JSON 직렬화 가속** | **orjson** ✅ | `FastAPI(default_response_class=ORJSONResponse)`. 응답 직렬화 5~10배 가속 |
| **멀티파트** | **python-multipart** ✅ | `>=0.0.7`. CSV 업로드 스트리밍 |

---

## 3. 데이터 처리

### 3.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | pandas | DataFrame | Python 표준 |
| 2 | polars | DataFrame | Rust 멀티코어 |
| 3 | numpy | 수치 연산 | 백엔드 표준 |
| 4 | pyarrow | IO 백엔드 | Parquet·Arrow |
| 5 | openpyxl | Excel IO | .xlsx |
| 6 | pendulum / dateutil | 날짜·시간 | tz 처리 |
| 7 | Pint | 단위 변환 | kg↔g 등 |

### 3.2 1차 벤치마크 — 필수 기능

> CSV 업로드 가정: 주점 매장 일 영수증 30~200건 × 3개월 백필 = **약 9000건 / ~1 MB**. 메모리 부담 < 50 MB/업로드 (pandas 기준 3배 오버헤드 계산).

| # | 후보 | CSV 파싱 | 결측·집계 | 통계(IQR/Z) | 메모리 효율 | 자료·생태계 | 사주라 적합 | 결과 |
|---|------|:-------:|:--------:|:----------:|:----------:|:----------:|:----------:|:----|
| 1 | pandas | ◎ | ◎ | ◎ | △ | ◎ | ◎(수천~수만 행) | ✅ **통과 (DataFrame)** |
| 2 | polars | ◎ | ◎ | O | ◎ | △ | △(MVP 규모엔 과함) | ✅ **통과 (보존 후보)** |
| 3 | numpy | — | △ | ◎ | ◎ | ◎ | ◎(백엔드 표준) | ✅ **통과 (수치)** |
| 4 | pyarrow | △ | △ | X | ◎ | O | △ (사주라엔 사용 사례 없음 — MVP CSV 흐름 100% pandas) | ⛔ |
| 5 | openpyxl | X(.xlsx) | △ | X | △ | O | ⛔(spec에 Excel 업로드 없음 — CSV만) | ⛔ |
| 6 | pendulum | — | — | — | O | O | ⛔(표준 `datetime+zoneinfo`로 충분) | ⛔ |
| 7 | Pint | — | — | — | — | O | ⛔(kg↔g·L↔ml은 단순 곱셈으로 충분) | ⛔ |

### 3.3 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| CSV 파싱 (수천~수만 행) | **필수** | `POST /api/sales/upload`, `04_feature_spec.md` §4.2 CSVAdapter |
| 결측·집계 | **필수** | 기간별 매출 집계, ROI |
| IQR/Z-score 통계 | **필수** | `11_ai_spec.md` 이상치 탐지 |
| 메모리 효율 | 중요 | M2 Pro 16GB · 워커 4개 동시 업로드 시도 시 |
| 자료·생태계 | 중요 | 1인 운영 디버깅 자료 |
| Excel 지원 | 참고 | 현 spec엔 CSV만 |

**탈락 사유:**

- **#4 pyarrow** — Parquet IO가 강점이나 사주라 MVP는 CSV/JSON만 사용. 도입 사례 없음.
- **#5 openpyxl** — `07_api_spec.md` `POST /api/sales/upload`는 CSV만 명시. .xlsx 업로드 요구사항 없음. 추후 요구 발생 시 추가.
- **#6 pendulum** — `07_api_spec.md` 시간 필드는 UTC ISO 8601(`2026-05-06T01:00:00Z`)로 통일. 표준 `datetime + zoneinfo`(Python 3.9+)로 충분. pendulum 도입 시 표준 datetime과 혼용 관리 비용 발생.
- **#7 Pint** — kg↔g(1000배), L↔ml(1000배) 단위 변환은 단순 곱셈으로 충분. 라이브러리 도입은 과한 수준.

### 3.4 최종 선발

| 역할 | 선택 | 비고 |
|------|------|------|
| **DataFrame** | **pandas** ✅ | `pd.read_csv(chunksize, dtype)` + `groupby`·`rolling` |
| **수치 연산** | **numpy** ✅ | IQR/Z-score 계산. pandas 백엔드 |
| **날짜·시간** | 표준 `datetime + zoneinfo` ✅ | 별도 라이브러리 미사용 |

### 3.5 보존 후보 (polars)

polars는 Rust 멀티코어·메모리 효율 우위가 있으나 다음 사유로 보존:
- 사주라 MVP CSV 규모(~1 MB / ~9000 건)에선 pandas 메모리 부담 < 50 MB로 무의미
- 자료·생태계·numpy 통합 측면에서 pandas 우위
- 2단계(100매장 / CSV 단건 크기 증가) 시 재평가 가치 있음

**재평가 트리거:**

| 지표 | 임계치 |
|------|------|
| CSV 업로드 단건 행 수 | > 100,000 행 |
| 업로드 처리 메모리 | 워커당 > 500 MB |
| 업로드 처리 시간 | p95 > 10 초 |

→ 2개 이상 발생 시 polars 전환 검토.

---

## 4. 통합 최종 결정 (spec 반영용)

`09_service_design.md` §1에 추가될 항목:

| 라이브러리 | 역할 |
|----------|------|
| **Pydantic v2** | 모든 Request/Response DTO, 검증, OpenAPI 스키마 생성 |
| **pydantic-settings** | `.env`·환경변수·secrets 디렉터리 → 타입 안전 Settings |
| **orjson** | FastAPI 응답 JSON 직렬화 가속 (`default_response_class=ORJSONResponse`) |
| **python-multipart** | `POST /api/sales/upload` CSV 멀티파트 처리 |
| **PyMySQL** | Alembic 마이그레이션 스크립트용 sync MySQL 드라이버 (`mysql+pymysql://`) |
| **pandas** | CSV 파싱, 기간 집계, IQR/Z-score 이상치 탐지 |
| **numpy** | 통계 연산 (pandas/IQR 백엔드) |

> 사주라 BE 프레임워크 `FastAPI`는 본 카테고리 결정 대상 아님 — `01_web_framework.md` §4에서 결정. 본 카테고리 결정 7개(SQLAlchemy / aiomysql / PyMySQL / Alembic / Pydantic v2 / pydantic-settings / orjson / python-multipart / pandas / numpy)가 데이터 계층 라이브러리 일체를 구성한다.

---

## 5. 후보 세부 정보

### 5.1 SQLAlchemy 2.x (async) ✅
- **사용처**: 21개 테이블 ORM 매핑, Service 계층의 모든 DB CRUD/JOIN
- **장점**: Python ORM 표준, async/sync 동시 지원, Core·ORM 분리로 복잡 쿼리 가능, Alembic 자동 연동
- **단점**: 학습 곡선 가파름, async 사용 시 lazy-load 패턴 불가(eager·selectinload 필수)
- **세부사항**: 라이선스 MIT. 2.0부터 async 1급. `AsyncSession`·`asynccontextmanager` 패턴

### 5.2 aiomysql ✅
- **사용처**: SQLAlchemy async가 MySQL과 통신하는 드라이버
- **장점**: PyMySQL 베이스 순수 Python, 광범위 호환, SQLAlchemy 공식 권장
- **단점**: C 기반 대비 속도 열위, 유지보수 활동 보통
- **세부사항**: 라이선스 MIT. `mysql+aiomysql://...`

### 5.3 asyncmy 🟡 (보존)
- **사용처**: aiomysql 대안. Cython 기반 고성능 async MySQL 드라이버
- **장점**: aiomysql 대비 2~3배 빠름, SQLAlchemy 지원
- **단점**: aiomysql 대비 채택 적음, 호환성 검증 사례 적음
- **세부사항**: 라이선스 Apache 2.0. MySQL/MariaDB 모두

### 5.4 PyMySQL ✅ (Alembic 한정)
- **사용처**: sync MySQL 드라이버. Alembic 마이그레이션 스크립트·시드·임시 ETL
- **장점**: 순수 Python, 설치 간편, 광범위 호환
- **단점**: 동기. 운영 API 경로에는 부적합
- **세부사항**: 라이선스 MIT

### 5.5 Alembic ✅
- **사용처**: DB 스키마 마이그레이션 이력·자동 revision·CI 적용
- **장점**: SQLAlchemy 메타데이터 기반 autogenerate, 양방향, branch·merge 지원
- **단점**: autogenerate가 일부 변경(컬럼 rename, ENUM) 자동 인식 못함 → 수동 보정
- **세부사항**: 라이선스 MIT. `alembic.ini` + `env.py`

### 5.6 Pydantic v2 ✅
- **사용처**: 모든 Request/Response DTO, 설정, 비즈니스 입력 검증
- **장점**: Rust 코어(pydantic-core)로 v1 대비 5~50배 빠름, FastAPI·SQLModel·LangChain 표준, JSON Schema 자동 생성
- **단점**: v1→v2 마이그레이션 시 API 변경 큼, 동적 모델·custom validator 작성법 차이
- **세부사항**: 라이선스 MIT. `model_validate`·`model_dump`·`Field`·`field_validator`

### 5.7 pydantic-settings ✅
- **사용처**: `.env`·환경변수·secrets 디렉터리 로딩 → 타입 안전 Settings 클래스
- **장점**: Pydantic 모델로 환경설정 표현, validator 사용 가능, 다중 소스 지원
- **단점**: 비밀 회전(rotation) 등 동적 로딩에는 별도 패턴
- **세부사항**: 라이선스 MIT. v2부터 Pydantic 본체와 분리

### 5.8 orjson ✅
- **사용처**: FastAPI 응답 JSON 직렬화 (`default_response_class=ORJSONResponse`)
- **장점**: Rust 기반, datetime·UUID·numpy 직렬화 기본 지원, 메모리 효율
- **단점**: bytes 반환 → 일부 미들웨어와 호환 주의
- **세부사항**: 라이선스 Apache 2.0 / MIT. PyPI 휠 제공

### 5.9 python-multipart ✅
- **사용처**: FastAPI 파일·폼 업로드 (`POST /api/sales/upload`)
- **장점**: FastAPI 권장 의존성, 스트리밍 파싱
- **단점**: 대용량 멀티파트 시 메모리·디스크 정책 별도 설계
- **세부사항**: 라이선스 Apache 2.0. `>=0.0.7`

### 5.10 pandas ✅
- **사용처**: CSV 업로드 파싱, 기간별 매출 집계, IQR/Z-score 이상치 탐지, ROI 계산
- **장점**: 사실상 표준, 풍부한 자료·라이브러리, 결측·날짜 처리 강력
- **단점**: 메모리 사용량 큼(원본 3배 오버헤드), 단일 쓰레드, 수백만 행 부담
- **세부사항**: 라이선스 BSD. `pd.read_csv(chunksize=, dtype=)` 명시 권장

### 5.11 polars 🟡 (보존)
- **사용처**: pandas 대안. 대용량 CSV·시계열 처리
- **장점**: Rust 기반·멀티코어·lazy execution, 메모리 적음, Arrow 백엔드
- **단점**: pandas 자료 대비 적음, 일부 통계·시계열 API 차이
- **세부사항**: 라이선스 MIT

### 5.12 numpy ✅
- **사용처**: IQR/Z-score 통계 연산, pandas 백엔드
- **장점**: ndarray 기반 빠른 수치 연산, 사실상 표준
- **단점**: 자체 데이터 모델 없음 → DataFrame 결합 사용
- **세부사항**: 라이선스 BSD

### 5.13 탈락 후보 요약

| 후보 | 분류 | 탈락 사유 |
|------|------|---------|
| SQLModel | ORM | 복잡 관계 한계 + DTO 분리 정책 충돌 |
| Tortoise ORM | ORM | 표현력·생태계 부족 |
| Piccolo | ORM | MySQL 지원 약함 |
| mysqlclient | sync 드라이버 | 시스템 의존성·컨테이너 부피 |
| msgspec | 검증 | FastAPI 통합 미흡 |
| jsonschema | 검증 | Pydantic과 역할 중복 |
| pyarrow | 데이터 처리 | MVP 사용 사례 없음 |
| openpyxl | 데이터 처리 | spec에 Excel 업로드 없음 |
| pendulum / dateutil | 날짜 | 표준 datetime + zoneinfo로 충분 |
| Pint | 단위 변환 | 단순 곱셈으로 충분 |

---

## 6. 비교 표 (요약)

| 분류 | 후보 | 결과 | 핵심 사유 |
|------|------|------|---------|
| ORM | SQLAlchemy 2.x async | ✅ | 표준·표현력 |
| ORM | SQLModel | ⛔ | 복잡 관계·DTO 정책 충돌 |
| ORM | Tortoise / Piccolo | ⛔ | 표현력·MySQL 약함 |
| async 드라이버 | aiomysql | ✅ | 표준·호환·자료 |
| async 드라이버 | asyncmy | 🟡 보존 | 성능 우위, 채택 적음 |
| sync 드라이버 | PyMySQL | ✅ (Alembic 한정) | 순수 Python |
| sync 드라이버 | mysqlclient | ⛔ | 빌드 의존성 |
| 마이그레이션 | Alembic | ✅ | SQLAlchemy 표준 |
| DTO 검증 | Pydantic v2 | ✅ | FastAPI 표준·Rust 코어 |
| 설정 로딩 | pydantic-settings | ✅ | 타입 안전 |
| JSON 가속 | orjson | ✅ | 5~10배 가속 |
| 검증 대안 | msgspec | ⛔ | FastAPI 통합 미흡 |
| 멀티파트 | python-multipart | ✅ | FastAPI 권장 |
| 외부 JSON | jsonschema | ⛔ | Pydantic 중복 |
| DataFrame | pandas | ✅ | 표준·자료·MVP 규모 적합 |
| DataFrame | polars | 🟡 보존 | 메모리 우위, 자료 적음 |
| 수치 | numpy | ✅ | 표준 |
| IO 백엔드 | pyarrow | ⛔ | MVP 사용 사례 없음 |
| Excel | openpyxl | ⛔ | spec 없음 |
| 날짜 | datetime + zoneinfo | ✅ | 표준으로 충분 |
| 단위 변환 | Pint | ⛔ | 단순 곱셈 |
