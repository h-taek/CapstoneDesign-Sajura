# Phase 3 인증·온보딩 — FE

> 상위: [../plan_gantt.md](../plan_gantt.md) §2 Phase 3 / §4 `auth_fe`·`auth_test`
> Day: 12~21 (선행: `inf`)

## 마일스톤

| ID | 마일스톤 | 산출물 | 검증 |
|---|---|---|---|
| M3.F1 | 로그인 화면 | `routes/login.tsx` (카카오·구글 OAuth 버튼 → BE 인가 URL redirect) | OAuth 흐름 302 통과 |
| M3.F2 | OAuth callback 처리 | 첫 진입 시 `POST /api/auth/refresh` 호출 → Zustand 메모리 저장 | Access Token 메모리만 저장(persist 금지) |
| M3.F3 | 온보딩 1스텝 — 매장 기본정보 | React Hook Form + zod 스키마 + phonenumbers 마스크 | 유효성 검증 통과 |
| M3.F4 | 온보딩 2스텝 — POS 연동 | POS 종류 선택 + 자격증명 입력 | 화면 흐름 진행 가능 (BE M3.B6 stub 200 응답) |
| M3.F5 | 온보딩 3스텝 — 메뉴 등록 | 메뉴·레시피 폼 (동적 배열) | 5개 메뉴 등록 통과 |
| M3.F6 | 온보딩 4스텝 — 확인·완료 | 요약 표시 + 제출 → 메인 화면 | end-to-end 1회 통과 |
| M3.F7 | auth_test FE 측 | Playwright E2E (로그인 → 온보딩 4스텝 → 메인) | 시나리오 1회 통과 |
| M3.F8 | **자체 로그인·회원가입 화면** | `routes/register.tsx` 신설(`POST /api/auth/register` — email·password·name만) + `routes/login.tsx`에 이메일/비밀번호 폼 병치(`POST /api/auth/login`) + `schemas/auth.ts` | 이메일/비밀번호로 회원가입 → 로그인 → 사업자 검증 진입 통과 |
| M3.F9 | **사업자 검증 화면 (온보딩 게이트)** | `routes/verify-business.tsx` 신설(사업자번호 입력·마스크 + 사업자등록증 파일 업로드, `POST /api/store/business/verify` multipart) + 가드를 `business_status`(UNVERIFIED·REJECTED→`/verify-business`, PENDING·VERIFIED→온보딩 허용)로 전환 + 미등록/휴폐업/반려 사유 분기 | 미검증 온보딩 차단 + 업로드→PENDING→온보딩 진입 E2E |
| M3.F10 | **관리자 심사 화면 (최소)** | `routes/admin/verifications.tsx` 신설(PENDING 목록·등록증 미리보기·승인/반려) + `role=ADMIN` 가드 + `/api/admin/*` 연동 | 비ADMIN 접근 차단 + 승인/반려 후 목록 갱신 E2E. 종합 관리도구는 [후속] |

> **M3.F8·F9·F10 사유**: 사업자 검증을 회원가입에서 분리해 **온보딩 진입 전 독립 게이트(`/verify-business`)**로 두고, NTS 자동 조회 + 사업자등록증 업로드 + 관리자 승인(`/admin`) 2단계로 소유권까지 확인 — 소셜·이메일 공통. PENDING부터 온보딩 허용(1-B). 상세: `04_feature_spec.md` §1.4, `07_api_spec.md` §3, `12_security.md` §2.4·§4.2·§5.1.
>
> **구현 순서 (plan-eng-review 후속)**: M3.F8·F9(점주 측)=PR-A 먼저, M3.F10(관리자 화면)=PR-B 나중. BE PR-A/PR-B와 짝. F9 가드는 `business_status` 4값 기준으로 전환.

## 외부 의존

- BE: `auth_be` 완료 (M3.B1~M3.B3) 후 화면 통합 가능

## 참조

- [10_frontend_design.md §3 인증·라우팅](../../spec/10_frontend_design.md)
- [PROGRESS.md §3 2026-05-16 18차 A-4 OAuth callback 302 redirect](../../../PROGRESS.md)

## Phase 통합 종료 조건 (M3)

`auth_test` 통과 → **데모 시나리오 Step 1·2 동작** (로그인 + 온보딩)
