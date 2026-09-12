# Phase 10 쿠팡 자동화 — BE

> 상위: [../plan_gantt.md](../plan_gantt.md) §2 Phase 10 / §4 `auto`
> Day: 42~49 (선행: `ord_be_skeleton`)

## 마일스톤

| ID | 마일스톤 | 산출물 | 검증 |
|---|---|---|---|
| M10.B1 | AutomationService (Playwright) | 쿠팡 로그인 → 장바구니 담기 → 주문서 작성 자동화 | 더미 계정 1회 실행 |
| M10.B2 | 자격증명 보관 | AES-256-GCM 암호화(`cryptography`) → DB `store_credentials`. **키 관리 정책: `spec/12_security.md` §4.1 (애플리케이션 레벨, env 비밀)** | 암복호화 unit test |
| M10.B3 | 자동화 결과 로깅 | `automation_logs` 테이블 INSERT + 실패 시 Slack 알림(운영자 모니터링 채널, 점주 알림 아님 — 점주에게는 M11.B3 인앱/이메일/Web Push로 통지) | 성공·실패 시나리오 각 1회 |

## 외부 의존

- **자격증명 검증 보류** (PROGRESS.md §3 2026-05-16): (E) → (C) 단계적 fallback 검토 필요
- 후속: `test_release` deps

## 참조

- [04_feature_spec.md §10 쿠팡 자동화](../../spec/04_feature_spec.md)
- [12_security.md §6 결제 — 사주라 미경유·미저장](../../spec/12_security.md)

## Phase 통합 종료 조건 (M10)

`auto` 완료 — **데모 시나리오 Step 9 동작** (쿠팡 자동주문)

**데모 시드:** 쿠팡 데모 계정(만료·차단 여부 시연 직전 확인), automation_logs 성공·실패 샘플 각 1건
