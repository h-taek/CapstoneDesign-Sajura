# Phase 3 인증·온보딩 — BE

> 상위: [../plan_gantt.md](../plan_gantt.md) §2 Phase 3 / §4 `auth_be`·`auth_test`
> Day: 12~21 (선행: `inf`)

## 마일스톤

| ID | 마일스톤 | 산출물 | 검증 |
|---|---|---|---|
| M3.B1 | AuthService 구현 | Authlib OAuth(카카오·구글) + python-jose JWT + passlib[bcrypt] | OAuth 흐름 302 redirect + HttpOnly Cookie 발급 |
| M3.B2 | StoreService 구현 | 매장 조회·수정 + `stores.phone` phonenumbers NATIONAL 정규화 | `GET`·`PATCH /api/store` (api_spec §3) |
| M3.B3 | 국세청 사업자등록번호 검증 | 외부 API 어댑터 (httpx + tenacity + aiobreaker) | 유효·휴업·말소 분기 |
| M3.B4 | `POST /api/auth/logout-all` | 모든 디바이스 일괄 폐기 (PROGRESS.md §3 2026-05-16 강제 로그아웃) | refresh_token_blacklist Redis 저장 |
| M3.B5 | auth_test BE 측 | API 통합 테스트 (pytest + testcontainers + respx) | 12개 시나리오 통과 |
| M3.B6 | POS stub API (실연동 전 임시) | 자격증명 입력·연결 테스트 엔드포인트 stub (mock 200 응답) — 실연동은 M4.B1 | stub 호출 200 |
| M3.B7 | MenuService (phase_05 M5.B1에서 이동) | 레시피(재료·수량) + 소프트삭제(`deleted_at`) | CRUD + 레시피 연결 테스트 |
| M3.B8 | 사업자 검증 게이트 (NTS+등록증 업로드) | `POST /api/store/business/verify`(multipart, `StoreService.verify_business`) — NTS 통과 시 등록증 파일 서버 볼륨 저장 + `business_status=PENDING`. `stores.business_status` enum·`business_cert_path`·`business_reject_reason`·`business_reviewed_by` 컬럼 + `business_no`/매장필드 nullable 마이그레이션 + 마스터 코드→VERIFIED + `register`에서 business_no 제거(빈 매장 행) + me/login에 `business_status` | PENDING부터 온보딩 허용·미등록/휴폐업/형식 분기·마스터 통과·파일 검증 테스트 |
| M3.B9 | 관리자 심사 (최소) | `users.role`(OWNER/ADMIN) 컬럼 + `/api/admin/*` ADMIN 가드 + `AdminVerificationService`(list_pending·get_cert_file·approve·reject) + 등록증 파일 ADMIN 전용 스트리밍 | 비ADMIN 403·승인→VERIFIED·반려→REJECTED(+사유) 테스트. 종합 관리도구는 [후속] |

> **구현 결정 (plan-eng-review 후속)**
> - **PR 분할**: M3.B8(점주 측)=PR-A `feat/be-verify` → M3.B9(관리자 측)=PR-B `feat/be-admin`. 각 PR 작게·리뷰 가능하게. PR-A만으로 데모 흐름(PENDING→온보딩) 완성.
> - **0003 마이그레이션 = drop+add**: 0002의 `business_verified`(boolean)를 데이터 변환 없이 DROP하고 `business_status` enum·cert·role 신설. dev 한정·검증 데이터 없음 전제(운영 데이터 있으면 보존 변환 필요).
> - **등록증 파일 = 서버 볼륨**: `be` 컨테이너에 uploads 볼륨 신설(docker-compose). 현재 be는 볼륨이 없어 재빌드 시 파일 소실 → DB 경로와 불일치(깨진 링크) 방지 위해 필수. DB(mysql_data)는 경로만 보관.
> - **관리자 판별 = 매 요청 DB 조회**: `role`을 JWT에 넣지 않고 `/api/admin/*` 진입 시 DB에서 조회. 역할 변경 즉시 반영, 관리자 트래픽 적어 부담 없음.

## 외부 의존

- FE: `auth_fe` 완료 시 Phase 통합 종료(M3) 가능
- 카카오·구글 OAuth 개발 앱 등록 필요
- POS API 명세 조사 진행 중 (`docs/research/backend/13_pos_adapter.md` 위임) — 실연동은 M4.B1

## 참조

- [04_feature_spec.md §1.1 OAuth 흐름](../../spec/04_feature_spec.md)
- [07_api_spec.md §2 auth](../../spec/07_api_spec.md)
- [06_sequence.md §2 OAuth](../../spec/06_sequence.md)

## Phase 통합 종료 조건 (M3)

`auth_test` 통과 (BE·FE 양쪽 끝남) → **데모 시나리오 Step 1·2 동작** (로그인 + 온보딩)

**데모 시드:** 카카오·구글 OAuth 데모 앱(만료일 확인), 데모 매장 1건·POS 더미 자격증명·메뉴 5건 등록 fixture
