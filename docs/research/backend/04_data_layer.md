# 데이터 계층 (ORM·DB 드라이버·검증·데이터 처리)

> **카테고리**: 영속성·검증·직렬화·데이터 처리 후보 조사
> **연결 spec**: `docs/spec/03_be.md` §1, `docs/spec/02_implementation_design.md` §4

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

| # | 후보 | async | MySQL | 복합 JOIN | 스키마 진화 | FastAPI 통합 |
|---|------|:-----:|:-----:|:--------:|:----------:|:-----------:|
| 1 | SQLAlchemy 2.x async | O | O | ◎ | O(Alembic) | O |
| 2 | SQLModel | O | O | △(복잡 관계 한계) | △(Alembic 일부) | ◎ |
| 3 | Tortoise ORM | O | O | △ | △(Aerich) | O |
| 4 | Piccolo | O | △(Postgres 우선) | △ | △ | △ |
| 5 | aiomysql | O | O | (드라이버 무관) | — | (간접) |
| 6 | asyncmy | O | O | (드라이버 무관) | — | (간접) |
| 7 | PyMySQL | X(sync) | O | — | (Alembic 표준) | — |
| 8 | mysqlclient | X(sync) | O | — | O | — |
| 9 | Alembic | (도구) | O | — | ◎ | — |

### 1.3 후보별 차이

- SQLModel — DTO와 ORM 모델이 같은 클래스가 된다. 다단계 JOIN 같은 복잡 관계는 SQLAlchemy를 직접 써야 한다.
- Tortoise ORM — SQLAlchemy보다 표현력·생태계가 작다.
- Piccolo — Postgres 우선이며 MySQL 지원이 제한적이다.
- asyncmy — Cython 기반으로 aiomysql보다 2~3배 빠르다. aiomysql보다 채택·호환성 검증 사례가 적다.
- mysqlclient — C 기반으로 빠르지만 시스템 의존성(`libmysqlclient-dev`)이 필요해 컨테이너 이미지가 커진다.

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

| # | 후보 | DTO 검증 | OpenAPI 통합 | 설정 로딩 | JSON 가속 | 멀티파트 |
|---|------|:-------:|:-----------:|:--------:|:--------:|:-------:|
| 1 | Pydantic v2 | ◎ | ◎(FastAPI 표준) | △(별도) | △(orjson 결합) | — |
| 2 | pydantic-settings | — | — | ◎ | — | — |
| 3 | orjson | — | — | — | ◎ | — |
| 4 | msgspec | O | △(FastAPI 통합 미흡) | — | ◎ | — |
| 5 | python-multipart | — | — | — | — | ◎ |
| 6 | jsonschema | O(외부) | — | — | — | — |

### 2.3 후보별 차이

- msgspec — Pydantic보다 5~80배 빠르다. FastAPI 통합이 미흡하고 Litestar를 우선 지원한다.
- jsonschema — JSON Schema 표준 검증기다. Pydantic v2도 모델로 입력을 검증하고 JSON Schema를 생성한다.

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

| # | 후보 | CSV 파싱 | 결측·집계 | 통계(IQR/Z) | 메모리 효율 | 자료·생태계 |
|---|------|:-------:|:--------:|:----------:|:----------:|:----------:|
| 1 | pandas | ◎ | ◎ | ◎ | △ | ◎ |
| 2 | polars | ◎ | ◎ | O | ◎ | △ |
| 3 | numpy | — | △ | ◎ | ◎ | ◎ |
| 4 | pyarrow | △ | △ | X | ◎ | O |
| 5 | openpyxl | X(.xlsx) | △ | X | △ | O |
| 6 | pendulum | — | — | — | O | O |
| 7 | Pint | — | — | — | — | O |

### 3.3 후보별 차이

- polars — Rust 멀티코어·lazy execution으로 pandas보다 메모리를 적게 쓴다. 자료가 pandas보다 적고 일부 통계·시계열 API가 다르다.
- pyarrow — Parquet·Arrow IO 백엔드다. CSV 파싱·집계는 제한적이고 통계 기능은 없다.
- openpyxl — .xlsx 전용이며 CSV를 다루지 않는다.
- pendulum — tz 처리 라이브러리다. Python 3.9+ 표준 `datetime` + `zoneinfo`로도 시간대 변환이 된다. 표준 `datetime`과 함께 쓰면 두 타입이 섞인다.
- Pint — 단위 변환 라이브러리다. kg↔g, L↔ml은 1000배 곱셈이다.

---

## 4. 후보 세부 정보

### 4.1 SQLAlchemy 2.x (async)
- **장점**: Python ORM 표준, async/sync 동시 지원, Core·ORM 분리로 복잡 쿼리(서브쿼리·CTE) 가능, Alembic 자동 연동
- **단점**: 학습 곡선 가파름, async 사용 시 lazy-load 패턴 불가(eager·selectinload 필수)
- **세부사항**: 라이선스 MIT. 2.0부터 async 1급. `AsyncSession`·`asynccontextmanager` 패턴. async MySQL URL은 `mysql+aiomysql://...`

### 4.2 aiomysql
- **장점**: PyMySQL 베이스 순수 Python(빌드 의존성 없음), 광범위 호환, SQLAlchemy 공식 권장
- **단점**: C 기반 대비 속도 열위, 유지보수 활동 보통
- **세부사항**: 라이선스 MIT. `mysql+aiomysql://...`

### 4.3 asyncmy
- **장점**: Cython 기반, aiomysql 대비 2~3배 빠름, SQLAlchemy 지원
- **단점**: aiomysql 대비 채택 적음, 호환성 검증 사례 적음
- **세부사항**: 라이선스 Apache 2.0. MySQL/MariaDB 모두

### 4.4 PyMySQL
- **장점**: 순수 Python, 설치 간편, 광범위 호환. Alembic 마이그레이션의 표준 sync 드라이버
- **단점**: 동기 전용
- **세부사항**: 라이선스 MIT. `mysql+pymysql://...`

### 4.5 Alembic
- **장점**: SQLAlchemy 메타데이터 기반 autogenerate, 양방향(up/down), branch·merge 지원
- **단점**: autogenerate가 일부 변경(컬럼 rename, ENUM) 자동 인식 못함 → 수동 보정
- **세부사항**: 라이선스 MIT. `alembic.ini` + `env.py`

### 4.6 Pydantic v2
- **장점**: Rust 코어(pydantic-core)로 v1 대비 5~50배 빠름, FastAPI·SQLModel·LangChain 표준, JSON Schema 자동 생성
- **단점**: v1→v2 마이그레이션 시 API 변경 큼, 동적 모델·custom validator 작성법 차이
- **세부사항**: 라이선스 MIT. `model_validate`·`model_dump`·`Field`·`field_validator`

### 4.7 pydantic-settings
- **장점**: Pydantic 모델로 환경설정 표현(`BaseSettings`), validator 사용 가능, 다중 소스(`.env`·환경변수·secrets 디렉터리) 지원
- **단점**: 비밀 회전(rotation) 등 동적 로딩에는 별도 패턴
- **세부사항**: 라이선스 MIT. v2부터 Pydantic 본체와 분리

### 4.8 orjson
- **장점**: Rust 기반, 응답 직렬화 5~10배 가속, datetime·UUID·numpy 직렬화 기본 지원, 메모리 효율
- **단점**: bytes 반환 → 일부 미들웨어와 호환 주의
- **세부사항**: 라이선스 Apache 2.0 / MIT. PyPI 휠 제공. FastAPI는 `default_response_class=ORJSONResponse`로 기본 응답 클래스를 바꿀 수 있다

### 4.9 python-multipart
- **장점**: FastAPI 권장 의존성, 스트리밍 파싱
- **단점**: 대용량 멀티파트 시 메모리·디스크 정책 별도 설계
- **세부사항**: 라이선스 Apache 2.0

### 4.10 pandas
- **장점**: 사실상 표준, 풍부한 자료·라이브러리, 결측·날짜 처리 강력
- **단점**: 메모리 사용량 큼(원본 3배 오버헤드), 단일 쓰레드, 수백만 행 부담
- **세부사항**: 라이선스 BSD. `pd.read_csv`는 `chunksize`·`dtype` 인자를 받는다. `groupby`·`rolling` 제공

### 4.11 polars
- **장점**: Rust 기반·멀티코어·lazy execution, 메모리 적음, Arrow 백엔드
- **단점**: pandas 자료 대비 적음, 일부 통계·시계열 API 차이
- **세부사항**: 라이선스 MIT

### 4.12 numpy
- **장점**: ndarray 기반 빠른 수치 연산, 사실상 표준, pandas 백엔드
- **단점**: 자체 데이터 모델 없음 → DataFrame 결합 사용
- **세부사항**: 라이선스 BSD

---

## 5. 비교 요약 표

| 분류 | 후보 | 특징 |
|------|------|------|
| ORM | SQLAlchemy 2.x async | Core·ORM 분리·서브쿼리·CTE |
| ORM | SQLModel | DTO·ORM 동일 클래스·복잡 관계 한계 |
| ORM | Tortoise / Piccolo | 생태계 작음 / Postgres 우선 |
| async 드라이버 | aiomysql | 순수 Python·PyMySQL 베이스 |
| async 드라이버 | asyncmy | Cython·2~3배 빠름·채택 적음 |
| sync 드라이버 | PyMySQL | 순수 Python·Alembic 표준 |
| sync 드라이버 | mysqlclient | C 기반·시스템 의존성 |
| 마이그레이션 | Alembic | SQLAlchemy 메타데이터 autogenerate |
| DTO 검증 | Pydantic v2 | FastAPI 표준·Rust 코어 |
| 설정 로딩 | pydantic-settings | 타입 안전·다중 소스 |
| JSON 가속 | orjson | 5~10배 가속 |
| 검증 대안 | msgspec | 5~80배 빠름·FastAPI 통합 미흡 |
| 멀티파트 | python-multipart | FastAPI 권장·스트리밍 |
| 외부 JSON | jsonschema | JSON Schema 표준 |
| DataFrame | pandas | 표준·자료 풍부·3배 메모리 오버헤드 |
| DataFrame | polars | 멀티코어·메모리 적음·자료 적음 |
| 수치 | numpy | ndarray 표준 |
| IO 백엔드 | pyarrow | Parquet·Arrow |
| Excel | openpyxl | .xlsx 전용 |
| 날짜 | pendulum / dateutil | tz 처리 |
| 단위 변환 | Pint | 단위 변환 |
