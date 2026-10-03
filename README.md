# 사주라 (Sajura)

소상공인(카페 등)을 위한 AI 기반 수요예측·자동발주 솔루션.

---

## 빠른 안내

처음 프로젝트를 접하는 팀원은 아래 순서로 읽는다.

| 파일 | 용도 |
|------|------|
| `PROGRESS.md` | 전체 진행 단계·정책 결정 이력·문서 수정 이력 |
| `HANDOFF.md` | 다음 작업 목록·컨텍스트·진입점 |
| `docs/README.md` | 문서 폴더 구조·파일별 역할·작성 규칙 |
| `docs/spec/` | 설계 산출물 전체 (요구사항 ~ AI 파이프라인) |

---

## 개발 환경 규칙

### 1. 환경 변수 (.env)

* **절대 `.env` 파일을 GitHub에 커밋하거나 공유하지 마세요.** (`.gitignore`에 등록되어 있으나 강제 추가하지 않도록 주의합니다.)
* 데이터베이스 비밀번호, API 키 등 민감한 정보는 반드시 `.env` 파일에 작성하고 코드에 하드코딩하지 않습니다.
* 새로운 환경 변수가 추가되면 `.env.example`에도 변수명(값은 빈값 또는 예시)을 추가하여 커밋합니다.

### 2. 파이썬 가상환경 (venv)

* 로컬(글로벌) 환경에 패키지를 직접 설치하지 마세요.
* 항상 가상환경(`.venv`)을 생성하고 **활성화(activate)** 한 상태에서 개발합니다.
* `.venv/` 폴더는 GitHub에 커밋하지 않습니다.
* 새 라이브러리를 설치했다면 `pip freeze > requirements.txt` 후 커밋합니다.

### 3. 데이터베이스 및 Docker

* MySQL을 로컬에 직접 설치하지 말고 **Docker Compose** (`Back/Docker/DB/docker-compose.yml`)를 사용합니다.
* `init.sh`나 `Dockerfile`을 수정했다면 팀원에게 공유하고 `docker-compose up -d --build`로 함께 재빌드합니다.

### 4. 버전 관리 (Git)

* 캐시 파일(`__pycache__`), OS 임시 파일(`.DS_Store`), IDE 설정 파일(`.vscode/`) 등은 커밋하지 않습니다.
* 의도치 않은 파일이 `git status`에 뜨면 커밋 전 반드시 `.gitignore`에 먼저 등록합니다.

### 5. 브랜치 전략 — GitHub flow

```
main               항상 동작하는 상태. 배포 기준
└── <종류>/<이름>   짧은 작업 브랜치. 머지 후 자동 삭제
```

**흐름**
1. 최신 main에서 작업 브랜치를 딴다 — `git checkout main && git pull --ff-only origin main && git checkout -b feat/<이름>`
2. 작업 후 push하고 main으로 PR을 연다 — `gh pr create --base main`
3. 머지하면 GitHub이 작업 브랜치를 자동 삭제한다

**브랜치 이름** — `feat/`(기능), `fix/`(버그), `docs/`(문서), `chore/`(설정·의존성). 영역이 드러나게 쓴다(예: `feat/be-csv-upload`, `feat/ai-recommend`).

**main 변경 권한**

| 누구 | 방법 |
|---|---|
| 담당자(h-taek) | 직접 푸시 또는 PR |
| 그 외 팀원 | PR 필수 (승인 의무 없음, 본인이 머지) |

main 보호 설정: PR 필수(관리자 예외), force push·브랜치 삭제 차단.

**작업 규칙**
* 작업 브랜치는 짧게 유지한다. 길어지면 main을 자주 받아 충돌을 줄인다.
* 작업 시작 전 항상 최신 main을 받는다. 옛 main 위에서 고치면 다른 사람의 변경을 덮어쓴다. AI 에이전트도 같다 — `CLAUDE.md` · `AGENTS.md` 참고.
* 코드 옆 문서(`Back/README.md`, `Front/README.md`, `AI/README.md`)는 코드와 같은 PR에 넣는다.
* `PROGRESS*.md` · `docs/` · 루트 `README.md` · `CLAUDE.md` · `AGENTS.md`만 바꾸는 작업은 코드 PR에 섞지 않고 `docs/<주제>` 브랜치로 따로 올린다.
* `HANDOFF.md`는 커밋하지 않는다(`.gitignore`, 개인용).
* AI 서버는 별도 컨테이너로 배포하지만 브랜치 흐름은 같다. be·fe와는 HTTP API로만 연동한다.
* Contract-first: BE는 `docs/spec/07_api_spec.md` 계약을 먼저 안정화하고, FE는 `pnpm gen:api` 타입 코드젠 + MSW mock으로 선행 개발한다.

**작업 상황 공유**

* "누가 지금 뭐 하고 있나"는 `gh pr list`와 Notion Gantt로 확인한다.
* `PROGRESS.md`는 끝난 작업과 결정의 기록이다. 실시간 공유 도구가 아니다.

---

## 문서 관리

### 프로젝트 현황 및 작업 인수인계

* 전체 진행 단계, 작업 흐름, 정책 결정 이력, 문서 수정 이력 → **`PROGRESS.md`**
* 다음 세션 작업 목록과 컨텍스트 → **`HANDOFF.md`**
* 새로운 기술 결정·진행 방향 확정 시 → `PROGRESS.md` 섹션 3(정책 결정 이력)에 기록
* spec/ 문서 수정 시 → `PROGRESS.md` 섹션 4(문서 수정 이력)에 기록
* 작업 완료 시 → `HANDOFF.md` 해당 항목 체크 후 다음 작업으로 업데이트

### 문서 구조

```
docs/
├── spec/       설계 산출물 — 요구사항·기능·API·DB·백엔드·AI·흐름·비기능·MVP
├── research/   구현 전 기술 조사 및 레퍼런스 분석
├── plan/       구현 계획 (단계별 작업·순서·역할 분담)
└── README.md   문서 작성 규칙 전체 (파일별 역할, SSOT 원칙, 연동 파일 맵)
```

* 문서 작성·수정 전 반드시 **`docs/README.md`** 를 읽습니다.
* 확정된 사실만 `spec/`에 담습니다. 조사 중인 내용은 `research/`, 계획은 `plan/`에 둡니다.
* **핵심 원칙: 사실은 한 곳에만 정의한다** — 같은 내용을 두 문서에 따로 쓰지 않습니다.
* 한 문서를 수정하면 연동 문서를 즉시 함께 수정합니다 ("나중에 수정"은 거의 반드시 누락됩니다).
