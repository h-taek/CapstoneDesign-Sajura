# 사주라 프로젝트 — Claude 작업 지침

## 세션 시작 시 반드시 읽는다

1. `PROGRESS.md` — 프로젝트 공통 단계·정책 결정 이력
2. `PROGRESS_HT.md` — 담당자 본인 작업 이력 (DY·MY·CH는 각자 문서)
3. `HANDOFF.md` — 다음 작업 목록·컨텍스트·진입점
4. `docs/README.md` — 문서 폴더 구조, 파일별 역할, 작성 규칙

---

## 핵심 5규칙

1. **사실은 한 곳에만 정의** — `docs/README.md` §2 spec 목록에서 정의 위치를 확인하고 재기술하지 않는다
2. **한 파일 수정 시 연동 파일 즉시 함께 수정** — 연동 관계는 `docs/README.md` §2-1 연동 수정 파일 맵. "나중에" 없음
3. **세션 종료 전** 본인 `PROGRESS_*.md` §2 문서 수정 이력 갱신. 새 정책·방향 결정은 `PROGRESS.md` §3 표에 행 추가
4. **팀원이 직접 쓴 문서는 확인받고 고친다** — `docs/spec/11_ai_spec.md`, `docs/plan/ai/`, `docs/research/ai/`는 DY 저작이다. 임의로 고치지 않고 무엇을 왜 고쳐야 하는지 먼저 알린다
5. **main 전용 문서(PROGRESS 계열·docs/·루트 README·CLAUDE·AGENTS)는 main 기준으로 작업한다** — 작업 직전 `git checkout main && git fetch origin && git pull --ff-only origin main`. 담당자(h-taek)는 main 직접 푸시 가능하고, 끝나면 `dev`로 백머지한다. 워크트리를 만들지 않는다

---

## 작업 방식

- AI가 먼저 항목을 제안하고 담당자가 확정한다
- 확정된 내용은 즉시 문서에 반영한다
- 제안 시 추가·제외 추천 항목을 함께 제시한다
- AI spec(`docs/spec/11_ai_spec.md`) 작업은 DY 영역이다. 손대기 전에 확인받는다
- 저장소가 iCloud Drive 안이라 브랜치를 연속 체크아웃하면 " 2" 중복 파일이 쏟아진다. 생기면 `git clean -fd`로 정리한다(`-x` 금지)

---

## 파일별 역할 한 줄 요약

→ `docs/README.md` §1 참고
