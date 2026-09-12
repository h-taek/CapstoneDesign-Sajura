# 보안 정책 — 미확정 항목 정리

> **목적**: `12_security.md` §206에서 본 문서로 이관된 보안 정책 미확정 항목의 결정·종결·보류·외부 의존 처리.
> **연결 spec**: `docs/spec/12_security.md`, `docs/spec/07_api_spec.md`, `docs/spec/09_service_design.md`, `docs/spec/08_schema.md`

---

## 0. 처리 결과 요약

| 항목 | 결과 | 위치 |
|------|------|------|
| §1 개인정보 수집 | **종결** (1차 spec 정의 충분, 법적 검토는 약관 작성 단계) | 본 문서 §1 |
| §2 RBAC 매트릭스 | **종결** — MVP 단일 역할(점주). 직원·관리자 매트릭스는 2단계 이후 그때 설계 | 본 문서 §2 |
| §3 감사 로그 정책 | **결정 → spec 반영** (보관 1년·조회 권한·무결성) | 본 문서 §3, `12_security.md` §5.3 |
| §4 AES-256 적용 대상 확장 | **현 상태 유지** (`pos_connections.api_key`·`refresh_tokens.token_hash` 외 추가 없음) — 쿠팡 자격증명은 §4-A 별도 보류 | 본 문서 §4 |
| §4-A 쿠팡 자격증명 보관 정책 | **검증까지 보류** — (E) 점주 브라우저 게스트 장바구니 방식 우선 → (C) 세션 쿠키 → 다른 방향 단계적 fallback | 본 문서 §4-A |
| §5 외부 API scope·rate limit | **외부 probe 의존 보류** (POS → `13`·공공 API → AI 영역) | 본 문서 §5 |
| §6 토큰 정책 — 다중 디바이스 | **결정 → spec 반영** (각 디바이스 자체 토큰 자연 동작 명시) | 본 문서 §6.1, `12_security.md` §2.3 |
| §6 토큰 정책 — 강제 로그아웃(모든 디바이스) | **결정 → spec 반영** (옵션 A 채택, 신규 endpoint·메서드) | 본 문서 §6.2, `12_security.md` §2.3·`07_api_spec.md` §2·`09_service_design.md` §4 |
| §7 OrderApprovalLog 스키마 | **종결** (기존 spec 정의 충분) | 본 문서 §7 |

---

## 1. 개인정보 수집 항목 — 종결

`12_security.md` §3.1에 회원가입·온보딩 필수 항목과 서비스 이용 중 수집 항목, 미수집 항목, 보유 기간이 모두 정의되어 있다. 추가 항목은 다음 시점에 갱신:

| 갱신 시점 | 처리 |
|---------|------|
| 약관 작성 시점 | 표준 개인정보처리방침 템플릿 대조 — 법률 검토 후 `12_security.md` §3 갱신 |
| 자체 결제 도입(2단계 이상) | PG사 연동 시 결제·환불 관련 추가 수집 항목 |

→ 본 audit 단계 결정 사항 없음.

---

## 2. RBAC 매트릭스 — MVP 단일 역할 종결

### 결정

| 단계 | 역할 | 처리 |
|------|------|------|
| MVP | 점주 단일 역할 | `12_security.md` §5.1 현 정의 유지 |
| 2단계 이후 | 직원·관리자(본사)·운영팀 추가 | 도입 시점에 사용자 피드백 기반 매트릭스 설계 |

### 사유

- 사주라 MVP는 **1매장-1점주** 구조 (`03_mvp_scope.md`)
- 직원·매니저·본사 권한이 실제로 어떻게 분배되어야 하는지는 운영 후 피드백이 더 정확
- 미리 표를 만들면 실제 필요와 어긋날 가능성 큼 → 그때 설계가 정확

> 본 결정은 `12_security.md` §5.1 "**추후 확장**" 표현을 그대로 유지하는 것으로 ratify.

---

## 3. 감사 로그 정책 — 결정 → spec 반영

`12_security.md` §5.3에 추적 대상 테이블 4개(`order_approval_logs`·`disposal_logs`·`inventory_lots`·`pipeline_jobs`)는 이미 정의됨. 본 audit에서 보관 기간·조회 권한·무결성을 결정.

### 결정

| 항목 | 결정 |
|------|------|
| 보관 기간 | **1년** (개인정보보호법 일반 권장 + 디스크 부담 적정) |
| 조회 권한 | `ops_readonly` 계정 (`08_schema.md` §5 정의) — VPN 경유 필수 |
| 무결성 보장 | **DB append-only (INSERT only) + 정기 백업**. 해시 체인 등 추가 무결성 메커니즘은 운영 부담 대비 가치 작음 — MVP 미적용 |
| 보관 기간 초과 데이터 | 매월 1회 배치로 1년 초과 행 archive(별도 cold storage 이전 또는 삭제) |

### spec 반영

`12_security.md` §5.3 감사 로그 표 아래에 본 정책을 추가 행으로 명시.

---

## 4. AES-256 적용 대상 — 현 상태 유지

### 결정

`12_security.md` §4.1 현재 2개 컬럼:
- `pos_connections.api_key` — AES-256-GCM
- `refresh_tokens.token_hash` — SHA-256 (단방향 해시)

**추가 확장 없음** — 본 audit 단계에서 새로운 AES-256-GCM 적용 대상 없음.

> 키 보관 방식은 `05_auth_security.md` §2.4 결정 ratify — 환경변수 + pydantic-settings. Vault는 매장 300+ 트리거 시 도입(`05_auth_security.md` §2.5).

---

## 4-A. 쿠팡 자격증명 보관 정책 — 단계적 fallback 보류

### 결정 — 검증까지 보류

쿠팡 장바구니 자동화(`04_feature_spec.md` §7) 시 점주의 쿠팡 자격증명을 사주라가 보관할 필요가 있는지 검토.

### 단계적 fallback

| 순위 | 옵션 | 의미 | 자격증명 보관 |
|------|------|------|:----------:|
| **1순위** | **(E) 점주 브라우저 게스트 장바구니** | BE가 쿠팡 상품 URL N개 생성 → Frontend가 점주 브라우저에서 열기 → 점주 브라우저에 게스트 장바구니 형성 → 점주가 쿠팡 로그인 시 자동 머지 | ⛔ 불필요 |
| 2순위 | (C) 세션 쿠키 저장 | 점주가 한 번 쿠팡 로그인 → 쿠키만 AES-256-GCM 저장. 만료 시 재로그인 | △ 쿠키만 |
| 3순위 | 미정 (재논의) | (E)·(C) 모두 불가 시 재논의 | ? |

### 검증 절차 (외부 probe 의존)

(E)의 가능 여부는 쿠팡 동작에 의존 — 본 audit 단계 결정 불가능.

| 검증 항목 | 비고 |
|---------|------|
| 쿠팡이 "URL 한 번 열면 게스트 장바구니에 자동 담기는" 직링크를 제공하는가 | 실제 쿠팡 동작 확인 (probe) |
| 직링크가 없다면 — 상품 페이지 새 탭 열기 + 점주가 "담기" 클릭하는 사용성 OK인가 | 사용자 검증 |
| 게스트 장바구니의 로그인 머지 동작 안정성·정책 변경 | 운영 중 모니터링 |

### Plan 단계 진입 시 처리

1. (E) 검증 — 가능하면 채택. `04_feature_spec.md` §7 흐름을 "점주 브라우저 게스트 장바구니" 패턴으로 갱신. Playwright는 단가 조회용으로만 유지(`06_external_integration.md` §2.4)
2. (E) 불가 시 (C) 채택 — `pos_connections`와 별도 `coupang_sessions` 테이블 또는 동등 구조. AES-256-GCM 적용 대상 확장 → `12_security.md` §4.1·`08_schema.md` 갱신
3. (E)·(C) 모두 불가 시 재논의 (사용자 결정)

> 현 단계 spec 영향: **없음** — 검증 결과에 따라 후속 변경.

---

## 5. 외부 API scope·rate limit — 외부 probe 의존 보류

| 외부 API | 처리 | 위치 |
|---------|------|------|
| POS사 (TossPlace·키움·OKPOS) scope·rate limit | 2단계 진입 시 — `13_pos_adapter.md` §2 체크리스트 일부 | 13 (2단계) |
| 국세청 사업자 진위확인 rate limit | 외부 공공데이터포털 정책 — Plan 단계 진입 전 확인 | 본 문서 §5 |
| 기상청·세담터·천문연·홍익대 학사일력 등 | 사용 결정 자체가 AI 영역 — 결정 후 확인 | AI 영역 |
| 자체 throttling | `09_testing_quality.md` §5.5 fastapi-limiter 정책 (login 5/min 등) ratify | 09 |

→ 본 audit 단계 결정 사항 없음.

---

## 6. 토큰 정책 — 결정 → spec 반영

### 6.1 다중 디바이스 로그인 — 결정

각 디바이스가 자체 Refresh Token을 발급받고 자체 Rotation 흐름을 유지하는 현 spec(`12_security.md` §2.3 + `08_schema.md` §3.2 `refresh_tokens`)이 자연 동작.

| 시나리오 | 동작 |
|---------|------|
| 점주가 PC + 모바일 동시 로그인 | 각 디바이스가 별도 `refresh_tokens` 행 보유 (user_id 동일·token_hash 다름) |
| 한 디바이스에서 Rotation 시 다른 디바이스 영향 | 영향 없음 — 각 디바이스 토큰은 독립 |
| 한 디바이스에서 로그아웃 | 그 디바이스의 `refresh_tokens` 행만 `is_revoked=1` |

> spec 변경 없음 — `12_security.md` §2.3에 본 동작 명시 보강.

### 6.2 강제 로그아웃 (모든 디바이스) — 옵션 A 채택

분실·도난·계정 도용 의심 시점주가 "모든 디바이스 로그아웃" 트리거.

| 동작 |
|------|
| `UPDATE refresh_tokens SET is_revoked=1 WHERE user_id=? AND is_revoked=0` 일괄 폐기 |
| Access Token은 서명 stateless이므로 자체 무효화 불가 — 만료(1시간)까지 유효. 보안 강도가 필요한 운영에선 향후 `12_security.md` §2.3 Hybrid Option B(Redis 블랙리스트) 검토 |
| 응답 후 점주는 모든 디바이스에서 다음 API 호출 시 401 → 재로그인 화면 |

### spec 반영 사항

| 파일 | 변경 |
|------|------|
| `12_security.md` §2.3 | 다중 디바이스 자연 동작 명시 + "모든 디바이스 로그아웃" 정책 추가 |
| `07_api_spec.md` §2 | `POST /api/auth/logout-all` endpoint 추가 |
| `09_service_design.md` §4 AuthService | `logout_all(user_id)` 메서드 추가 |

---

## 7. OrderApprovalLog 스키마 — 종결

`08_schema.md` §3.20 + `12_security.md` §5.3에 이미 정의 완료. 본 audit 단계 변경 사항 없음.

---

## 8. 결정 후 본 문서의 위치

- 본 audit 후 §3·§6은 spec에 반영되었다. 본 문서에서는 "결정 → spec 참조"로 표기 유지.
- §1·§2·§7은 종결 — 변경 없음.
- §4-A·§5는 외부 probe·검증 의존으로 보류. Plan 단계 진입 전 또는 운영 후 처리.
- 본 문서 §0 처리 결과 요약 표를 진입점으로 사용한다.
