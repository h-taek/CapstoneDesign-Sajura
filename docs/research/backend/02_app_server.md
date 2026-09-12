# 애플리케이션 서버

> **카테고리**: WSGI/ASGI/RSGI 프로토콜로 HTTP를 수신해 프레임워크와 연결하는 서버 후보 조사
> **연결 spec**: `docs/spec/09_service_design.md` §1

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

> 사주라 BE 본체는 FastAPI(ASGI). 따라서 **ASGI 지원**이 필수 조건이다.

### 2.1 채점 표

| # | 후보 | ASGI 지원 | WSGI 지원 | 결과 |
|---|------|:--------:|:--------:|:----|
| 1 | Uvicorn | O | X | ✅ **통과** |
| 2 | Gunicorn + uvicorn.workers | O (워커 통해) | O | ✅ **통과** |
| 3 | Hypercorn | O | X | ✅ **통과** |
| 4 | Granian | O | O | ✅ **통과** |
| 5 | Daphne | O | X | ✅ **통과** |
| 6 | Gunicorn (sync/gthread/gevent) | X | O | ⛔ |
| 7 | uWSGI | X | O | ⛔ |
| 8 | mod_wsgi | X | O | ⛔ |
| 9 | Waitress | X | O | ⛔ |
| 10 | Bjoern | X | O | ⛔ |
| 11 | Meinheld | X | O | ⛔ |
| 12 | Cheroot | X | O | ⛔ |

### 2.2 판정 기준

| 기능 | 필수도 | 근거 |
|------|-------|------|
| ASGI 지원 | **필수** | FastAPI(`01_web_framework.md` §4 확정)는 ASGI 프레임워크. 09_service_design.md 섹션 1. WSGI 단독 서버는 본체 운영 불가 |

**판정 룰**: ASGI 미지원 → 탈락.

### 2.3 탈락 항목 사유 (7개)

WSGI 단독 서버 7개는 Flask·Django 등 WSGI 프레임워크 운영용으로만 의미. 사주라 본체에 미사용.

- **#6 Gunicorn (sync/gthread/gevent)** — WSGI 모드. 단, ASGI 워커(`uvicorn.workers`)로는 #2에서 통과.
- **#7 uWSGI** — WSGI 전용. (비표준 ASGI 어댑터 존재하나 채택 불가 수준)
- **#8 mod_wsgi** — Apache 모듈, WSGI 전용.
- **#9 Waitress** — WSGI 전용.
- **#10 Bjoern** — WSGI 전용.
- **#11 Meinheld** — WSGI 전용.
- **#12 Cheroot** — WSGI 전용.

### 2.4 통과 후보 (5개)

| # | 후보 | 핵심 강점 |
|---|------|---------|
| 1 | Uvicorn | encode 표준·uvloop·httptools |
| 2 | Gunicorn + uvicorn.workers | 검증된 프로세스 매니저 |
| 3 | Hypercorn | HTTP/2·H3 지원 |
| 4 | Granian | Rust 처리량·RSGI 통합 |
| 5 | Daphne | Django Channels 통합 |

---

## 3. 2차 벤치마크 — 운영 적합성

> 1차 통과 5개(Uvicorn / Gunicorn+UvicornWorker / Hypercorn / Granian / Daphne) 대상.
> 사주라 운영 시나리오(Mac mini + Docker + 리버스 프록시 + MVP 50매장) 기준으로 비교.
>
> **전제**: `03_reverse_proxy.md`(Caddy 등)가 외부 HTTPS·HTTP/2/3 종료를 담당하므로 ASGI 서버는 내부 HTTP/1.1만 처리한다.

### 3.1 평가 기준

| 기준 | 사주라 관점 | 필수도 |
|------|-----------|-------|
| FastAPI 통합 사례·검증 | 운영 검증된 조합 우대 | **필수** |
| 프로세스 매니저 | preload·graceful restart·timeout·max-requests | **필수** (운영) |
| HTTP/2·H3 직접 지원 | 리버스 프록시가 외부 HTTP/2/3 종료 → ASGI 서버는 HTTP/1.1로 충분 | 불필요 |
| 생태계·자료 | 한국어 자료·운영 사례·서드파티 통합 | 중요 |
| 성숙도·운영 안정성 | MVP 단계 운영 리스크 최소화 | 중요 |
| Docker 컨테이너 친화 | PID 1·signal 처리·이미지 크기 | 중요 |

### 3.2 평가 표

| # | 후보 | FastAPI 통합 | 프로세스 매니저 | HTTP/2 강점 | 성숙도 | Docker 친화 | 결과 |
|---|------|:-----------:|:-------------:|:----------:|:-----:|:----------:|:----|
| 1 | Uvicorn | ◎(표준) | △(`--workers` fork) | 무관 | 안정 | O | ✅ **통과** (개발용·단순 배포) |
| 2 | Gunicorn + uvicorn.workers | ◎(운영 표준) | ◎(prefork) | 무관 | 안정 | ◎ | ✅ **통과** (운영용) |
| 3 | Hypercorn | △(적음) | O | 무력(프록시 종료) | 안정 | O | ⛔ 차별점 부재 |
| 4 | Granian | △(증가 중) | O | 무력(프록시 종료) | 신생 | O | ⛔ 운영 검증 부족 |
| 5 | Daphne | ⛔(Django 전용) | △ | 무관 | 안정 | △ | ⛔ FastAPI 부적합 |

### 3.3 탈락 항목 사유 (3개)

- **#3 Hypercorn** — HTTP/2·H3가 핵심 강점이나 사주라 환경에서 리버스 프록시가 HTTP/2/3 종료를 담당하므로 차별점 무력화. FastAPI 통합 사례·자료 Uvicorn 대비 적음.
- **#4 Granian** — Rust 처리량은 매력적이나 신생(2022~)·운영 검증 부족. MVP 단계 리스크 큼. **2단계 이후 처리량 한계가 보이면 재평가 후보**로 보존.
- **#5 Daphne** — Django Channels 전용 설계. FastAPI 운영에 사용할 이유 없음.

### 3.4 통과 후보 (2개)

| # | 후보 | 역할 |
|---|------|------|
| 1 | Uvicorn | 개발 / 단순 단일 노드 |
| 2 | Gunicorn + uvicorn.workers | 운영 환경 (멀티 워커·프로세스 매니저) |

---

## 4. 최종 선발

**개발 환경: Uvicorn 단독**, **운영 환경: Gunicorn + uvicorn.workers** ✅ 확정.

| 환경 | 선택 | 실행 예 |
|------|------|--------|
| 로컬 개발 | Uvicorn 단독 | `uvicorn main:app --reload --port 8000` |
| MVP·2단계 운영 | Gunicorn + uvicorn.workers | `gunicorn main:app -k uvicorn.workers.UvicornWorker -w N --bind 0.0.0.0:8000` |

| 결정 사유 | 내용 |
|----------|------|
| FastAPI 표준 조합 | encode·Gunicorn 공식 문서가 권장하는 ASGI 운영 패턴. 사주라 spec(`09_service_design.md` §1)에 FastAPI는 확정·Uvicorn은 미기재 상태 → 본 조사로 확정 |
| 프로세스 관리 | Gunicorn의 preload·timeout·max-requests·graceful restart로 Docker PID 1 안정 운영 |
| HTTP/2 무관 | `03_reverse_proxy.md`가 외부 HTTP/2/3 종료 담당 |
| 성숙도 | encode·Benoit Chesneau 운영·문서 풍부, 한국어 자료 다수 |
| 학습 곡선 | BE 팀(2명) 온보딩 비용 최소 |

### 4.1 워커 수 산정

**진단**: 사주라 BE는 명확히 **I/O bound** (MySQL aiomysql · Redis · httpx(AI Server) · Playwright(쿠팡)). CPU 집약 작업(ML 학습·추론)은 `13_performance.md` §2 분리 배포 원칙에 따라 별도 AI Server로 위임.

→ Gunicorn 공식 권장 공식 **`workers = (2 × cores) + 1`** 을 상한으로 두되, **메모리 제약**(Playwright Chromium peak 700–900 MB/워커)이 실질적 상한.

**운영 환경**: Mac mini M2 Pro · CPU 10-core(6P+4E) · RAM **16 GB unified**.

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
| Playwright Chromium 활성 (peak) | +300–500 MB | 쿠팡 자동화 호출 시에만 |
| **정상 RSS / peak RSS** | **300–500 MB / 700–900 MB** | |

| 환경 | 권장 워커 수 | 산출 근거 |
|------|------------|---------|
| **MVP (50매장)** | **`--workers 4`** | 메모리 7.5 GB ÷ peak 900 MB ≈ 8 상한, Playwright 동시 호출 여유 두고 4 |
| 2단계 (100매장) | `--workers 6` | Playwright 동시성 모니터링 후 결정 |
| 3단계 (300매장) | **별도 Linux 서버로 분리** | M2 Pro 16 GB 메모리 한계 — `(2×cores)+1` 공식 적용 가능 환경으로 이전 |

⚠️ **Docker Desktop 메모리 할당**을 기본값(보통 8 GB)에서 **10–12 GB**로 상향해야 위 예산 성립. Settings → Resources → Memory.

### 4.2 Granian 재평가 트리거

§3.3에서 Granian을 "2단계 이후 처리량 한계 시 재평가"로 보존했다. 재평가 트리거 정량값:

| 지표 | 임계치 | 근거 |
|------|------|------|
| 평균 RPS | ≥ 200 req/s (지속) | MVP 50매장 가정 RPS의 10배. Uvicorn worker 처리량 여유 소진 시점 |
| API p95 응답 | > 200 ms 지속 (5분 평균) | `13_performance.md` §1.1 일반 API SLA 위반 |
| 워커 CPU 사용률 | 평균 > 70% (전체 워커) | Python GIL 한계 접근 신호 |
| 메모리 압박 | macOS Memory Pressure 노란색 빈발 | swap 유입으로 응답 지연 |

→ 위 4개 중 **2개 이상이 1주 이상 지속**되면 Granian 또는 Linux 서버 분리 재평가 진입.

### 4.3 운영 옵션 권장값

> Gunicorn + UvicornWorker 운영 시 적용할 옵션 정량값. spec(`09_service_design.md` §1·`13_performance.md`) 의존성과 함께 정리.

| 옵션 | 권장값 | 사주라 적용 근거 |
|------|------|---------------|
| `-k uvicorn.workers.UvicornWorker` | 고정 | FastAPI(ASGI) 실행에 필수 |
| `--workers` | 4 (MVP) | §4.1 산정 |
| `--bind` | `0.0.0.0:8000` | Caddy → 내부 포트 |
| `--timeout` | **60** | Playwright 쿠팡 자동화는 5~60초 가능 (`04_feature_spec.md` §9). 일반 API는 200ms 안 끝나므로 영향 없음. 60초 초과 시 워커 SIGKILL |
| `--graceful-timeout` | **30** | Docker `stop_grace_period` 기본 30초에 정합. SIGTERM 받으면 진행 중 요청 완결 후 종료 |
| `--keepalive` | **5** | Caddy(`03_reverse_proxy.md`)와 HTTP/1.1 upstream keep-alive. 너무 길면 idle 워커 점유, 짧으면 핸드셰이크 비용 |
| `--max-requests` | **1000** | 워커 1000요청 처리 후 자동 재시작. SQLAlchemy 커서·Playwright Chromium 메모리 누수 방어 |
| `--max-requests-jitter` | **50** | 1000의 5%. 모든 워커가 동시 재시작해 503 발생하지 않도록 분산 |
| `--preload` | **사용 (조건부)** | fork 전 앱 1회 로드 → 메모리 공유(CoW)·기동 가속. **단, fork-unsafe 리소스는 startup hook으로 분리 필수** (아래 표) |
| `--worker-tmp-dir` | `/dev/shm` | Linux 컨테이너 한정. Heartbeat 파일을 tmpfs에 두어 디스크 I/O 제거. macOS 로컬 개발에선 미적용 |
| `--access-logfile` | `-` | stdout으로 출력 → Docker 로그 드라이버가 수집 |
| `--error-logfile` | `-` | stderr로 출력 |
| `--access-logformat` | (JSON 구조화) | `07_cache_observability.md` 로깅 표준에서 정의 |
| `--limit-request-line` | 기본 (4094) | 보안 기본값 유지 |
| `--limit-request-fields` | 기본 (100) | 보안 기본값 유지 |

**전체 실행 예시** (MVP 운영):

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
| SQLAlchemy `AsyncEngine` (connection pool) | ❌ | `@app.on_event("startup")` 또는 lifespan 핸들러에서 워커별 생성 |
| Redis connection pool | ❌ | startup hook에서 워커별 생성 |
| Playwright `async_playwright` | ❌ | 요청 시점 또는 워커 startup hook에서 생성 |
| httpx `AsyncClient` | ❌ | startup hook에서 워커별 생성 |
| Pydantic 모델 클래스, 라우터 정의, 정적 설정 | ✅ | 마스터에서 로드 OK (preload 이득) |

→ 코드 작성 시 **모든 async 클라이언트·풀은 FastAPI lifespan 안에서 초기화**한다는 규칙만 지키면 `--preload` 안전하게 사용 가능.

---

## 5. 통과 후보 세부 정보

> 1차 통과 5개 후보의 사용처·장점·단점·세부사항. 탈락 7개는 §2.3 사유로 대체.

### 5.1 Uvicorn 🟡
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

### 5.2 Gunicorn (+ uvicorn.workers) 🟡
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

### 5.3 Hypercorn 🟡
- **사용처**: HTTP/2·HTTP/3·QUIC가 필요한 경우.
- **장점**:
  - HTTP/2·H3 지원
  - trio·asyncio 모두 지원
  - Quart와 같은 Pallets 생태계
- **단점**:
  - 생태계·운영 사례 Uvicorn 대비 적음
  - 본 프로젝트 MVP에서 HTTP/2 이상 요구 없음
- **세부사항**: 라이선스 MIT. Pallets.

### 5.4 Granian 🟡
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

### 5.5 Daphne 🔵
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
| 항목 | 분류 기준 | HTTP/2 | WebSocket | 멀티프로세스 | 핵심 장점 | 핵심 단점 |
|------|----------|-------|----------|------------|---------|---------|
| Uvicorn | 🟡 | X | O | △(--workers, fork) | 표준·빠름 | 프로세스 관리 약함 |
| Gunicorn + uvicorn.workers | 🟡 | X | O(워커 통해) | O | 검증된 프로세스 관리 | HTTP/2 미지원 |
| Hypercorn | 🟡 | O | O | O | HTTP/2·H3 | 사례 적음 |
| Granian | 🟡 | O | O | O | Rust·RSGI·WSGI/ASGI 통합 | 신생 |
| Daphne | 🔵 | X | O | △ | Django Channels 통합 | Channels 외 채택 적음 |

---

