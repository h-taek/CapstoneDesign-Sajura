# 보안 관련 외부 API — 미확인 사항

> **목적**: 보안 정책과 관련된 외부 API의 미확인 사실 조사
> **연결 spec**: `docs/spec/03_be.md`, `docs/spec/02_implementation_design.md` §3, `docs/spec/03_be.md`, `docs/spec/02_implementation_design.md` §4

---

## 1. 외부 API scope·rate limit — 미확인

아래 외부 API의 scope·rate limit은 외부 probe로 확인하지 않았다.

| 외부 API | 비고 |
|---------|------|
| POS사 (TossPlace·키움·OKPOS) scope·rate limit | 확인 항목은 `13_pos_adapter.md` §2 체크리스트 |
| 국세청 사업자 진위확인 rate limit | 공공데이터포털 정책 |
| 기상청·세담터·천문연·홍익대 학사일력 등 공공 API rate limit | — |
