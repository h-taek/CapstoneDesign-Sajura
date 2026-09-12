# POS 어댑터 — API 연동 조사

> **상태**: MVP 범위 외 — 2단계 진입 시 작업 (`03_mvp_scope.md` §4)
> **목적**: 2단계 POS API 연동(TossPlace·키움페이·OKPOS) 진입 시 사용할 조사 체크리스트와 spec 반영 절차 정의. 본 문서의 모든 미확정 항목은 외부 POS사 API 문서·자격증명 확보가 필요한 **probe 의존 정보**이므로 본 단계에선 결정하지 않는다.
> **연결 spec**: `docs/spec/04_feature_spec.md` §4.2·§4.3, `docs/spec/03_mvp_scope.md` §4

---

## 0. MVP 범위와 본 문서의 위치

| 항목 | 상태 |
|------|------|
| MVP (1단계) — CSV 업로드 | ✅ — `04_feature_spec.md` §4.1·§4.4·`CSVAdapter` |
| 2단계 — POS API 연동 (TossPlace·키움페이·OKPOS) | 🟡 본 문서 영역 — 외부 POS사 자격증명·API 문서 확보가 선행되어야 결정 가능 |

> 본 문서의 모든 항목은 **외부 probe 의존**이다. POS사 영업 채널·API 문서·테스트 환경·자격증명 발급 절차가 없으면 결정 불가. MVP 진입 단계에서는 본 문서를 갱신하지 않는다.

---

## 1. 지원 대상 POS사

`04_feature_spec.md` §4.2 spec 확정.

| POS사 | 어댑터 클래스 | MVP 진입 |
|------|------------|--------|
| TossPlace | `TossPlaceAdapter` | 2단계 |
| 키움페이 | `KiwoomAdapter` | 2단계 |
| OKPOS | `OKPOSAdapter` | 2단계 |

> CSV 업로드용 `CSVAdapter`는 MVP에 포함 — 본 문서와 무관.

---

## 2. 2단계 진입 시 조사할 항목 (probe 체크리스트)

각 POS사에 대해 다음을 확인한다. 모든 항목이 채워지지 않으면 어댑터 구현 불가.

### 2.1 인증 / 자격증명

| 확인 항목 | 비고 |
|---------|------|
| 인증 방식 | API Key / OAuth 2.0 / 매장 코드+비밀번호 / 클라이언트 인증서 등 |
| 자격증명 필드 구조 | `pos_connections.api_key` 단일 컬럼으로 충분한가, 추가 컬럼이 필요한가 |
| 자격증명 발급 절차 | 점주 직접 발급 가능 / 영업팀 경유 필수 / 가맹점 신청 필요 |
| 갱신 주기 | 토큰 만료·자격증명 회전 정책 |
| 테스트 환경 (Sandbox) | 별도 SDK·DSN 제공 여부 |

### 2.2 데이터 수집 방식

| 확인 항목 | 비고 |
|---------|------|
| Webhook 지원 | 실시간 결제 이벤트 push 가능 여부 |
| Polling 주기 | 가능 / 최소 간격 / Rate limit |
| 백필 범위 | 과거 N개월 조회 가능 / 일별 / 월별 |
| 응답 포맷 | JSON / XML 등 |
| 에러 응답 표준 | HTTP 상태 코드 + 코드 매핑 |

### 2.3 공통 스키마 매핑

`04_feature_spec.md` §4.5 사주라 공통 스키마(이미 확정)에 매핑 시 다음을 확인.

| 확인 항목 | 비고 |
|---------|------|
| 메뉴 매핑 단위 | POS의 상품 ID·SKU vs 사주라 `menu_name` |
| 메뉴명 변형 처리 | 공백·대소문자·POS사 표기 차이 |
| 결제 취소·환불 이벤트 | 별도 이벤트 / 음수 amount / soft delete |
| 외부 영수증 ID | `sale_records.external_sale_id` 매핑 — 중복 방지 정책 (`08_schema.md` §4 UNIQUE) |
| 시간대 처리 | POS사 응답이 KST vs UTC — `04_data_layer.md` §3.4 UTC 저장 정합 |

### 2.4 운영 고려사항

| 확인 항목 | 비고 |
|---------|------|
| 약관 / SLA | API 사용 제한·서비스 보장 수준 |
| 비용 | 호출당 비용 / 월정액 / 무료 한도 |
| 데이터 소유권 | 매장 데이터에 대한 POS사 정책 |
| 한국 개인정보보호법 | API 응답에 포함된 개인정보(이름·전화번호 등) 처리 |

---

## 3. 확정 절차 (2단계 진입 시)

각 POS사 어댑터를 1개씩 다음 절차로 처리한다:

1. **외부 정보 확보** — §2 체크리스트 일체 응답 확보
2. **schema 영향 결정**
   - `pos_connections` 테이블에 추가 컬럼 필요한지 (예: `client_id`, `merchant_code` 등) → 필요 시 `08_schema.md` §3.4에 spec 반영
   - 자격증명 추가 컬럼 암호화 정책 → `12_security.md` §4.1 AES-256-GCM 대상 확장
3. **어댑터 인터페이스 결정** — `PosService` 메서드 시그니처 / `04_feature_spec.md` §4.2 어댑터 구조 일관성
4. **API 어댑터 동작 명세** — Webhook 등록·Polling 스케줄·재시도 정책 → `09_service_design.md` 어댑터 운영 흐름
5. **테스트 전략** — Sandbox 환경으로 통합 테스트 (`09_testing_quality.md` §1.4 testcontainers-python으로는 POS사 외부 의존이라 부적합 → respx mock 또는 Sandbox 사용)

---

## 4. 본 문서를 갱신하는 시점

| 시점 | 동작 |
|------|------|
| MVP 운영 중 | 본 문서 갱신하지 않음 — 외부 정보 확보 시까지 보류 |
| 2단계 진입 결정 | 각 POS사 §2 체크리스트 응답을 §3.1~§3.3 절(신규)로 채움. 확정 사항은 즉시 spec(schema·feature_spec·service_design) 반영 후 본 문서에서 "확정 → spec 참조"로 갱신 |
| 운영 중 POS사 API 변경 | 어댑터 영향 분석 후 spec 갱신, 본 문서엔 변경 이력만 기록 |
