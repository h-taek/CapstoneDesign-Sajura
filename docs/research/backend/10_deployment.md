# 의존성 · 컨테이너 · 배포 · 환경 설정

> **카테고리**: 패키지 관리, 컨테이너·멀티 컨테이너 정의·이미지 빌드·이미지 보안 스캔, CI/CD, 환경 분리
> **연결 spec**: `docs/spec/03_be.md` §1, `docs/spec/01_basic_design.md` §5.4

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

| # | 후보 | 잠금·해시 | 가상환경 통합 | group 의존성(dev/test) | 설치 속도 | pyproject.toml 표준 |
|---|------|:--------:|:----------:|:-------------------:|:--------:|:----------------:|
| 1 | pip + requirements.txt | △(`pip-compile` 별도) | X (venv 별도) | X | 보통 | △ |
| 2 | Poetry | ◎ | ◎ | ◎ | △ (느림) | ◎ |
| 3 | uv | ◎ | ◎ | ◎ | ◎ (Rust 10~100배 빠름) | ◎ |
| 4 | PDM | ◎ | ◎ | ◎ | O | ◎ |
| 5 | pip-tools | O(lock 한정) | X | △ | 보통 | △ |
| 6 | Hatch | △ (잠금 약함) | ◎ | ◎ | 보통 | ◎ |

### 1.3 후보별 차이

- pip + requirements.txt — 잠금·해시에 `pip-compile` 같은 별도 도구가 필요하고 가상환경을 따로 만든다. dev/test group 표현이 어렵다.
- Poetry — 잠금·가상환경 통합을 지원하나 설치 속도가 uv보다 10~100배 느리다.
- PDM — PEP 582 가상환경 없는 워크플로우를 지원한다. 채택률이 낮아 디버깅 자료가 적다.
- pip-tools — 잠금만 지원하고 가상환경은 별도다.
- Hatch — 환경 매트릭스를 지원하나 의존성 잠금이 약하다.

---

## 2. 컨테이너 · 배포 · CI/CD

### 2.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | Docker | 컨테이너 런타임 | 사실상 표준 |
| 2 | Docker Compose | 멀티 컨테이너 정의 | 단일 호스트 |
| 3 | GitHub Actions | CI/CD | GitHub 통합 |
| 4 | Buildx / BuildKit | 이미지 빌드 | Docker 기본 |
| 5 | Trivy | 이미지 보안 스캔 | Aqua Security |
| 6 | Grype | 이미지 보안 스캔 | Anchore |
| 7 | Watchtower | 자동 업데이트 | — |
| 8 | Nginx | 리버스 프록시 | `03_reverse_proxy.md` 비교 |
| 9 | Caddy | 리버스 프록시 | `03_reverse_proxy.md` 비교 |
| 10 | Traefik | 동적 프록시 | `03_reverse_proxy.md` 비교 |
| 11 | Kubernetes | 오케스트레이션 | 다중 노드 |
| 12 | Helm / ArgoCD / Flux | k8s 도구 | k8s 의존 |

### 2.2 1차 벤치마크 — 필수 기능

**컨테이너 런타임·멀티 컨테이너·빌드**

| # | 후보 | 컨테이너 | Compose 통합 | 멀티 아키 |
|---|------|:------:|:----------:|:-------:|
| 1 | Docker | ◎ | ◎ (Compose V2 통합) | ◎ (Buildx) |
| 2 | Docker Compose | — | ◎ | — |
| 4 | Buildx / BuildKit | — | — | ◎ (amd64+arm64) |

**CI/CD**

| # | 후보 | 특징 |
|---|------|------|
| 3 | GitHub Actions | OIDC·matrix·캐시. 무료 plan 2000분/월 |

**이미지 보안 스캔**

| # | 후보 | SARIF 출력 | GitHub Actions 통합 | CVE DB 업데이트 | OS·라이브러리 통합 스캔 |
|---|------|:--------:|:------------------:|:-----------:|:------------------:|
| 5 | Trivy | ◎ | ◎ (공식 액션) | ◎ (Aqua DB 빠른 업데이트) | ◎ |
| 6 | Grype | O | O | O | O |

**자동 업데이트 / 프록시 / 오케스트레이션**

| # | 후보 | 특징 |
|---|------|------|
| 7 | Watchtower | 레지스트리의 새 이미지로 실행 중 컨테이너를 자동 갱신 |
| 8~10 | Nginx / Caddy / Traefik | `03_reverse_proxy.md`에서 비교 |
| 11 | Kubernetes | 다중 노드 오케스트레이션 |
| 12 | Helm / ArgoCD / Flux | Kubernetes 전제 |

### 2.3 후보별 차이

- Trivy, pip-audit — pip-audit는 Python 의존성을, Trivy는 컨테이너 이미지의 OS 패키지·언어 라이브러리를 스캔한다.
- Grype — Trivy와 기능이 비슷하다. GitHub Actions 공식 액션·사용 사례·자료는 Trivy 쪽이 많다.
- Watchtower — 컨테이너를 자동 갱신하므로 CI → 이미지 빌드 → 운영 배포 흐름을 거치지 않고 운영 컨테이너가 바뀐다.
- Kubernetes, Helm, ArgoCD, Flux — 다중 노드 오케스트레이션용이다. Helm·ArgoCD·Flux는 Kubernetes를 전제로 한다.

---

## 3. 환경 / 시크릿 / 설정

| # | 후보 | 비고 |
|---|------|------|
| 1 | pydantic-settings | 타입 안전 설정 로더. `04_data_layer.md`에서 비교 |
| 2 | python-dotenv | `.env` 로더. pydantic-settings가 `.env` 읽기를 포함 |
| 3 | dynaconf | 다중 환경 설정. pydantic-settings도 환경별 model로 다중 환경 구성 가능 |
| 4 | environs | 환경변수 파서. 검증 기능이 약함 |
| 5 | HashiCorp Vault / sops + age | 시크릿 매니저. `05_auth_security.md`에서 비교 |

---

## 4. 후보 세부 정보

### 4.1 uv
- **장점**: Rust로 매우 빠름(10~100배), pip·pip-tools·virtualenv·pyenv 일부 통합, `pyproject.toml` PEP 621 + `uv.lock` 잠금·해시, `uv run` 가상환경 자동 활성, dev/test/docs group 분리
- **단점**: 비교적 신생(2024) — 일부 빌드 플러그인 호환 점검 필요. 사주라 의존성에서는 호환을 확인했다
- **세부사항**: 라이선스 Apache 2.0/MIT. Astral (ruff와 같은 개발사)

### 4.2 Docker
- **장점**: 환경 일관성, 광범위 채택, 이미지 레지스트리 풍부, Mac mini M2 Pro arm64 네이티브 지원
- **단점**: 디스크·메모리 사용량
- **세부사항**: Docker Engine Apache 2.0. Docker Desktop은 학교 프로젝트·소규모 운영에서 무료 (중규모 기업 이상 유료)

### 4.3 Docker Compose (V2)
- **장점**: 단일 YAML로 전체 stack 정의, 환경 override 파일·`--env-file` 지원, `docker compose` 서브커맨드 통합
- **단점**: 다중 노드 오케스트레이션엔 한계
- **세부사항**: Compose V2부터 Docker 기본 포함

### 4.4 GitHub Actions
- **장점**: GitHub 통합·OIDC로 secret-less 배포·matrix(Python 버전·OS)·reusable workflow·runner 캐시. 무료 plan 2000분/월
- **단점**: 사용량 초과 시 비용, runner 캐시 정책 신경 필요

### 4.5 Docker Buildx / BuildKit
- **장점**: Docker 기본 포함, `--platform linux/amd64,linux/arm64` 멀티 아키, `--cache-from`·`--cache-to`, `--secret` 마운트, SBOM 생성
- **단점**: 캐시 호환 매트릭스 학습 필요 (1회성)
- **세부사항**: Docker 23+ 자동 활성

### 4.6 Trivy
- **장점**: OS·언어 라이브러리·secret·misconfig 통합 스캔, SARIF 출력 → GitHub Security 탭 통합, Aqua DB 빠른 CVE 업데이트, 공식 GitHub Action(`aquasecurity/trivy-action`)
- **단점**: false positive 정리 필요 (`.trivyignore`로 관리)
- **세부사항**: 라이선스 Apache 2.0. Aqua Security

---

## 5. 비교 요약 표

| 분류 | 후보 | 특징 |
|------|------|------|
| 의존성 관리 | uv | Rust 10~100배·잠금/가상환경/group 통합·Astral |
| 의존성 관리 | Poetry / pip / PDM / pip-tools / Hatch | uv 대비 느림 / 잠금·가상환경 별도 / 채택률 낮음 / 잠금만 / 잠금 약함 |
| 컨테이너 런타임 | Docker | 사실상 표준 |
| 멀티 컨테이너 | Docker Compose | 단일 YAML stack |
| 빌드 | Buildx / BuildKit | Docker 기본 포함·멀티 아키 |
| CI/CD | GitHub Actions | OIDC·matrix·캐시 |
| 이미지 스캔 | Trivy | SARIF·공식 GitHub Action·Aqua DB |
| 이미지 스캔 | Grype | Trivy와 기능 유사 |
| 자동 업데이트 | Watchtower | 실행 중 컨테이너 자동 갱신 |
| 프록시 | Caddy / Nginx / Traefik | `03_reverse_proxy.md` 비교 |
| 오케스트레이션 | Kubernetes | 다중 노드 |
| 환경 설정 | pydantic-settings | 타입 안전 설정 로더 |
| 환경 설정 | python-dotenv / dynaconf / environs | `.env` 로더 / 다중 환경 / 검증 약함 |
