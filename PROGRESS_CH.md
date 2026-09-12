# 진행 이력 — 서창현 (CH)

> 담당: Backend + Frontend — 8월 리디자인·실데이터 연동
> 프로젝트 공통 단계·정책 결정은 [PROGRESS.md](PROGRESS.md)를 본다.
> 최신이 위로 온다(역시간순).

---

## 1. 개발 이력

### 매출 CSV 재업로드 11배 중복 적재 버그 진단·수정 (2026-08-17)

세종 AX 해커톤 본선 시연 준비 중 담당자가 인기메뉴 화면에서 소주 판매량이 비정상(약 8만 개)으로 표시되는 것을 발견 — 원본 POS CSV 4종 교차 검증으로 실제 소주 총 판매량이 8,984개(13.5개월)임을 먼저 확정하고 조사 착수.

**원인**: `sale_records`의 `UNIQUE(store_id, source, external_sale_id)` + `INSERT IGNORE` dedup 자체는 존재하나, `external_sale_id`가 nullable이고 MySQL UNIQUE 인덱스는 NULL끼리 서로 다른 값으로 취급 — 영수증번호 컬럼을 비워두면(FE `DEFAULT_COLUMNS.external_sale_id_column=""` 기본값) DB 레벨 중복 방지가 전혀 동작하지 않는다. 실서버 DB 진단 SQL로 확정: 매장 `a31dd30c-…`(칠야, 담당자 시연 계정)에 동일 CSV가 11회 재업로드되어 소주 8,984→98,824(정확히 11배), 매장 총 매출 192.4M→2,116M원으로 중복 적재됨.

**조치**:
1. 원격 DB 백업(영향받은 46,607행 mysqldump) 후 `(store_id, menu_id, sold_at)` 그룹 내 최소 `sale_id` 1건만 남기고 트랜잭션 내 정리 — 소주 8,984개로 정확히 복구, 매출은 원본 02파일(192,409,848원)과 8,000원(단일 in-file 중복행) 이내로 일치.
2. `Back/app/services/sale_service.py` `_insert_chunk` — `external_sale_id`가 None이면 `(menu_id, sold_at)` 기반 합성 식별자(`AGG:{menu_id}:{sold_at.isoformat()}`)를 만들어 기존 UNIQUE 제약·`INSERT IGNORE` 경로를 그대로 타도록 정규화(스키마 변경 없음, 청크 내·청크 간 중복 모두 방지). `Front/src/routes/sales/upload.tsx` 영수증번호 필드 힌트 문구 갱신.
3. 회귀 테스트 2종 추가(`Back/tests/sales_test.py`) — 영수증번호 없이 재업로드 시 dedup, 같은 파일 내 dedup. 원격 서버 pytest 38/38 통과.
4. 원격 배포 — SSH 세션 PATH에 `/usr/local/bin`이 빠져 있어 `docker-credential-osxkeychain`을 못 찾고 이미지 빌드가 막혔던 것을 `PATH=/usr/local/bin:$PATH`로 회피(자격증명 파일은 미변경)하여 `be` 재빌드·재시작.
5. 라이브 검증 — `SaleService.get_top_menus`/`get_summary`를 실 프로덕션 DB(칠야 매장)에 직접 호출해 소주 8,984개·매출 192,401,848원 확인.

**교훈**: nullable 컬럼을 포함한 UNIQUE 제약은 "NULL 다수 삽입" 경로에서 보호를 제공하지 못한다 — 식별자가 없는 입력은 반드시 별도의 non-null 합성 키로 정규화해야 DB 레벨 dedup이 실효를 가진다.

---


---

## 2. 문서 수정 이력

### 2026-08-17 — 매출 CSV 재업로드 11배 중복 적재 버그 진단·수정

세종 AX 해커톤 본선 시연 임박 상황에서 발견된 데이터 정합성 버그의 원인 진단·DB 정리·코드 픽스·배포·라이브 검증 전 과정 수행. 상세는 §4 "매출 CSV 재업로드 11배 중복 적재 버그 진단·수정" 참조. §3 정책 표에 "매출 CSV 재업로드 dedup 정책(2026-08-17)" 행 추가. 코드 변경: `Back/app/services/sale_service.py`(dedup 로직 + 모듈 docstring), `Back/tests/sales_test.py`(회귀 테스트 2종), `Front/src/routes/sales/upload.tsx`(안내 문구). 아직 git 커밋되지 않은 로컬 편집 상태 — 커밋·PR은 담당자 확인 후 별도 진행.
