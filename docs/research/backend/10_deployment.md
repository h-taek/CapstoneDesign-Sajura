# 의존성 · 컨테이너 · 배포 · 환경 설정

> **카테고리**: 패키지 관리, 컨테이너·멀티 컨테이너 정의·이미지 빌드·이미지 보안 스캔, CI/CD, 환경 분리
> **연결 spec**: `docs/spec/09_service_design.md` §1, `docs/spec/01_requirements.md` §6.3

---

## 0. 카테고리 구성 & 결정 항목

| 하위 카테고리 | 후보 수 | 결정 항목 수 |
|------------|--------|------------|
| §1 의존성 / 패키지 관리 | 6 | 1 |
| §2 컨테이너 · 배포 · CI/CD | 12 | 5 (컨테이너 / 멀티 / 빌드 / 이미지 스캔 / CI). 3는 03 결정, 4는 보존 |
| §3 환경 / 시크릿 / 설정 | 4 | 0 (모두 04·05에서 결정됨 — 본 문서는 참조만) |

### 본 research가 결정하는 라이브러리·도구 (spec 반영)

| 도구 | 카테고리 | 결정 근거 위치 | spec 반영 위치 |
|------|---------|--------------|--------------|
| uv | 의존성 관리 | §1.2 + §1.4 | `09_service_design.md` §1 개발·테스트 도구 (신규) |
| Trivy | 이미지 보안 스캔 | §2.2 + §2.4 | `09_service_design.md` §1 개발·테스트 도구 (신규) |
| Docker | 컨테이너 | §2.2 + §2.4 | `09_service_design.md` §1 외부 운영 도구 (신규) |
| Docker Compose | 멀티 컨테이너 정의 | §2.2 + §2.4 | `09_service_design.md` §1 외부 운영 도구 (신규) |
| Docker Buildx / BuildKit | 이미지 빌드 | §2.2 + §2.4 | Docker 기본 포함 — 별도 행 불필요 |
| GitHub Actions | CI/CD | §2.2 + §2.4 | `09_service_design.md` §1 외부 운영 도구 (신규, `01_requirements.md` §6.3 정합) |

### 이미 결정된 항목 (다른 research에서)

| 항목 | 결정 | 결정 위치 |
|------|------|---------|
| Caddy v2 | ✅ 리버스 프록시·자동 HTTPS·HTTP/2·3 | `03_reverse_proxy.md` §4 |
| Nginx | 🟡 보존 (재평가 트리거) | `03_reverse_proxy.md` §4.3 |
| Traefik | ⛔ 미채택 | `03_reverse_proxy.md` §3.3 |
| pydantic-settings | ✅ 채택 | `04_data_layer.md` §2.4 |
| python-dotenv | ⛔ 미채택 (pydantic-settings에 흡수) | `04_data_layer.md` §2.3 / `05_auth_security.md` §2.4 |
| pip-audit | ✅ Python 의존성 취약점 스캔 | `09_testing_quality.md` §2.4 |

### 본 research 보존 후보 (probe·요구 트리거)

| 후보 | 보류 이유 | 트리거 |
|------|---------|------|
| Kubernetes | MVP 단일 노드(Mac mini)에 과한 수준 | 매장 ≥ 1000 (3단계) — `01_requirements.md` 1000 매장 목표 |
| Helm | k8s 의존 | Kubernetes 도입 시점 |
| ArgoCD / Flux | k8s 의존 | Kubernetes 도입 시점 |
| Watchtower | 운영 의도된 배포 흐름과 충돌 | 사용 안 함 (탈락) |

---

## 1. 의존성 / 패키지 관리

### 1.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | pip + requirements.txt | 기본 | PSF 표준 |
| 2 | Poetry | 통합 매니저 | lock·group·publish |
| 3 | uv | 통합 매니저 (Rust) | Astral |
| 4 | PDM | PEP 582·621 친화 | 채택 적음 |
| 5 | pip-tools | requirements 잠금 | 단순 |
| 6 | Hatch | 빌드·환경 매트릭스 | PyPA |

### 1.2 1차 벤치마크 — 필수 기능

| # | 후보 | 잠금·해시 | 가상환경 통합 | group 의존성(dev/test) | 설치 속도 | pyproject.toml 표준 | 결과 |
|---|------|:--------:|:----------:|:-------------------:|:--------:|:----------------:|:----|
| 1 | pip + requirements.txt | △(`pip-compile` 별도) | ⛔ (venv 별도) | ⛔ | 보통 | △ | ⛔ |
| 2 | Poetry | ◎ | ◎ | ◎ | △ (느림) | ◎ | 🟡 |
| 3 | uv | ◎ | ◎ | ◎ | ◎ (Rust 10~100배 빠름) | ◎ | ✅ **통과** |
| 4 | PDM | ◎ | ◎ | ◎ | O | ◎ | ⛔ (채택 적음) |
| 5 | pip-tools | O(lock 한정) | ⛔ | △ | 보통 | △ | ⛔ |
| 6 | Hatch | △ (잠금 약함) | ◎ | ◎ | 보통 | ◎ | ⛔ (잠금 약함) |

### 1.3 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| 잠금·해시 검증 | **필수** | 의존성 재현성·공급망 보안 (`12_security.md` §7) |
| 가상환경 통합 | **필수** | 개발·CI·운영 환경 일관성 |
| group 의존성 | **필수** | 09에서 채택한 개발·테스트 도구 12개를 dev group으로 분리 |
| 설치 속도 | 중요 | CI 시간 단축 |
| pyproject.toml 표준 | **필수** | 09 ruff·mypy 설정과 단일 파일 통합 |

**탈락 사유:**

- **#1 pip + requirements.txt** — 잠금·해시·가상환경 통합 부족. dev/test group 표현 어려움.
- **#2 Poetry** — 잠금·통합 우수하나 설치 속도가 uv 대비 10~100배 느림. 1인 운영 + CI 시간 고려 시 uv 우위.
- **#4 PDM** — PEP 582 가상환경 없는 워크플로우 강점이나 채택률 낮음 — 1인 운영 디버깅 자료 확보 어려움.
- **#5 pip-tools** — 잠금만 지원, 가상환경 별도. uv가 통합.
- **#6 Hatch** — 환경 매트릭스 강점이나 의존성 잠금 약함.

### 1.4 최종 선발

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **의존성·가상환경·빌드 통합 매니저** | **uv** ✅ | Rust로 10~100배 빠름 — CI 단축. pip·pip-tools·virtualenv·pyenv 일부 기능 단일 도구 통합. `pyproject.toml` PEP 621 표준 (ruff·mypy 설정과 단일 파일). 09에서 채택한 ruff와 동일 Astral 운영 — 일관성. dev/test/docs group 분리 표현. `uv.lock` 잠금·해시 |

---

## 2. 컨테이너 · 배포 · CI/CD

### 2.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | Docker | 컨테이너 런타임 | 사실상 표준 |
| 2 | Docker Compose | 멀티 컨테이너 정의 | 로컬·MVP |
| 3 | GitHub Actions | CI/CD | spec 권장 |
| 4 | Buildx / BuildKit | 이미지 빌드 | Docker 기본 |
| 5 | Trivy | 이미지 보안 스캔 | Aqua Security |
| 6 | Grype | 이미지 보안 스캔 | Anchore |
| 7 | Watchtower | 자동 업데이트 | — |
| 8 | Nginx | 리버스 프록시 | 03 보존 |
| 9 | Caddy | 리버스 프록시 | 03 채택 |
| 10 | Traefik | 동적 프록시 | 03 탈락 |
| 11 | Kubernetes | 오케스트레이션 | 3단계 보존 |
| 12 | Helm / ArgoCD / Flux | k8s 도구 | k8s 의존 |

### 2.2 1차 벤치마크 — 필수 기능

**컨테이너 런타임·멀티 컨테이너·빌드**

| # | 후보 | 컨테이너 | Compose 통합 | 멀티 아키 | MVP 적합 | 결과 |
|---|------|:------:|:----------:|:-------:|:------:|:----|
| 1 | Docker | ◎ | ◎ (Compose V2 통합) | ◎ (Buildx) | ◎ | ✅ **통과 (런타임)** |
| 2 | Docker Compose | — | ◎ | — | ◎ | ✅ **통과 (멀티)** |
| 4 | Buildx / BuildKit | — | — | ◎ (amd64+arm64) | ◎ | ✅ **통과 (빌드)** |

**CI/CD**

| # | 후보 | 결과 |
|---|------|:----|
| 3 | GitHub Actions | ✅ **통과 (CI/CD)** — `01_requirements.md` §6.3 명시. OIDC·matrix·캐시·무료 한도 충분 |

**이미지 보안 스캔**

| # | 후보 | SARIF 출력 | GitHub Actions 통합 | CVE DB 업데이트 | OS·라이브러리 통합 스캔 | 결과 |
|---|------|:--------:|:------------------:|:-----------:|:------------------:|:----|
| 5 | Trivy | ◎ | ◎ (공식 액션) | ◎ (Aqua DB 빠른 업데이트) | ◎ | ✅ **통과 (이미지 스캔)** |
| 6 | Grype | O | O | O | O | ⛔ (Trivy 동등하나 GH Actions 통합·사례·자료 Trivy 우위) |

**자동 업데이트 / 프록시 / 오케스트레이션**

| # | 후보 | 결과 |
|---|------|:----|
| 7 | Watchtower | ⛔ — 의도된 배포 흐름(GitHub Actions → 이미지 빌드 → 운영 pull)과 충돌. CI 기반 배포 표준에 위배 |
| 8~10 | Nginx / Caddy / Traefik | 03에서 결정 — Caddy ✅ / Nginx 🟡 보존 / Traefik ⛔ |
| 11 | Kubernetes | 🟡 보존 (매장 1000+ 3단계) |
| 12 | Helm / ArgoCD / Flux | 🟡 보존 (k8s 도입 시) |

### 2.3 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| 컨테이너 런타임 | **필수** | BE·MySQL·Redis·n8n·Caddy + ARQ 워커 = 6 컨테이너 |
| 멀티 컨테이너 정의 | **필수** | 단일 YAML로 로컬·운영 stack 정의 |
| 멀티 아키 빌드 | **필수** | Mac mini M2 Pro(arm64) 운영 + 잠재적 x86 배포 환경 |
| CI/CD | **필수** | `01_requirements.md` §6.3 |
| 이미지 보안 스캔 | **필수** | `12_security.md` §7 — pip-audit이 Python 의존성, Trivy가 컨테이너 이미지(OS·라이브러리)로 보완관계 |
| 오케스트레이션 (k8s) | MVP 미채택 | 단일 노드 Mac mini |

**탈락 사유:**

- **#6 Grype** — Trivy와 기능 동등하나 GH Actions 공식 액션·사례·자료에서 Trivy 우위. 두 도구 동시 사용 가치 없음.
- **#7 Watchtower** — 컨테이너 자동 업데이트는 의도된 배포 흐름(CI → 빌드 → 운영 배포)을 우회. 운영 안정성 저하.
- **#11~12** — Kubernetes·Helm·ArgoCD·Flux는 단일 노드 MVP에 과한 수준. 3단계 1000 매장 도달 시 재평가.

### 2.4 최종 선발

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **컨테이너 런타임** | **Docker** ✅ | 사실상 표준. Docker Engine은 Apache 2.0. Docker Desktop은 학교 프로젝트·1인 운영에서 무료 라이선스 적용 (중규모 기업 이상 유료) |
| **멀티 컨테이너 정의** | **Docker Compose (V2)** ✅ | 단일 `docker-compose.yml`로 BE + ARQ 워커 + MySQL + Redis + n8n + Caddy = 6 서비스 정의. 로컬·운영 환경 분리는 `--env-file` 또는 override |
| **이미지 빌드** | **Buildx / BuildKit** ✅ | Docker 기본 포함. `--platform linux/amd64,linux/arm64` 멀티 아키 빌드, secret 마운트, SBOM 생성 |
| **CI/CD** | **GitHub Actions** ✅ | `01_requirements.md` §6.3 명시. OIDC로 secret-less 배포 가능, matrix(Python 버전·OS), reusable workflow, runner 캐시. 무료 plan 2000분/월 — MVP 충분 |
| **이미지 보안 스캔** | **Trivy** ✅ | OS·언어 라이브러리·secret·misconfig 통합 스캔. SARIF로 GitHub Security 탭 통합. CI에 `trivy image` 또는 `aquasecurity/trivy-action` 사용. pip-audit(09)이 Python 의존성, Trivy가 컨테이너 이미지로 보완관계 |

---

## 3. 환경 / 시크릿 / 설정 (참조)

본 카테고리의 모든 후보는 다른 research에서 이미 결정되었다.

| 후보 | 결정 | 결정 위치 |
|------|------|---------|
| pydantic-settings | ✅ 채택 (타입 안전 설정 로더) | `04_data_layer.md` §2.4 |
| python-dotenv | ⛔ 미채택 (pydantic-settings에 흡수) | `04_data_layer.md` §2.3 |
| dynaconf | ⛔ 미채택 (pydantic-settings로 대체 가능) | 본 §3 (다중 환경은 pydantic-settings 환경별 model로 처리) |
| environs | ⛔ 미채택 (검증 약함) | 본 §3 |
| HashiCorp Vault / sops + age | 🟡 보존 (시크릿 매니저) | `05_auth_security.md` §2.4·§2.5 |

> 본 카테고리는 이미 다른 research에서 결정 — 본 문서에서 추가 결정 없음.

---

## 4. 운영 흐름 (research 결정)

### 4.1 Docker Compose 서비스 구성 (운영 기준)

| 서비스 | 이미지 | 비고 |
|--------|------|------|
| `be` | 사주라 자체 빌드 (Gunicorn + uvicorn.workers) | `02_app_server.md` §4 |
| `arq-worker` | 사주라 자체 빌드 (`arq <module>.WorkerSettings`) | `08_async_pipeline.md` §4.2 |
| `mysql` | `mysql:8` | `04_data_layer.md` |
| `redis` | `redis:7-alpine` | `07_cache_observability.md` §1.4 |
| `n8n` | `n8nio/n8n` | `08_async_pipeline.md` §2.4 |
| `caddy` | `caddy:alpine` | `03_reverse_proxy.md` §4 |

> AI Server는 `13_performance.md` §2.5에 따라 별도 머신·별도 stack — 본 Compose 외부.

### 4.2 환경 분리

| 환경 | 빌드 / 실행 |
|------|----------|
| 로컬 개발 | `uv run uvicorn main:app --reload` (Compose는 MySQL·Redis만 실행) |
| 스테이징 | `docker compose -f docker-compose.yml -f docker-compose.staging.yml up` |
| 운영 | `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d` |

> 시크릿은 환경별 `.env.staging` / `.env.prod` 파일 + Docker secret 마운트. 운영 비밀은 Git에 커밋 금지 (`.gitignore` 강제).

### 4.3 CI 파이프라인 단계

```
1. checkout
2. uv sync --frozen  (의존성 잠금 검증)
3. pre-commit run --all-files  (ruff check + format + mypy + bandit + pip-audit)
4. pytest --cov  (단위 + 통합, testcontainers Docker 필요)
5. docker buildx build --platform linux/amd64,linux/arm64
6. trivy image <built-image>  (SARIF 출력 → GitHub Security)
7. (main 브랜치) GHCR or 자체 레지스트리 push
8. (main 브랜치) 운영 호스트 SSH or Watchtower-less pull-and-restart
```

| 단계 | 실패 처리 |
|------|--------|
| 2, 3, 4, 6 | 실패 시 PR 머지 차단 |
| 5 | 멀티 아키 빌드 실패 시 단일 아키 재시도 (재시도 후에도 실패 시 차단) |
| 7, 8 | 배포 실패 시 이전 이미지 태그로 롤백 (GHCR 태그 유지) |

### 4.4 이미지 태그 정책

| 환경 | 태그 |
|------|---|
| 운영 | `git-<commit-sha-short>` + `prod-latest` |
| 스테이징 | `git-<commit-sha-short>` + `staging-latest` |
| 개발 | `dev-<branch>-<commit-sha-short>` |

> Sentry Release tagging(`07_cache_observability.md` §3.3)에 동일 `<commit-sha-short>` 사용 — 운영 에러 추적 시 이미지·소스 일치.

### 4.5 Docker Desktop 메모리 권장

Mac mini M2 Pro 16GB 운영 가정 (`02_app_server.md` §4.1):
- Docker Desktop Settings → Resources → Memory **10~12 GB** 할당
- BE workers 4개 × peak 900MB + MySQL 2GB + Redis 0.5GB + n8n 1GB + Caddy 50MB + ARQ 워커 1개 × 500MB ≈ 7.5 GB
- 헤드룸 2~3 GB 확보

---

## 5. 통합 최종 결정 (spec 반영)

### 5.1 도구 결정 (5개 신규)

**외부 운영 도구 (`09_service_design.md` §1 외부 운영 도구 표에 추가)**

| 도구 | 역할 |
|------|------|
| **Docker (Engine)** | 컨테이너 런타임. BE·ARQ 워커·MySQL·Redis·n8n·Caddy 컨테이너화 |
| **Docker Compose (V2)** | 멀티 컨테이너 정의 — 단일 `docker-compose.yml`로 6 서비스 정의. 환경 override(`docker-compose.staging.yml`·`docker-compose.prod.yml`) |
| **GitHub Actions** | CI/CD — uv sync → pre-commit → pytest → Buildx 멀티 아키 빌드 → Trivy 스캔 → 레지스트리 push (`01_requirements.md` §6.3 정합) |

**개발·테스트 도구 (`09_service_design.md` §1 개발·테스트 도구 표에 추가)**

| 도구 | 역할 |
|------|------|
| **uv** | Python 패키지·가상환경·빌드 통합 매니저 (Rust). `pyproject.toml` PEP 621 + `uv.lock` |
| **Trivy** | 컨테이너 이미지 보안 스캔 (OS·언어 라이브러리·secret·misconfig). SARIF로 GitHub Security 통합. pip-audit과 보완 |

> Docker Buildx / BuildKit은 Docker 기본 포함 — 별도 행 불필요.

### 5.2 결정에 따라 spec에서 갱신될 항목 (참조)

| 영향 영역 | 결정 사항 | 위치 |
|---------|---------|------|
| Docker Compose 6 서비스 구성 | be · arq-worker · mysql · redis · n8n · caddy | `09_service_design.md` 운영 토폴로지 절(신규) 또는 운영 메모 |
| CI 파이프라인 8단계 | uv sync → pre-commit → pytest → Buildx → Trivy → push → deploy | `09_service_design.md` CI 절(신규) 또는 별도 plan 문서 |
| 환경 분리 (dev/staging/prod) | `.env.dev` / `.env.staging` / `.env.prod` + Docker secret | `12_security.md` 시크릿 관리 절 또는 운영 메모 |
| Docker Desktop 메모리 권장 | 10~12 GB | `13_performance.md` 운영 환경 메모 |

> DB 컬럼·API endpoint·서비스 시그니처 추가 없음 — 본 카테고리 결정은 도구·운영 절차 한정.

---

## 6. 후보 세부 정보

### 6.1 uv ✅
- **사용처**: 의존성 관리·가상환경·빌드 통합
- **장점**: Rust로 매우 빠름(10~100배), pip·pip-tools·virtualenv·pyenv 일부 통합, `pyproject.toml` PEP 621 + `uv.lock` 잠금·해시, `uv run` 가상환경 자동 활성
- **단점**: 비교적 신생(2024) — 일부 빌드 플러그인 호환 점검 필요 (사주라 의존성에서 호환 확인됨)
- **세부사항**: 라이선스 Apache 2.0/MIT. Astral (ruff 동일 운영사 — 09 채택과 일관성)

### 6.2 Docker ✅
- **사용처**: BE·ARQ 워커·MySQL·Redis·n8n·Caddy 컨테이너 런타임
- **장점**: 환경 일관성, 광범위 채택, 이미지 레지스트리 풍부, Mac mini M2 Pro arm64 네이티브 지원
- **단점**: 디스크·메모리 사용량 (M2 Pro 16GB 메모리 권장 §4.5 참조)
- **세부사항**: Docker Engine Apache 2.0. Docker Desktop은 학교 프로젝트·소규모 운영에서 무료

### 6.3 Docker Compose (V2) ✅
- **사용처**: 6 서비스 stack 정의 (be · arq-worker · mysql · redis · n8n · caddy)
- **장점**: 단일 YAML로 전체 stack 정의, 환경 override 가능, `docker compose` 서브커맨드 통합
- **단점**: 운영 오케스트레이션엔 한계 (k8s 보존 후보 — 3단계)
- **세부사항**: Compose V2부터 Docker 기본 포함

### 6.4 GitHub Actions ✅
- **사용처**: CI/CD — uv sync, pre-commit, pytest, Buildx 멀티 아키, Trivy 스캔, 레지스트리 push, 배포
- **장점**: GitHub 통합·OIDC·matrix·reusable workflow·캐시. 무료 plan 2000분/월
- **단점**: 사용량 초과 시 비용, runner 캐시 정책 신경 필요
- **세부사항**: `01_requirements.md` §6.3 spec 정합

### 6.5 Docker Buildx / BuildKit ✅
- **사용처**: 멀티 아키(amd64+arm64) 이미지 빌드, 캐시·secret 마운트·SBOM
- **장점**: Docker 기본 포함, `--platform linux/amd64,linux/arm64`, `--cache-from`·`--cache-to`, `--secret`
- **단점**: 캐시 호환 매트릭스 학습 필요 (1회성)
- **세부사항**: Docker 23+ 자동 활성

### 6.6 Trivy ✅
- **사용처**: 컨테이너 이미지 보안 스캔 (OS·언어 라이브러리·secret·misconfig)
- **장점**: SARIF 출력 → GitHub Security 탭 통합, Aqua DB 빠른 CVE 업데이트, 공식 GitHub Action(`aquasecurity/trivy-action`)
- **단점**: false positive 정리 필요 (`.trivyignore`로 관리)
- **세부사항**: 라이선스 Apache 2.0. Aqua Security

### 6.7 보존·탈락 후보 요약

| 후보 | 분류 | 결과 | 사유 |
|------|------|------|------|
| pip + requirements.txt | 의존성 | ⛔ | 잠금·가상환경 통합 부족 |
| Poetry | 의존성 | ⛔ | uv 대비 설치 속도 |
| PDM | 의존성 | ⛔ | 채택률 낮음 |
| pip-tools | 의존성 | ⛔ | 가상환경 별도 |
| Hatch | 의존성 | ⛔ | 잠금 약함 |
| Grype | 이미지 스캔 | ⛔ | Trivy 동등 — GH 통합 Trivy 우위 |
| Watchtower | 자동 업데이트 | ⛔ | 의도된 배포 흐름 위배 |
| Nginx | 프록시 | 🟡 보존 | 03 §4.3 Caddy 재평가 트리거 |
| Traefik | 프록시 | ⛔ | 03 §3.3 |
| Kubernetes | 오케스트레이션 | 🟡 보존 | 매장 1000+ (3단계) |
| Helm / ArgoCD / Flux | k8s 도구 | 🟡 보존 | Kubernetes 도입 시 |
| dynaconf / environs | 환경 설정 | ⛔ | pydantic-settings 우위 (04 결정) |

---

## 7. 비교 요약 표

| 분류 | 후보 | 결과 | 핵심 사유 |
|------|------|------|---------|
| 의존성 관리 | uv | ✅ | Rust 10~100배·통합·Astral |
| 의존성 관리 | Poetry / pip / PDM / pip-tools / Hatch | ⛔ | 속도 / 통합 / 채택률 / 잠금 |
| 컨테이너 런타임 | Docker | ✅ | 표준 |
| 멀티 컨테이너 | Docker Compose | ✅ | 단일 YAML stack |
| 빌드 | Buildx / BuildKit | ✅ (Docker 기본) | 멀티 아키 |
| CI/CD | GitHub Actions | ✅ | spec 명시·OIDC·matrix |
| 이미지 스캔 | Trivy | ✅ | SARIF·GH 통합·Aqua DB |
| 이미지 스캔 | Grype | ⛔ | Trivy 우위 |
| 자동 업데이트 | Watchtower | ⛔ | 배포 흐름 위배 |
| 프록시 | Caddy / Nginx / Traefik | 03 결정 | Caddy 채택 / Nginx 보존 / Traefik 탈락 |
| 오케스트레이션 | Kubernetes | 🟡 보존 | 매장 1000+ |
| 환경 설정 | pydantic-settings | 04 결정 | 채택 |
| 환경 설정 | python-dotenv / dynaconf / environs | 04·05 결정 | pydantic-settings에 흡수 또는 우위 |
