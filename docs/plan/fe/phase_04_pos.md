# Phase 4 POS·데이터 적재 — FE

> 상위: [../plan_gantt.md](../plan_gantt.md) §2 Phase 4 / §4 `pos_fe`
> Day: 21~25 (선행: `auth_test`)

## 마일스톤

| ID | 마일스톤 | 산출물 | 검증 |
|---|---|---|---|
| M4.F1 | POS 연동 설정 화면 (CSV 액션 허브) | `routes/settings/pos.tsx` — **현재 연동 상태 표시(`GET /api/store/pos/status` `CSV_MODE`/`CONNECTED`/`ERROR`/`DISCONNECTED`) + CSV 템플릿 다운로드 버튼 + CSV 업로드 화면 진입 버튼**. 자격증명 입력·연결 테스트 UI는 **[2단계] POS API 연동 진입 시 추가** | 상태 4종 표시 + 템플릿 다운로드 200 + 업로드 화면 라우팅 동작 |
| M4.F2 | CSV 업로드 화면 | `routes/sales/upload.tsx` (드래그앤드롭 + 진행률 + 오류 행 표시) | 10만 행 업로드 성공 |
| M4.F3 | 업로드 결과 화면 | 성공·실패 행 수·이상치 감지 결과 표 | 시나리오 3종 통과 |

## 외부 의존

- BE: `pos_be` 완료 (M4.B1~M4.B3)

## 화면 책임 분리 (SSOT)

CSV 관련 액션은 **설정 화면(M4.F1) 한 곳에 모은다**. 중복·빈틈 방지.

| 화면 | 책임 |
|---|---|
| 온보딩 Step 2 | **모드 선택만** (CSV 모드 선택 시 자격증명 입력 생략 — PROGRESS 19차). CSV 안내·다운로드 X |
| M4.F1 설정 화면 | 연동 상태 + CSV 템플릿 다운로드 + 업로드 화면 진입 (CSV 액션 허브) |
| M4.F2 업로드 화면 | 실제 파일 업로드·진행률·오류 표시 (M4.F1에서 진입) |

> `04_feature_spec.md` §4.4의 "업로드 화면에서 템플릿 제공" 문구는 본 정합 후 **"설정 화면에서 다운로드 제공, 업로드 화면은 파일 업로드만 수행"**으로 SSOT 일원화 (PROGRESS 35차).

## 디자인 사전 합의 권장

- 업로드 결과 화면(M4.F3) 이상치 표시 영역은 AI 팀 이상치 탐지 방법(IQR/Z-score 등) 확정 전 디자인 고정 시 phase_12 hookup에서 갈아엎는 비용 발생
- placeholder만 잡아두고 실 표시 디자인은 M12 hookup 시 확정

## 참조

- [10_frontend_design.md §5 화면 구성](../../spec/10_frontend_design.md)
- [PROGRESS.md §3 2026-05-16 CSV-only MVP 정책](../../../PROGRESS.md)

## Phase 통합 종료 조건 (M4)

BE·FE 양쪽 완료 — CSV 업로드 → DB INSERT → 화면 표시 → **데모 시나리오 Step 3 동작**
