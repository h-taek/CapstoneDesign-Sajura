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

### 5. 브랜치 전략

```
main                        배포/릴리즈 (보호됨, 직접 푸시 금지)
├── ai                      AI 서버 (독립 배포, be+fe와 합쳐지지 않음)
└── dev                     be+fe 통합 베이스
    ├── be                  백엔드 통합 스테이지
    │   └── feat/be-<name>  백엔드 피처
    └── fe                  프론트엔드 통합 스테이지
        └── feat/fe-<name>  프론트엔드 피처
```

**머지 흐름**
* be+fe: `feat/be-*` → `be` → `dev` → `main` (FE도 동일)
* AI: `ai` → `main` (별도 서버로 독립 배포되므로 `dev`와 합치지 않음)

**작업 규칙**
* 모든 be/fe 작업은 `feat/be-<name>` 또는 `feat/fe-<name>` 피처 브랜치에서 진행합니다. `main`, `dev`, `be`, `fe`에 직접 푸시하지 않습니다.
* 피처 브랜치는 해당 베이스(`be` 또는 `fe`)에서 따고, 완료되면 베이스로 PR을 올립니다.
* `be` / `fe` → `dev` 머지는 통합 검증이 끝난 시점에 진행합니다.
* `dev` → `main` 머지는 릴리즈 단위로만 진행합니다.
* AI 서버는 별도 배포 단위이므로 `ai` 브랜치에서 작업 후 `main`으로 직접 PR합니다. be+fe와는 HTTP API로만 연동됩니다.

**main 브랜치 보호 (GitHub)**
* 직접 푸시 금지, PR 필수 (승인 의무 없음).
* force push / 브랜치 삭제 차단.

**피처 브랜치 작업 예시**
```bash
git checkout be && git pull
git checkout -b feat/be-csv-upload
# 작업 후
git push -u origin feat/be-csv-upload
gh pr create --base be
```

**트랙 간 동기화 (be ↔ fe)**

be와 fe는 서로 진행 사항을 공유해야 하므로 아래 규칙을 따른다.

* **Contract-first**: BE는 `docs/spec/07_api_spec.md`(OpenAPI 계약)를 먼저 안정화한다. FE는 BE 완성 전이라도 `pnpm gen:api`로 타입 코드젠 + MSW mock으로 선행 개발한다.
* **be/fe → dev promote**: 마일스톤(Phase) 끝나면 `be` / `fe`를 즉시 `dev`로 promote PR한다. dev는 항상 양 트랙의 "최신 truth"가 된다.
* **dev → fe / dev → be back-merge**: 새 피처 브랜치를 따기 전 또는 매주 정기적으로 `git checkout fe && git merge origin/dev && git push`(또는 be)로 base를 최신화한다. 이후 따는 모든 `feat/*`는 자동으로 최신 상태에서 출발.
* **충돌 최소화**: 이미 진행 중인 `feat/*` 브랜치는 그대로 두고 마무리한 다음, 다음 피처부터 back-merge된 base에서 따는 것이 깔끔하다.

**문서 커밋 위치**

| 문서 종류 | 커밋 위치 | 비고 |
|---|---|---|
| `docs/spec/`, `docs/plan/`, `PROGRESS.md`, 루트 `README.md` | **`main` 전용** — admin은 직접 푸시, 그 외 팀원은 `docs/<주제>` 브랜치 → main PR | 모든 트랙이 즉시 참조. `main` 외 브랜치에서 직접 수정 금지 |
| `Back/README.md`, `Front/README.md`, `AI/README.md` 등 코드 옆 문서 | 해당 트랙(be/fe/ai) 브랜치에 코드와 함께 | 코드 변경과 한 쌍 |
| `HANDOFF.md` | 커밋 안 함 (`.gitignore`, 개인용) | — |

> 문서 변경을 BE/FE 피처 브랜치에 섞으면 머지 시 노이즈가 된다. 코드 옆 README가 아니라면 분리한다.

**main 전용 문서 운영 규칙 (충돌 방지)**

* `PROGRESS.md` · `docs/spec/*` · `docs/plan/*` · 루트 `README.md` 는 **오직 `main` 브랜치에서만 수정**한다. 다른 브랜치(`feat/*`, `be`, `fe`, `dev`, `ai`)에서 직접 수정하지 않는다.
* 단방향 정책(main → 다른 브랜치) 덕분에 back-merge 시 충돌 없이 fast-forward로 흡수된다.
* 본인 작업 파일은 `git merge main`을 해도 **사라지지 않는다**. merge는 추가지 교체가 아님. 한쪽에만 있는 파일은 양쪽 모두 보존된다.

**팀원별 main 변경 절차**

| 누구 | 절차 |
|---|---|
| Repo admin (htaeky) | (a) `git push origin main` 직접 (PR 생략) **또는** (b) PR 흐름 |
| 그 외 팀원 | **PR 흐름 필수** — `git checkout -b docs/<주제>` → 수정 → push → `gh pr create --base main` → 자기가 머지 (승인 의무 없음) |

> 팀원 PR은 base 브랜치 push 권한 없이도 가능하다. `docs/*` feature 브랜치는 누구나 push 가능(main만 보호).

**⚠️ 문서 작업 시작 전 필수 절차 — 최신 main 동기화**

main 전용 문서(`PROGRESS.md` · `docs/spec/*` · `docs/plan/*` · 루트 `README.md` · `CLAUDE.md` · `AGENTS.md`)를 수정하기 전에는 **항상 최신 `origin/main`을 먼저 받아온 다음** 작업한다. 이를 어기면 다른 팀원/이전 세션의 변경분을 덮어쓰거나, 머지 시 불필요한 충돌이 발생한다.

| 단계 | 명령 |
|---|---|
| 1. main 체크아웃 + 최신화 | `git checkout main && git fetch origin && git pull --ff-only origin main` |
| 2. (admin 직접 푸시) 그 자리에서 수정 → 커밋 → `git push origin main` | — |
| 2. (팀원 PR 흐름) 최신 main에서 작업 브랜치 분기 | `git checkout -b docs/<주제>` → 수정 → push → `gh pr create --base main` → 머지 |
| 3. 머지 후 모든 장수 브랜치에 main을 back-merge하여 정합 | `git checkout <be|fe|dev|ai> && git merge origin/main && git push` |

> **순서 절대 금지**: 옛 main 상태에서 수정 → 커밋 → push 시도 → 충돌/거부. 항상 "1. 최신 main 받기 → 2. 수정"의 순서를 지킨다. AI 에이전트(Claude·Codex 등)도 이 규칙을 따른다 — `CLAUDE.md` · `AGENTS.md` 참고.

**작업 상황 실시간 공유는 git/PR**

* `PROGRESS.md` 는 **마일스톤 종료 후 정리되는 역사 기록**(왜 그렇게 했나) — 실시간 작업 공유 도구가 아니다.
* "누가 지금 뭐 하고 있나"는 `gh pr list`, 브랜치 그래프(`git log --all --oneline --graph`), Notion Gantt로 확인.
* PROGRESS는 Phase 종료 / 정책 결정 / audit 시점에만 차수 단위로 추가한다.

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
