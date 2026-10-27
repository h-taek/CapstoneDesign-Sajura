# 패키지 매니저·빌드·배포·CI

> **카테고리**: JS 패키지 매니저, Node 버전, FE 빌드 산출물 배포 방식, 환경변수 주입 방식 비교
> **연결 spec**: `03_be.md` §1 GitHub Actions (BE CI)·§15 운영 토폴로지 (Caddy 정적 서빙), `02_implementation_design.md` §1.3 (PWA 산출 → Caddy)
> **연결 backend research**: `docs/research/backend/10_deployment.md` (BE Docker·Compose·CI 비교)

---

## 1. 패키지 매니저

### 1.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | pnpm 9.x | content-addressable | disk 효율, monorepo 친화 |
| 2 | npm 10 | 표준 | Node 동봉 |
| 3 | bun 1.x | all-in-one | 빠름, Node 호환 진행 중 |
| 4 | yarn 4 (berry) | PnP 또는 node-modules | 활발 |

### 1.2 1차 벤치마크 — 필수 기능

| # | 후보 | install 속도 | disk 효율 | lockfile 표준 | TS·ESM 호환 | CI 캐시 | 운영 단순성 |
|---|------|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | pnpm 9.x | ◎ | ◎ (content-addressable) | ◎ (`pnpm-lock.yaml`) | ◎ | ◎ | ◎ |
| 2 | npm 10 | △ | △ | ◎ (`package-lock.json`) | ◎ | O | ◎ |
| 3 | bun 1.x | ◎ | O | O (`bun.lockb` 바이너리) | O (호환 진행) | O | △ (네이티브 의존성 호환 검증 진행) |
| 4 | yarn 4 | O | O | O (`yarn.lock`) | ◎ | O | △ (PnP 멘탈 모델·node-modules 모드 분리 필요) |

### 1.3 후보별 차이

- npm 10 — Node에 동봉돼 별도 설치가 필요 없다.
- bun — 일부 네이티브 의존성·도구(Vitest·Playwright)와의 호환 검증이 진행 중이다.
- yarn 4 — PnP 모드와 node-modules 모드가 나뉘고, PnP 모드는 별도 학습이 필요하다.

---

## 2. Node 버전

### 2.1 후보

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | Node 22 LTS | 활성 LTS | 2024-10 LTS, 2027-04 EOL |
| 2 | Node 20 LTS | 유지 LTS | 2026-04 EOL |
| 3 | Node 18 LTS | EOL 임박 | 2025-04 EOL |

---

## 3. FE 빌드 산출 배포

### 3.1 후보 옵션

| # | 옵션 | 방식 | 특징 |
|---|------|------|------|
| A | Caddy 이미지 자체 빌드 + FE `dist/` COPY | `Dockerfile`에서 `caddy:alpine` + `COPY dist /var/www/pwa` | 이미지 단위로 배포·롤백한다. 운영 호스트 파일 시스템에 의존하지 않는다 |
| B | Caddy 공식 이미지 + 호스트 volume `dist/` 마운트 | `docker-compose.yml` `volumes: - ./dist:/var/www/pwa:ro` | 호스트 파일 시스템에 의존한다. 롤백 시 dist 폴더를 따로 복원해야 한다 |
| C | 별도 nginx-fe 컨테이너 | Caddy는 BE 프록시만, fe-static은 nginx | 운영 컨테이너가 1개 늘어난다 |

---

## 4. 환경변수 주입

### 4.1 후보

| # | 옵션 | 방식 | 특징 |
|---|------|------|------|
| 1 | 빌드 시 `VITE_*` inline | Vite가 빌드 시점 환경변수를 JS에 inline | 환경마다 이미지를 따로 빌드한다 |
| 2 | 런타임 `window.__ENV__` 주입 | 진입 HTML에 `<script>` 1개로 환경변수 노출 | 이미지 하나를 여러 환경에서 쓴다 |

### 4.2 후보별 차이

- 번들에 inline된 값은 브라우저에 그대로 노출된다. Sentry DSN·VAPID 공개 키는 공개 값이라 secret이 아니다.

---

## 5. 후보 세부 정보

### 5.1 pnpm 9.x
- **장점**: content-addressable store·disk 효율·monorepo 대비·CI 캐시 친화
- **단점**: 사용자가 pnpm 미설치 시 별도 설치 (corepack 활용 가능)
- **세부사항**: MIT

### 5.2 Node 22 LTS
- **장점**: 활성 LTS·ESM·fetch·top-level await 표준
- **단점**: 일부 레거시 native 모듈은 18에 머무를 수 있음
- **세부사항**: MIT

### 5.3 Caddy 이미지 자체 빌드
- **장점**: 이미지 단위 atomic 배포·롤백 단순·CI 이미지 push 흐름과 같은 단위
- **단점**: Caddy 이미지 빌드 시간 추가 — `node:22-alpine` builder layer 캐시로 완화

### 5.4 빌드 시 `VITE_*` inline
- **장점**: 단순·SW precaching·CDN 캐시 친화 (런타임 fetch 없음)
- **단점**: 환경별 이미지 빌드

### 5.5 GitHub Actions
- **장점**: secret·cache·runtime 모두 표준
- **단점**: e2e 단계가 무거우면 PR 시간 증가

---

## 6. 비교 요약 표

| 분류 | 후보 | 특징 |
|------|------|------|
| 매니저 | pnpm 9.x | content-addressable·CI 캐시 |
| 매니저 | npm | Node 동봉 |
| 매니저 | bun / yarn | 네이티브 의존성 호환 검증 진행 / PnP 모드 별도 학습 |
| Node | 22 LTS | 활성 LTS·ESM·fetch |
| 배포 | Caddy 자체 빌드 + dist COPY | 이미지 단위 배포·롤백 |
| 배포 | 호스트 volume | 호스트 파일 시스템 의존·dist 별도 복원 |
| 배포 | 별도 nginx-fe | 컨테이너 1개 추가 |
| 환경변수 | 빌드 inline | 환경별 빌드·런타임 fetch 없음 |
| 환경변수 | 런타임 inject | 이미지 하나를 여러 환경에서 사용 |
| CI | GitHub Actions | secret·cache·runtime 표준 |
