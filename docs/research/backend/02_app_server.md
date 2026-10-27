# 애플리케이션 서버

> **카테고리**: WSGI/ASGI/RSGI 프로토콜로 HTTP를 수신해 프레임워크와 연결하는 서버 후보 조사
> **연결 spec**: `docs/spec/03_be.md` §1

---


## 1. 전체 후보 목록

ASGI 서버 5개 + WSGI 서버 7개 = **총 12개**.

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | Uvicorn | ASGI | 표준 ASGI 서버 |
| 2 | Gunicorn + uvicorn.workers | ASGI | 프로세스 매니저 |
| 3 | Hypercorn | ASGI | HTTP/2·H3 |
| 4 | Granian | ASGI/WSGI/RSGI | Rust 통합 |
| 5 | Daphne | ASGI | Django Channels |
| 6 | Gunicorn (sync/gthread/gevent) | WSGI | WSGI 표준 |
| 7 | uWSGI | WSGI | 전통적 |
| 8 | mod_wsgi | WSGI | Apache 모듈 |
| 9 | Waitress | WSGI | 순수 Python |
| 10 | Bjoern | WSGI | libev C |
| 11 | Meinheld | WSGI | greenlet |
| 12 | Cheroot | WSGI | CherryPy |

---

## 2. 1차 벤치마크 — 프로토콜 호환

### 2.1 채점 표

| # | 후보 | ASGI 지원 | WSGI 지원 |
|---|------|:--------:|:--------:|
| 1 | Uvicorn | O | X |
| 2 | Gunicorn + uvicorn.workers | O (워커 통해) | O |
| 3 | Hypercorn | O | X |
| 4 | Granian | O | O |
| 5 | Daphne | O | X |
| 6 | Gunicorn (sync/gthread/gevent) | X | O |
| 7 | uWSGI | X | O |
| 8 | mod_wsgi | X | O |
| 9 | Waitress | X | O |
| 10 | Bjoern | X | O |
| 11 | Meinheld | X | O |
| 12 | Cheroot | X | O |

### 2.2 후보별 차이

- Gunicorn (sync/gthread/gevent) — WSGI 워커 모드다. ASGI 앱은 `uvicorn.workers` 워커로 실행한다(#2).
- uWSGI — WSGI 전용이다. 비표준 ASGI 어댑터가 있다.
- mod_wsgi — Apache 모듈이며 WSGI 전용이다.
- Waitress·Bjoern·Meinheld·Cheroot — WSGI 전용이다.

---

## 3. 2차 벤치마크 — 운영 적합성

> ASGI를 지원하는 5개 후보(Uvicorn / Gunicorn+UvicornWorker / Hypercorn / Granian / Daphne) 대상.

### 3.1 평가 표

| # | 후보 | FastAPI 통합 | 프로세스 매니저 | HTTP/2 | 성숙도 | Docker 친화 |
|---|------|:-----------:|:-------------:|:------:|:-----:|:----------:|
| 1 | Uvicorn | ◎(표준) | △(`--workers` fork) | X | 안정 | O |
| 2 | Gunicorn + uvicorn.workers | ◎(운영 표준) | ◎(prefork) | X | 안정 | ◎ |
| 3 | Hypercorn | △(적음) | O | O | 안정 | O |
| 4 | Granian | △(증가 중) | O | O | 신생 | O |
| 5 | Daphne | X(Django 전용) | △ | X | 안정 | △ |

### 3.2 후보별 차이

- Hypercorn — HTTP/2·H3 지원이 핵심 강점이다. 리버스 프록시가 외부 HTTP/2/3를 종료하는 구성에서는 ASGI 서버가 내부 HTTP/1.1만 받는다. FastAPI 통합 사례·자료가 Uvicorn보다 적다.
- Granian — Rust 구현으로 처리량이 높다. 2022년에 나온 신생 서버라 운영 검증이 적다.
- Daphne — Django Channels 전용으로 설계됐다.

---

## 4. Gunicorn + uvicorn.workers 운영 설정

### 4.1 워커 수 산정

BE 요청 처리는 MySQL(aiomysql)·Redis·httpx(AI Server) 호출을 기다리는 I/O bound 작업이다. CPU 집약 작업(ML 학습·추론)은 별도 AI Server에서 실행된다(`03_be.md` §14.1.5).

Gunicorn 공식 권장 공식은 `workers = (2 × cores) + 1`이다. 아래 환경에서는 이 공식보다 메모리(워커당 peak RSS)가 먼저 상한에 닿는다.

기준 하드웨어: Mac mini M2 Pro · CPU 10-core(6P+4E) · RAM **16 GB unified**.

| 메모리 항목 | 사용량 | 비고 |
|-----------|------|------|
| macOS + GUI | ~3 GB | 헤드리스 운영 시 절감 가능 |
| Docker Desktop VM overhead | ~1.5–2 GB | Linux VM 구조상 손실 |
| MySQL 컨테이너 | 1.5–2 GB | `innodb_buffer_pool_size=2G` 튜닝 가정 |
| Redis | 0.3–0.5 GB | 캐시 + Refresh Token 블랙리스트 |
| n8n | 0.5–1 GB | Node.js 런타임 |
| Caddy (reverse proxy) | < 50 MB | — |
| **BE 가용 메모리** | **~7.5–9 GB** | 헤드룸 1 GB 확보 시 실사용 6.5–8 GB |

| 워커당 RSS | 값 | 비고 |
|----------|---|------|
| FastAPI 기본 | 150–250 MB | Pydantic v2 + Starlette |
| SQLAlchemy async pool | 50–100 MB | 워커당 connection 5–10 |
| Playwright Chromium 활성 (peak) | +300–500 MB | Chromium 기동 중일 때만 |
| **정상 RSS / peak RSS** | **300–500 MB / 700–900 MB** | |

BE 가용 메모리 7.5 GB를 워커당 peak RSS 900 MB로 나누면 약 8이다.

위 메모리 예산은 Docker Desktop 메모리 할당이 10–12 GB일 때 성립한다. Docker Desktop 기본 할당은 보통 8 GB다(Settings → Resources → Memory).

### 4.2 운영 옵션

> Gunicorn + UvicornWorker 옵션별 값과 근거.

| 옵션 | 값 | 근거 |
|------|------|---------------|
| `-k` | `uvicorn.workers.UvicornWorker` | ASGI 앱 실행에 필요한 워커 클래스 |
| `--workers` | 4 | §4.1 메모리 상한(약 8) 안의 값 |
| `--bind` | `0.0.0.0:8000` | 리버스 프록시가 접속하는 내부 포트 |
| `--timeout` | **60** | 브라우저 자동화(Playwright) 요청은 5~60초 걸릴 수 있다. 일반 API 목표 응답 200 ms보다 충분히 길다. 60초 초과 시 워커 SIGKILL |
| `--graceful-timeout` | **30** | Docker `stop_grace_period` 기본 30초에 정합. SIGTERM 받으면 진행 중 요청 완결 후 종료 |
| `--keepalive` | **5** | Caddy(`03_reverse_proxy.md`)와 HTTP/1.1 upstream keep-alive. 너무 길면 idle 워커 점유, 짧으면 핸드셰이크 비용 |
| `--max-requests` | **1000** | 워커 1000요청 처리 후 자동 재시작. SQLAlchemy 커서·Playwright Chromium 메모리 누수 방어 |
| `--max-requests-jitter` | **50** | 1000의 5%. 모든 워커가 동시 재시작해 503 발생하지 않도록 분산 |
| `--preload` | 사용 (조건부) | fork 전 앱 1회 로드 → 메모리 공유(CoW)·기동 가속. 단, fork-unsafe 리소스는 워커별로 다시 만들어야 한다 (아래 표) |
| `--worker-tmp-dir` | `/dev/shm` | Linux 컨테이너 한정. Heartbeat 파일을 tmpfs에 두어 디스크 I/O 제거. macOS에는 `/dev/shm`이 없다 |
| `--access-logfile` | `-` | stdout으로 출력 → Docker 로그 드라이버가 수집 |
| `--error-logfile` | `-` | stderr로 출력 |
| `--access-logformat` | (JSON 구조화) | `07_cache_observability.md` 로깅 표준에서 정의 |
| `--limit-request-line` | 기본 (4094) | Gunicorn 기본값 |
| `--limit-request-fields` | 기본 (100) | Gunicorn 기본값 |

전체 실행 예시:

```bash
gunicorn main:app \
  -k uvicorn.workers.UvicornWorker \
  -w 4 \
  --bind 0.0.0.0:8000 \
  --timeout 60 \
  --graceful-timeout 30 \
  --keepalive 5 \
  --max-requests 1000 \
  --max-requests-jitter 50 \
  --preload \
  --worker-tmp-dir /dev/shm \
  --access-logfile - \
  --error-logfile -
```

#### `--preload` 사용 시 주의 — fork-unsafe 리소스 분리

`--preload`는 마스터에서 앱을 1회 로드하고 워커를 fork한다. 이때 마스터에서 만든 객체가 모든 워커에 복사된다. 그러나 **fork-safe하지 않은 리소스**는 워커 내부에서 재생성해야 한다.

| 리소스 | fork-safe? | 처리 방식 |
|--------|----------|---------|
| SQLAlchemy `AsyncEngine` (connection pool) | X | `@app.on_event("startup")` 또는 lifespan 핸들러에서 워커별 생성 |
| Redis connection pool | X | startup hook에서 워커별 생성 |
| Playwright `async_playwright` | X | 요청 시점 또는 워커 startup hook에서 생성 |
| httpx `AsyncClient` | X | startup hook에서 워커별 생성 |
| Pydantic 모델 클래스, 라우터 정의, 정적 설정 | O | 마스터에서 로드 OK (preload 이득) |

async 클라이언트·풀을 모두 FastAPI lifespan 안에서 초기화하면 `--preload`와 함께 쓸 수 있다.

---

## 5. 후보 세부 정보

> ASGI를 지원하는 5개 후보의 장점·단점·세부사항. WSGI 전용 7개는 §2.2 참조.

### 5.1 Uvicorn
- **사용처**: 표준 ASGI 서버. FastAPI 개발·운영.
- **장점**:
  - encode 표준 ASGI 구현
  - uvloop·httptools 결합 시 매우 빠름(`uvicorn[standard]`)
  - `--reload`·`--workers`·HTTP/1.1·WebSocket 지원
  - Docker·Gunicorn 통합 사례 풍부
- **단점**:
  - 프로세스 매니저 기능 약함 → 운영에서는 Gunicorn 워커로 띄우는 패턴이 일반적
  - HTTP/2·HTTP/3 미지원
- **세부사항**: 라이선스 BSD. encode.

### 5.2 Gunicorn (+ uvicorn.workers)
- **사용처**: 운영 환경 멀티 워커 ASGI/WSGI 실행, 프로세스 매니저.
- **장점**:
  - 검증된 프로세스 관리(prefork)
  - preload·timeout·max-requests·graceful restart 옵션 풍부
  - 헬스체크·signal 처리 안정적
  - WSGI(`sync`/`gthread`/`gevent`) + ASGI(`uvicorn.workers`) 모두 지원
- **단점**:
  - HTTP/2·HTTP/3 미지원
  - 설정값이 많아 학습 곡선
  - Windows 미지원
- **세부사항**: 라이선스 MIT. Benoit Chesneau.

### 5.3 Hypercorn
- **사용처**: HTTP/2·HTTP/3·QUIC가 필요한 경우.
- **장점**:
  - HTTP/2·H3 지원
  - trio·asyncio 모두 지원
  - Quart와 같은 Pallets 생태계
- **단점**:
  - 생태계·운영 사례 Uvicorn 대비 적음
- **세부사항**: 라이선스 MIT. Pallets.

### 5.4 Granian
- **사용처**: Rust 기반 ASGI/WSGI/RSGI 서버.
- **장점**:
  - Rust 구현(hyper 기반)으로 매우 높은 처리량
  - RSGI 자체 프로토콜·HTTP/2·HTTPS·HTTP/3(실험) 지원
  - WSGI·ASGI·RSGI 단일 서버
  - 단일 바이너리 배포
- **단점**:
  - 상대적으로 신생
  - 운영 검증·문서량 적음
- **세부사항**: 라이선스 BSD-3. Giovanni Barillari(Emmett 저자).

### 5.5 Daphne
- **사용처**: Django Channels의 공식 ASGI 서버.
- **장점**:
  - Django Channels와 표준 통합
  - HTTP·WebSocket 지원
- **단점**:
  - Django Channels 외에는 채택 적음
  - 성능 Uvicorn 대비 열위
- **세부사항**: 라이선스 BSD-3. Django Software Foundation.

---

## 6. 비교 표

### 6.1 ASGI 애플리케이션 서버 비교
| 항목 | HTTP/2 | WebSocket | 멀티프로세스 | 핵심 장점 | 핵심 단점 |
|------|-------|----------|------------|---------|---------|
| Uvicorn | X | O | △(--workers, fork) | 표준·빠름 | 프로세스 관리 약함 |
| Gunicorn + uvicorn.workers | X | O(워커 통해) | O | 검증된 프로세스 관리 | HTTP/2 미지원 |
| Hypercorn | O | O | O | HTTP/2·H3 | 사례 적음 |
| Granian | O | O | O | Rust·RSGI·WSGI/ASGI 통합 | 신생 |
| Daphne | X | O | △ | Django Channels 통합 | Channels 외 채택 적음 |

---
