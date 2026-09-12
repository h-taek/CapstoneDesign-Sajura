# 패키지 매니저·빌드·배포·CI

> **카테고리**: JS 패키지 매니저, Node 버전, FE 빌드 산출물 배포 방식, 환경변수 주입, CI/CD 파이프라인 결정
> **연결 spec**: `09_service_design.md` §1 GitHub Actions (BE CI)·§11 운영 토폴로지 (Caddy 정적 서빙), `03_mvp_scope.md` §3 (PWA 산출 → Caddy)
> **연결 backend research**: `docs/research/backend/10_deployment.md` (BE Docker·Compose·CI 결정)

---

## 0. 카테고리 구성 & 결정 항목

| 하위 카테고리 | 후보 수 | 결정 항목 수 |
|------------|--------|------------|
| §1 패키지 매니저 | 4 | 1 (pnpm) |
| §2 Node 버전 | 3 | 1 (Node 22 LTS) |
| §3 FE 빌드 산출 배포 | 3 옵션 | 1 (Caddy 이미지 자체 빌드 포함) |
| §4 환경변수 주입 | 2 | 1 (빌드 시 `VITE_*` inline) |
| §5 CI/CD | — | 1 (GitHub Actions 8단계) |
| §6 통합 결정 | — | §6 참조 |

### 본 research가 결정하는 항목

| 항목 | 결정 | 결정 근거 위치 |
|------|------|--------------|
| 패키지 매니저 | **pnpm 9.x** | §1.4 |
| Node 버전 | **Node 22 LTS** (`.nvmrc`·`engines` 명시) | §2.4 |
| FE 빌드 산출 배포 | **Caddy 이미지 자체 빌드 — FE `dist/`를 `COPY`로 포함** (옵션 A) | §3.4 |
| 환경변수 주입 | **빌드 시 `VITE_*` inline** (환경별 `.env.{staging,prod}`) | §4.3 |
| CI/CD | **GitHub Actions 8단계** (BE 정합 — `09_service_design.md` §11.3) | §5.3 |

---

## 1. 패키지 매니저

### 1.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | pnpm 9.x | content-addressable | disk 효율, monorepo 친화 |
| 2 | npm 10 | 표준 | Node 동봉 |
| 3 | bun 1.x | all-in-one | 빠름, Node 호환 진행 중 |
| 4 | yarn 4 (berry) | PnP 또는 node-modules | 활발 |

### 1.2 1차 벤치마크 — 사주라 MVP 필수 기능

| # | 후보 | install 속도 | disk 효율 | lockfile 표준 | TS·ESM 호환 | CI 캐시 | 1인 운영 단순성 | 결과 |
|---|------|:---:|:---:|:---:|:---:|:---:|:---:|:---|
| 1 | pnpm 9.x | ◎ | ◎ (content-addressable) | ◎ (`pnpm-lock.yaml`) | ◎ | ◎ | ◎ | ✅ **통과** |
| 2 | npm 10 | △ | △ | ◎ (`package-lock.json`) | ◎ | O | ◎ | 🟡 **보존** |
| 3 | bun 1.x | ◎ | O | O (`bun.lockb` 바이너리) | O (호환 진행) | O | △ (네이티브 의존성 호환 검증 진행) | ⛔ (성숙도) |
| 4 | yarn 4 | O | O | O (`yarn.lock`) | ◎ | O | △ (PnP 멘탈 모델·node-modules 모드 분리 필요) | ⛔ |

### 1.3 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| install 속도 | 중요 | 1인 운영 — 의존성 변경 시 시간 |
| disk 효율 | 중요 | 로컬·CI 디스크 |
| lockfile 표준 (재현성) | **필수** | 운영·CI 정합 |
| 네이티브 의존성 호환 | **필수** | Playwright·esbuild 등 |

**탈락 사유:**

- **#3 bun** — 빠르지만 일부 네이티브 의존성·도구(Vitest·Playwright)와 호환 검증 진행 중. 1인 운영 환경에 안정성 우선.
- **#4 yarn 4** — PnP 모드 학습 비용·node-modules 모드와 분리 필요. pnpm이 동일 이점 + 단순.

### 1.4 최종 선발

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **패키지 매니저** | **pnpm 9.x** ✅ | content-addressable store로 disk·install 효율 우수. `pnpm-lock.yaml` 표준. monorepo 친화(향후 FE·shared 패키지 분리 가능). React·Vite·shadcn/ui·Playwright 모두 1급 지원. 1인 운영 환경에 단순 |

### 1.5 보존 후보 (npm)

Node 동봉으로 별도 설치 불필요. pnpm 도입 비용이 부담될 경우 후보.

**재평가 트리거:**

| 지표 | 임계치 |
|------|------|
| pnpm 호환 문제 | 의존성 1건+ |
| 팀 표준이 npm으로 통일 | — |

→ 1개 발생 시 npm으로 변경 검토.

---

## 2. Node 버전

### 2.1 후보

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | Node 22 LTS | 활성 LTS | 2024-10 LTS, 2027-04 EOL |
| 2 | Node 20 LTS | 유지 LTS | 2026-04 EOL |
| 3 | Node 18 LTS | EOL 임박 | 2025-04 EOL — 미채택 |

### 2.2 결정

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **Node 버전** | **Node 22 LTS** ✅ | 활성 LTS·`.nvmrc` 명시·`package.json engines`(`"node": ">=22"`)·CI matrix `node-version: 22`·Docker 빌드 단계 `node:22-alpine`. ESM·top-level await·fetch 모두 표준 |

### 2.3 운영

| 항목 | 값 |
|------|---|
| `.nvmrc` | `22` |
| `package.json` engines | `{ "node": ">=22", "pnpm": ">=9" }` |
| CI runner | `actions/setup-node@v4 with: node-version: 22` |
| 빌드 컨테이너 | `node:22-alpine` (CI 빌드 단계) |

---

## 3. FE 빌드 산출 배포

### 3.1 결정 환경

`09_service_design.md` §11.1 — Caddy(`caddy:alpine`)가 BE 프록시 + PWA 정적 파일 서빙 둘 다 담당. FE Vite 빌드 산출(`dist/`)을 어떻게 Caddy 컨테이너에 전달할지 결정 필요.

### 3.2 후보 옵션

| # | 옵션 | 방식 | 평가 |
|---|------|------|------|
| A | Caddy 이미지 자체 빌드 + FE `dist/` COPY | `Dockerfile`에서 `caddy:alpine` + `COPY dist /var/www/pwa` | ✅ 이미지 단위 배포 — 롤백 단순, 운영 호스트 의존 없음 |
| B | Caddy 공식 이미지 + 호스트 volume `dist/` 마운트 | `docker-compose.yml` `volumes: - ./dist:/var/www/pwa:ro` | △ 호스트 파일 시스템 의존, 롤백 시 dist도 복원 필요 |
| C | 별도 nginx-fe 컨테이너 | Caddy는 BE 프록시만, fe-static은 nginx | ⛔ 운영 컨테이너 1개 추가 — `09_service_design.md` §11.1 6 서비스 구성 깸 |

### 3.3 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| 이미지 단위 배포 (atomic) | **필수** | 롤백·재현성 |
| 운영 컨테이너 수 유지 | **필수** | `09_service_design.md` §11.1 6 서비스 구성 보존 |
| CI 빌드 → 이미지 push → 운영 pull 흐름 정합 | **필수** | BE GitHub Actions 정합 |

**탈락 사유:**

- **B (호스트 volume)** — 운영 호스트 파일 시스템에 dist를 두면 롤백 시 dist 폴더 단위 복원 필요·CI 이미지 push 모델과 부정합.
- **C (별도 nginx-fe)** — 운영 컨테이너 1개 추가로 `09_service_design.md` §11.1 6 서비스 구성 깸. 7 서비스로 부풀림.

### 3.4 최종 선발

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **FE 빌드 산출 배포** | **옵션 A: Caddy 이미지 자체 빌드 + FE `dist/` COPY** ✅ | FE CI가 `pnpm build` → Caddy 이미지(`Dockerfile.caddy`)에 `dist/`를 COPY → GHCR push. 운영 호스트는 이미지 pull/restart만으로 FE+Caddy 동시 갱신. 롤백은 이미지 태그 교체 1회. `09_service_design.md` §11.1 caddy 행을 "자체 빌드"로 정정 필요 (§6.2) |

### 3.5 권장 Dockerfile

```dockerfile
# Dockerfile.caddy (저장소 루트 또는 FE 디렉터리)
# stage 1: FE 빌드
FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@9
COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG VITE_VAPID_PUBLIC_KEY
ARG VITE_API_BASE_URL=/api
ARG VITE_SENTRY_DSN
RUN pnpm gen:api && pnpm build

# stage 2: Caddy 정적 + 리버스 프록시
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=builder /app/dist /var/www/pwa
```

| 단계 | 처리 |
|------|------|
| 1 builder | Node 22 + pnpm으로 의존성·코드젠·빌드 — `VITE_*` ARG는 환경별 `.env`에서 GH Actions가 주입 |
| 2 Caddy | `caddy:2-alpine` + Caddyfile(`docs/research/backend/03_reverse_proxy.md` §4.1) + dist 정적 자산 |

---

## 4. 환경변수 주입

### 4.1 후보

| # | 옵션 | 방식 | 평가 |
|---|------|------|------|
| 1 | 빌드 시 `VITE_*` inline | Vite가 빌드 시점 환경변수를 JS에 inline | ✅ MVP 단순 |
| 2 | 런타임 `window.__ENV__` 주입 | 진입 HTML에 `<script>` 1개로 환경변수 노출 | △ 이미지 1개를 환경 분리 — 복잡 |

### 4.2 판정 기준

| 기능 | 필수도 | 근거 |
|------|-------|------|
| 운영·스테이징 분리 | **필수** | `09_service_design.md` §11.2 환경 분리 정합 |
| 단순성 | 중요 | 1인 운영 |
| Sentry DSN·VAPID 공개 키 등 비밀번호 아닌 공개 키 inline 허용 | 자연 | 공개 키는 secret 아님 |

### 4.3 최종 선발

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **환경변수 주입** | **빌드 시 `VITE_*` inline** ✅ | 환경별 `.env.staging`·`.env.prod`를 CI에서 ARG로 빌드 단계에 주입 → Caddy 이미지가 환경별로 다름. 사주라는 스테이징·프로덕션 각 1개 이미지 — 운영 호스트 부담 작음 |

### 4.4 환경변수 목록 (FE 기준)

| 변수 | 사용처 | 비고 |
|------|------|------|
| `VITE_API_BASE_URL` | ky `prefixUrl` | dev `/api`(proxy) / 운영 `/api` (Caddy handle) |
| `VITE_VAPID_PUBLIC_KEY` | `06_pwa_push.md` §2.4 | 공개 키 — inline 안전 |
| `VITE_SENTRY_DSN` | Sentry 초기화 | 공개 DSN — inline 안전 |
| `VITE_SENTRY_ENVIRONMENT` | Sentry env | `staging` / `prod` |
| `VITE_APP_VERSION` | Sentry release · 디버깅 | `git-<sha-short>` (CI 단계 주입) |

> 비밀 시크릿(API 비밀 키 등)은 FE에 노출 불가 — BE만 보유.

---

## 5. CI/CD

### 5.1 BE 정합 (`09_service_design.md` §11.3 — 8단계)

BE GitHub Actions 8단계와 같은 구조로 FE 파이프라인 정의. CI 파일은 `.github/workflows/fe.yml` 분리.

### 5.2 FE 파이프라인 (8단계)

```yaml
# .github/workflows/fe.yml (스켈레톤)
name: fe
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  fe:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }

      - run: pnpm install --frozen-lockfile

      - name: lint·format
        run: pnpm biome ci .

      - name: type check
        run: pnpm tsc --noEmit

      - name: OpenAPI codegen drift
        run: |
          pnpm gen:api
          git diff --exit-code src/types/api.d.ts || (echo "OpenAPI 코드젠 산출이 commit과 불일치. pnpm gen:api 재실행 후 commit하세요." && exit 1)

      - name: test
        run: pnpm vitest run --coverage

      - name: e2e
        run: pnpm playwright install --with-deps chromium && pnpm playwright test

      - name: build (vite)
        env:
          VITE_API_BASE_URL: /api
          VITE_VAPID_PUBLIC_KEY: ${{ secrets.VITE_VAPID_PUBLIC_KEY }}
          VITE_SENTRY_DSN: ${{ secrets.VITE_SENTRY_DSN }}
          VITE_SENTRY_ENVIRONMENT: prod
          VITE_APP_VERSION: ${{ github.sha }}
        run: pnpm build

      - name: docker build (Caddy + dist)
        if: github.ref == 'refs/heads/main'
        run: |
          docker buildx build \
            --platform linux/amd64,linux/arm64 \
            --build-arg VITE_VAPID_PUBLIC_KEY=${{ secrets.VITE_VAPID_PUBLIC_KEY }} \
            --build-arg VITE_API_BASE_URL=/api \
            --build-arg VITE_SENTRY_DSN=${{ secrets.VITE_SENTRY_DSN }} \
            -t ghcr.io/${{ github.repository }}/caddy:git-${GITHUB_SHA::7} \
            -t ghcr.io/${{ github.repository }}/caddy:prod-latest \
            -f Dockerfile.caddy \
            --push .

      - name: trivy scan
        if: github.ref == 'refs/heads/main'
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ghcr.io/${{ github.repository }}/caddy:git-${{ github.sha }}
          format: sarif
          output: trivy-fe.sarif
          severity: CRITICAL,HIGH

      - uses: github/codeql-action/upload-sarif@v3
        if: github.ref == 'refs/heads/main'
        with: { sarif_file: trivy-fe.sarif }

      - name: deploy (pull and restart)
        if: github.ref == 'refs/heads/main'
        run: ssh ${{ secrets.PROD_HOST }} "docker compose pull caddy && docker compose up -d caddy"
```

### 5.3 8단계 요약

| 단계 | 실패 처리 |
|------|--------|
| 1 checkout | PR 차단 |
| 2 pnpm install --frozen-lockfile | PR 차단 |
| 3 biome ci + tsc --noEmit + OpenAPI drift | PR 차단 |
| 4 vitest + coverage | PR 차단 |
| 5 playwright e2e | PR 차단 |
| 6 vite build | PR 차단 |
| 7 docker buildx + trivy + push | 단일 아키 재시도 후 차단 |
| 8 운영 pull & restart | 이전 태그 롤백 |

### 5.4 이미지 태그 정책

BE 정합 (`09_service_design.md` §11.4):

| 환경 | 태그 |
|------|---|
| 운영 | `git-<commit-sha-short>` + `prod-latest` |
| 스테이징 | `git-<commit-sha-short>` + `staging-latest` |
| 개발 | `dev-<branch>-<commit-sha-short>` |

Sentry release tagging도 동일 `<commit-sha-short>` 사용 — `VITE_APP_VERSION` 환경변수로 inline.

---

## 6. 통합 최종 결정 (spec 반영)

### 6.1 결정 항목 (5건)

| 항목 | 결정 | spec 반영 위치 |
|------|------|--------------|
| 패키지 매니저 | **pnpm 9.x** | FE spec 신설 시 명시 |
| Node 버전 | **Node 22 LTS** | FE spec 신설 시 명시 |
| FE 빌드 산출 배포 | **Caddy 이미지 자체 빌드 + FE `dist/` COPY** | **`09_service_design.md` §11.1 caddy 행을 "자체 빌드 (Caddy + FE dist)"로 정정** (§6.2 참조) |
| 환경변수 주입 | **빌드 시 `VITE_*` inline** | FE spec 신설 시 명시 |
| CI/CD | **GitHub Actions 8단계** (`.github/workflows/fe.yml`) | FE spec 신설 시 명시. BE workflow와 분리 |

### 6.2 backend spec 정합 갱신 (1건)

| 갱신 대상 | 현재 | 정정 |
|---------|------|------|
| `docs/spec/09_service_design.md` §11.1 caddy 행 이미지 | `caddy:alpine` | **자체 빌드 (`Dockerfile.caddy` — `caddy:2-alpine` 베이스 + FE `dist/` COPY)** |

> 사유: FE 빌드 산출이 Caddy 이미지에 포함되어야 atomic 배포·롤백 가능. 호스트 volume·별도 컨테이너 대안은 §3.3에서 탈락.

### 6.3 결정에 따라 다른 카테고리에 미치는 영향

| 영향 | 영향 받는 영역 |
|------|----------------|
| FE CI workflow 추가 | `.github/workflows/` BE·FE 분리 — `09_testing_quality.md` §6.2 정합 |
| `VITE_VAPID_PUBLIC_KEY` GitHub secret 등록 | 운영 secret 관리 항목 |
| 이미지 빌드 멀티 아키 (amd64+arm64) | Mac mini M2 Pro(arm64) + amd64 CI 호환 — BE 정합 |

---

## 7. 후보 세부 정보

### 7.1 pnpm 9.x ✅
- **장점**: content-addressable store·disk 효율·monorepo 대비·CI 캐시 친화
- **단점**: 사용자가 pnpm 미설치 시 별도 설치 (corepack 활용 가능)
- **세부사항**: MIT

### 7.2 Node 22 LTS ✅
- **장점**: 활성 LTS·ESM·fetch·top-level await 표준
- **단점**: 일부 레거시 native 모듈은 18에 머무를 수 있음 — 사주라 의존성 무관
- **세부사항**: MIT

### 7.3 Caddy 이미지 자체 빌드 ✅
- **장점**: 이미지 단위 atomic 배포·롤백 단순·CI push 모델 정합
- **단점**: Caddy 이미지 빌드 시간 추가 — `node:22-alpine` builder layer 캐시로 완화

### 7.4 빌드 시 `VITE_*` inline ✅
- **장점**: 단순·SW precaching·CDN 캐시 친화 (런타임 fetch 없음)
- **단점**: 환경별 이미지 빌드 (사주라는 staging·prod 2개로 부담 작음)

### 7.5 GitHub Actions 8단계 ✅
- **장점**: BE 정합·secret·cache·runtime 모두 표준
- **단점**: e2e 단계가 무거우면 PR 시간 증가 — 핵심 시나리오 5건으로 한정

### 7.6 보존·탈락 요약

| 후보 | 분류 | 결과 | 사유 |
|------|------|------|------|
| npm | 매니저 | 🟡 보존 | pnpm 호환 문제 트리거 |
| bun | 매니저 | ⛔ | 성숙도 |
| yarn 4 | 매니저 | ⛔ | PnP 멘탈 모델 |
| 호스트 volume 마운트 | 배포 | ⛔ | atomic 깨짐 |
| 별도 nginx-fe | 배포 | ⛔ | 컨테이너 +1 |
| 런타임 `window.__ENV__` | 환경변수 | ⛔ | MVP 단순성 회피 |

---

## 8. 비교 요약 표

| 분류 | 후보 | 결과 | 핵심 사유 |
|------|------|------|---------|
| 매니저 | pnpm 9.x | ✅ | content-addressable·CI 캐시 |
| 매니저 | npm | 🟡 보존 | pnpm 호환 문제 트리거 |
| 매니저 | bun / yarn | ⛔ | 성숙도 / PnP 학습 |
| Node | 22 LTS | ✅ | 활성 LTS·ESM·fetch |
| 배포 | Caddy 자체 빌드 + dist COPY | ✅ | atomic 이미지 배포 |
| 배포 | 호스트 volume | ⛔ | 롤백 깨짐 |
| 배포 | 별도 nginx-fe | ⛔ | 컨테이너 +1 |
| 환경변수 | 빌드 inline | ✅ | 단순·SW 친화 |
| 환경변수 | 런타임 inject | ⛔ | MVP 과함 |
| CI | GitHub Actions 8단계 | ✅ | BE 정합 |
