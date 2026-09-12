# 리버스 프록시

> **카테고리**: 외부 HTTPS·HTTP/2/3 종료·정적 파일·로드밸런싱·캐싱·요청 분기 후보 조사
> **연결 spec**: `docs/spec/09_service_design.md` §1

---


> ASGI 서버 앞단에 위치해 외부 HTTPS·HTTP/2/3 종료·정적 파일 서빙·요청 분기(`/api`·`/ai`·`/n8n`)·로드밸런싱·캐싱·rate limit을 담당.
> 사주라 배포 환경(Mac mini + ipTIME DDNS + Docker)에서 리버스 프록시 사용 시 ASGI 서버는 내부망 HTTP/1.1로만 통신하면 됨.

## 1. 전체 후보 목록

웹서버·리버스 프록시 5개 + L7 프록시·서비스 메시 2개 + 캐시 1개 + API Gateway 3개 + Rust 프레임워크 1개 = **총 12개**.

| # | 후보 | 분류 | 주 용도 |
|---|------|------|--------|
| 1 | Nginx | 웹서버·리버스프록시 | 운영 표준 |
| 2 | Caddy | 리버스프록시 | 자동 HTTPS |
| 3 | Apache HTTP Server | 웹서버 | 전통적 |
| 4 | HAProxy | L4/L7 로드밸런서 | 대규모 LB |
| 5 | Traefik | 동적 프록시 | Docker 라벨 라우팅 |
| 6 | OpenResty | Nginx + Lua | 확장형 Nginx |
| 7 | Envoy | L7 프록시 | 서비스 메시 |
| 8 | Pingora | Rust 프레임워크 | Cloudflare 신생 |
| 9 | Varnish | HTTP 캐시 | 캐시 가속 |
| 10 | Kong | API Gateway | OpenResty 기반 |
| 11 | APISIX | API Gateway | OpenResty 기반 |
| 12 | Tyk | API Gateway | Go 단일 바이너리 |

---

## 2. 1차 벤치마크 — 필수 기능 매칭

> 사주라 배포 환경(Mac mini M2 Pro · ipTIME DDNS · Docker · MVP 50매장)에서 리버스 프록시가 반드시 충족해야 할 기능 6개로 채점한다.

### 2.1 채점 표

| # | 후보 | HTTPS 종료 | HTTP/1.1 upstream | 정적 파일 | 경로 라우팅 | HTTP/2 외부 | 즉시 사용 가능 | 결과 |
|---|------|:---------:|:----------------:|:--------:|:----------:|:----------:|:------------:|:----|
| 1 | Nginx | O | O | ◎ | O | O | O | ✅ **통과** |
| 2 | Caddy | **O(자동)** | O | O | O | O | O | ✅ **통과** |
| 3 | Apache | O | O | O | O | O | O | ✅ **통과** |
| 4 | HAProxy | O | O | ⛔(약함) | O | O | O | ⛔ |
| 5 | Traefik | O | O | △ | O | O | O | ✅ **통과** |
| 6 | OpenResty | O | O | O | O(Lua) | O | O | ✅ **통과** |
| 7 | Envoy | O | O | ⛔ | O | O | O | ⛔ |
| 8 | Pingora | △ | △ | △ | △ | O | **⛔(코드)** | ⛔ |
| 9 | Varnish | **⛔(미지원)** | O | ◎ | △ | △ | O | ⛔ |
| 10 | Kong | O | O | ⛔ | O | O | O(+DB) | ⛔ |
| 11 | APISIX | O | O | ⛔ | O | O | O(+etcd) | ⛔ |
| 12 | Tyk | O | O | ⛔ | O | O | O(+Redis) | ⛔ |

### 2.2 판정 기준

| 기능 | 필수도 | 근거 |
|------|-------|------|
| HTTPS 종료 | **필수** | `12_security.md` 외부 통신 TLS 1.2+ 강제 |
| HTTP/1.1 upstream | **필수** | `02_app_server.md` §4.3 Gunicorn 내부 HTTP/1.1 통신 |
| 정적 파일 서빙 | **필수** | PWA (`docs/spec/03_mvp_scope.md`)·이미지 등 정적 자산 |
| 경로 기반 라우팅 | **필수** | `/api/*` → BE, 향후 `/n8n` 등 분기 가능성 |
| HTTP/2 외부 | **필수** | 모바일 PWA 응답 지연 최소화 (`13_performance.md` §1.1) |
| 즉시 사용 가능 (바이너리·이미지) | **필수** | 1인 운영 부담 — 코드 작성형(Pingora) 제외 |

**판정 룰**: 필수 항목 X 1개라도 → 탈락.

### 2.3 탈락 항목 사유 (7개)

- **#4 HAProxy** — L4/L7 LB 특화, 정적 파일 서빙 약함 (Nginx 결합 권장). 50매장 단일 노드 환경에 과함.
- **#7 Envoy** — 서비스 메시 표준이나 정적 파일 미지원, YAML 설정 verbose. 단일 노드 리버스 프록시에 과함.
- **#8 Pingora** — 즉시 사용 가능한 바이너리 아님 (Rust 코드 작성형). 1인 운영 환경에서 무리.
- **#9 Varnish** — **HTTPS 미지원**. 앞단 TLS 종료 필요해 사주라 단일 노드에 부적합.
- **#10 Kong / #11 APISIX / #12 Tyk** — API Gateway 카테고리. 50매장 MVP에 인증·rate limit 플러그인 생태계는 과함. 추가 의존성(DB/etcd/Redis) 운영 부담.

### 2.4 통과 후보 (5개)

| # | 후보 | 핵심 강점 |
|---|------|---------|
| 1 | Nginx | 운영 표준·자료 최다 |
| 2 | Caddy | Let's Encrypt 자동·Caddyfile 단순·HTTP/3 기본 |
| 3 | Apache | 검증·안정 (정적/CGI 전통) |
| 5 | Traefik | Docker 라벨 자동 라우팅 |
| 6 | OpenResty | Nginx + Lua 확장 |

---

## 3. 2차 벤치마크 — 운영 적합성

> 1차 통과 5개 대상. 사주라 배포 환경(Mac mini M2 Pro · ipTIME DDNS · Docker Desktop · 1인 운영 · MVP 50매장) 기준 비교.

### 3.1 평가 기준

| 기준 | 사주라 관점 | 필수도 |
|------|-----------|-------|
| HTTPS 자동 인증서 | ipTIME DDNS 도메인(`*.iptime.org`)에 Let's Encrypt 자동 발급·갱신 필요. 수동 certbot 운영 부담 큼 | **필수** |
| 설정 단순성 | 1인 운영 — Caddyfile 한 줄 vs Nginx server 블록 30+ 줄 차이 큼 | **필수** |
| HTTP/3 (QUIC) | 모바일 PWA에서 회선 품질 낮을 때 이득. 기본 활성 우대 | 중요 |
| Docker 친화 | 공식 이미지·alpine 변종·Compose 통합 | 중요 |
| 한국어/영문 자료 | 1인 운영 시 디버깅 자료 중요 | 중요 |
| 정적 파일 효율 | PWA 자산 (gzip/brotli·캐시) | 중요 |
| 학습 곡선 | BE 팀(2명) 온보딩 비용 | 중요 |

### 3.2 평가 표

| # | 후보 | HTTPS 자동 | 설정 단순성 | HTTP/3 | Docker | 자료 | 정적 파일 | 학습 곡선 | 결과 |
|---|------|:---------:|:----------:|:------:|:-----:|:----:|:--------:|:--------:|:----|
| 1 | Nginx | ⛔(certbot 별도) | △(verbose) | △(1.25+ 별도 설정) | ◎ | ◎ | ◎ | △ | ⛔ HTTPS 자동 부재 |
| 2 | Caddy | **◎(내장)** | **◎(1줄)** | **◎(기본 활성)** | ◎ | O | O | ◎ | ✅ **통과** |
| 3 | Apache | ⛔(certbot 별도) | ⛔(verbose) | ⛔(미지원) | O | O | O | △ | ⛔ HTTP/3·자동화 부재 |
| 5 | Traefik | ◎(내장) | △(라벨·CRD 분산) | O | ◎(라벨 자동) | O | △ | △ | ⛔ 컨테이너 5개 환경에 과함 |
| 6 | OpenResty | ⛔(Lua acme 별도) | ⛔(Lua 학습) | △ | O | △ | ◎ | ⛔ | ⛔ 과한 수준 |

### 3.3 탈락 항목 사유 (4개)

- **#1 Nginx** — 운영 표준이지만 **HTTPS 자동 부재**가 결정적. certbot 또는 acme.sh를 별도 컨테이너로 운영해야 하고 ipTIME DDNS의 HTTP-01 검증 시 80 포트 트래픽을 Nginx와 분점하는 설정이 까다로움. 1인 운영 환경에선 Caddy 대비 운영 부담 큼. **2단계 이후 처리량·정적 캐시 튜닝이 필요해지면 재평가 후보**로 보존.
- **#3 Apache** — HTTP/3 미지원, 설정 verbose, 현대적 리버스 프록시 표준에서 이탈. 채택 이유 없음.
- **#5 Traefik** — Docker 라벨 자동 라우팅이 강점이나 사주라 컨테이너 5개(BE / MySQL / Redis / n8n / Caddy) 환경에선 라벨 자동의 이점이 작음. 설정이 파일·라벨·CRD로 흩어져 디버깅 추적성 낮음. 정적 파일 약함.
- **#6 OpenResty** — Nginx + Lua 확장. 본 프로젝트에 Lua 커스텀 로직 필요 없음. 학습 비용 과함.

### 3.4 통과 후보 (1개)

| # | 후보 | 결정 |
|---|------|------|
| 2 | Caddy | ✅ **단일 통과** |

---

## 4. 최종 선발

**Caddy v2** ✅ 확정.

| 결정 사유 | 내용 |
|----------|------|
| HTTPS 자동화 | Let's Encrypt 발급·갱신·OCSP stapling 내장. ipTIME DDNS 도메인 한 줄로 HTTPS. 1인 운영 부담 최소 |
| 설정 단순성 | Caddyfile 5~10줄로 HTTPS + reverse_proxy + 정적 파일 + 압축 + HTTP/3 모두 구성 가능 |
| HTTP/2·HTTP/3 기본 활성 | 모바일 PWA 회선 품질 변동에 강함. 별도 설정 불필요 |
| `02_app_server.md` 정합 | §3 전제 "리버스 프록시가 외부 HTTPS·HTTP/2/3 종료 담당", §4.3 `--keepalive 5` upstream과 짝맞춤 |
| Docker 친화 | 공식 `caddy:alpine` 이미지, Compose 통합 사례 풍부 |
| 메모리 footprint | < 50 MB, M2 Pro 16GB 예산에 부담 없음 (`02_app_server.md` §4.1) |
| 단점 보완 | 한국어 자료 적음 → 영문 공식 문서가 잘 정리됨, 단순한 사용 패턴이라 학습 비용 작음 |

### 4.1 운영 옵션 권장값

> Caddyfile 정량값. spec(`09_service_design.md` §1·`13_performance.md`) 의존성과 함께 정리.

| 항목 | 권장값 | 사주라 적용 근거 |
|------|------|---------------|
| 도메인 | `<sub>.iptime.org` (ipTIME DDNS) | MVP 환경 가정. 실 도메인 확정 시 갱신 |
| TLS 발급 | Let's Encrypt HTTP-01 (자동) | ipTIME 라우터에서 80·443 포트 포워딩 필수 |
| TLS 버전 | **TLS 1.3 강제** (`tls { protocols tls1.3 }`) | `12_security.md` §4 "TLS 1.3 적용" 정책 정합. Caddy 기본은 1.2+이므로 명시적 제한 필요 |
| `reverse_proxy` | `localhost:8000` 또는 `be:8000` | Gunicorn (`02_app_server.md` §4.3 `--bind`) |
| `transport http { keepalive }` | **5s** | Gunicorn `--keepalive 5`와 정합 |
| `transport http { dial_timeout }` | **5s** | upstream 연결 실패 빠른 감지 |
| `transport http { read_timeout }` | **65s** | Gunicorn `--timeout 60`보다 5초 길게 두어 워커 강제종료 응답을 받을 시간 확보 |
| `transport http { write_timeout }` | **65s** | 위와 동일 사유 |
| 요청 본문 크기 제한 | **10 MB** | `POST /api/sales/upload` CSV 업로드 상한. `13_performance.md` 확인 후 조정 |
| `encode` | `zstd gzip` | Caddy v2 `encode` 디렉티브. zstd 우선, gzip fallback |
| HTTP/2 | 활성 (기본) | 모바일 PWA 응답 |
| HTTP/3 (QUIC) | 활성 (기본) | UDP 443 ipTIME 포워딩 필요 |
| `header_up X-Forwarded-For` | `{remote_host}` | BE에서 클라이언트 IP 추출 |
| `header_up X-Forwarded-Proto` | `{scheme}` | BE Redirect 시 https 보존 |
| 액세스 로그 | JSON 구조화, stdout | `07_cache_observability.md` 로깅 표준과 연결 |
| rate limit | 미적용 (MVP) | API Gateway 카테고리에 위임 안 함. 필요 시 `caddy-ratelimit` 플러그인 |
| 정적 파일 | `file_server` (PWA 자산) | `/` 경로 → PWA dist 디렉터리 |
| 경로 라우팅 | `handle /api/* → reverse_proxy be:8000`, `handle /* → file_server` | BE와 PWA 분기 |

**Caddyfile 예시** (MVP 운영):

```caddy
{
    # 글로벌 옵션
    email admin@example.com
    log {
        output stdout
        format json
    }
}

<sub>.iptime.org {
    tls {
        protocols tls1.3
    }

    # 보안 헤더 (`05_auth_security.md` §3.5 + CSP 상세는 `docs/research/frontend/08_auth_security.md` §3.4)
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Frame-Options "DENY"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "geolocation=(), microphone=(), camera=(), payment=()"
        # CSP — PWA(SW·manifest) + Tailwind + shadcn/ui(Radix) + Recharts 정합.
        # script-src 'self' (Vite 빌드 inline 없음) / style-src 'self' 'unsafe-inline' (Radix·Recharts inline style 호환).
        # blob:은 카메라 미리보기 등 PWA 정합. 외부 이미지 차단(`https:` 제외).
        Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://*.ingest.sentry.io; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests"
    }

    encode zstd gzip

    # PWA 정적 파일
    handle /api/* {
        reverse_proxy be:8000 {
            transport http {
                keepalive 5s
                dial_timeout 5s
                read_timeout 65s
                write_timeout 65s
            }
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
        }
    }

    handle {
        root * /var/www/pwa
        try_files {path} /index.html
        file_server
    }

    # 요청 본문 크기 제한 (CSV 업로드)
    request_body {
        max_size 10MB
    }
}
```

### 4.2 ipTIME DDNS + Let's Encrypt 운영 주의

| 항목 | 내용 |
|------|------|
| 포트 포워딩 | ipTIME 라우터에서 80·443 (TCP) + 443 (UDP, HTTP/3) 포워딩 |
| HTTP-01 검증 | 80 포트가 Caddy로 라우팅되어 있어야 함. 별도 서버 점유 금지 |
| 인증서 갱신 주기 | Let's Encrypt 60일마다 자동 갱신 시도 (만료 30일 전) |
| Rate limit | Let's Encrypt 도메인당 주 50회 발급 한도. 개발 중 잦은 재발급 시 `acme_ca https://acme-staging-v02.api.letsencrypt.org/directory` 사용 |
| 인증서 영속화 | Caddy 데이터 디렉터리(`/data/caddy`)를 Docker volume으로 마운트 — 컨테이너 재기동 시 재발급 방지 |
| DDNS IP 변경 | ipTIME DDNS는 라우터에서 자동 갱신. Caddy는 도메인 기반으로 검증하므로 IP 변경 자체엔 영향 없음 |

### 4.3 Nginx 재평가 트리거 (보존 후보)

§3.3에서 Nginx를 "처리량·정적 캐시 튜닝 필요 시 재평가"로 보존. 트리거 정량값:

| 지표 | 임계치 | 근거 |
|------|------|------|
| Caddy CPU 사용률 | 평균 > 50% (5분 평균) | Caddy 처리 한계 신호 |
| 정적 자산 캐시 hit율 | < 80% | Caddy `file_server` 기본 캐시 한계 |
| TLS 핸드셰이크 지연 | p95 > 100ms | Caddy → Nginx + nghttp2/boringssl 튜닝 검토 |

→ 2개 이상이 1주 지속되면 Nginx로 재평가.

---

## 5. 후보 세부 정보

### 5.1 Nginx 🟡
- **사용처**: 가장 광범위하게 채택된 웹서버/리버스프록시. HTTPS 종료·정적 파일·로드밸런싱·HTTP/2.
- **장점**:
  - 검증·안정·운영 사례 최다 (전 세계 웹사이트 30%+ 점유)
  - 자료·서드파티 모듈 풍부 (한국어 자료도 많음)
  - 정적 파일 서빙 효율 매우 좋음 (sendfile·캐시)
  - 로드밸런싱·캐싱·gzip·brotli·rate limit 기본 제공
  - HTTP/2 지원 (1.13.9+), HTTP/3 지원 (1.25+)
  - C 구현으로 매우 빠름
- **단점**:
  - **HTTPS 인증서 자동 발급·갱신은 별도** (`certbot`·`acme.sh` 등 외부 도구 필요)
  - 설정 파일이 verbose
  - 동적 설정 변경 시 reload 필요 (graceful reload는 지원)
  - HTTP/3 구성이 비교적 복잡
- **세부사항**: 라이선스 BSD-2. nginx.org(F2 산하 → F5 Networks 인수). 공식 Docker 이미지 `nginx:alpine`/`nginx:latest`.

### 5.2 Caddy 🟡
- **사용처**: HTTPS 자동화가 핵심 요구일 때의 리버스 프록시. 정적 파일 서빙·HTTP/2/3.
- **장점**:
  - **Let's Encrypt 자동 발급·갱신·OCSP stapling 내장** (설정 불필요)
  - Caddyfile 설정이 매우 단순 — 한 줄로 HTTPS 가능
    ```
    abc.iptime.org {
        reverse_proxy localhost:8000
    }
    ```
  - **HTTP/2·HTTP/3 (QUIC) 기본 활성** (별도 설정 불필요)
  - Go 단일 바이너리, 의존성 없음
  - JSON·Caddyfile·Admin API 세 가지 설정 모드
  - Docker 친화적 (`caddy/caddy` 공식 이미지)
  - v2 안정화 이후 활발한 커뮤니티
- **단점**:
  - Nginx 대비 서드파티 모듈·튜닝 옵션 적음 (단, 일반 용도엔 충분)
  - 한국어 자료 적음 (영문 공식 문서는 잘 정리됨)
  - 극한 처리량 벤치에서 Nginx 대비 10~20% 열세 (대부분 환경에서 무관한 차이)
  - Let's Encrypt rate limit 주의 (개발 중 잦은 재발급 시 staging 환경 권장)
- **세부사항**: 라이선스 Apache 2.0. Stack Holdings/ZeroSSL. Go. v2.x.

### 5.3 Apache HTTP Server (httpd) 🔵
- **사용처**: 전통적 웹서버. PHP·CGI·`mod_wsgi` 통합이 필요한 레거시 환경.
- **장점**:
  - 가장 오래된 웹서버 (1995~), 검증·안정
  - `.htaccess` 동적 설정으로 디렉터리별 정책 가능
  - 다중 처리 모드(prefork/worker/event)
  - 광범위 모듈 생태계 (`mod_security`·`mod_ssl` 등)
- **단점**:
  - 정적 파일·동시 연결 처리 효율 Nginx 대비 낮음
  - 설정 파일 verbose, 학습 비용
  - 현대적 리버스 프록시 용도로는 Nginx·Caddy 선호 추세
  - HTTP/3 미지원 (2026 현재)
- **세부사항**: 라이선스 Apache 2.0. Apache Software Foundation.

### 5.4 HAProxy 🟡
- **사용처**: L4/L7 로드밸런서. 대규모 트래픽·고가용성 분산.
- **장점**:
  - 매우 빠른 L4(TCP)/L7(HTTP) 로드밸런싱
  - 정교한 헬스체크·session affinity(stick table)·SSL 종료
  - 통계 대시보드 내장
  - 대규모 사이트 검증 (GitHub·Stack Overflow 등)
  - HTTP/2 지원 (2.0+), HTTP/3 지원 (2.6+, 실험적)
- **단점**:
  - **정적 파일 서빙 약함** (Nginx 결합 권장)
  - 설정 파일 학습 곡선 가파름
  - HTTPS 인증서 자동화 별도 (lua-resty-acme·certbot 결합)
  - 단순 단일 서비스 리버스 프록시에는 과한 수준
- **세부사항**: 라이선스 GPL 2.0. HAProxy Technologies. 2.x.

### 5.5 Traefik 🟡
- **사용처**: Docker·Kubernetes 환경에서 컨테이너 라벨 기반 자동 라우팅.
- **장점**:
  - **Docker 라벨 / K8s Ingress 기반 자동 서비스 디스커버리** — 컨테이너 추가 시 라벨만 달면 자동 라우팅
  - Let's Encrypt 자동 발급·갱신
  - HTTP/2·HTTP/3·gRPC 지원
  - K8s Ingress·CRD 표준 지원
  - 웹 대시보드 내장 (실시간 라우팅 시각화)
  - Compose·Swarm·K8s·Consul·Etcd 등 다양한 공급자
- **단점**:
  - Nginx·Caddy 대비 절대 처리량 약간 낮음
  - 동적 구성의 추적성 낮음 — 디버깅이 까다로움
  - 설정 분리(파일·라벨·CRD)로 단일 진실원 관리 어려움
- **세부사항**: 라이선스 MIT. Traefik Labs. Go. v2/v3.

### 5.6 OpenResty 🔵
- **사용처**: Nginx의 모든 기능 + Lua 스크립트로 커스텀 로직 임베드. CDN 엣지·API Gateway 기반.
- **장점**:
  - Nginx의 모든 장점 그대로 + Lua 확장
  - 매우 빠른 요청 처리·복잡 로직(인증·rate limit 등) 인-서버 구현 가능
  - Kong·APISIX의 기반
- **단점**:
  - Lua 학습 필요
  - 본 프로젝트 규모에 과한 수준
  - 단순 리버스 프록시 용도엔 Nginx로 충분
- **세부사항**: 라이선스 BSD-2. OpenResty Inc.

### 5.7 Envoy 🔵
- **사용처**: L7 프록시·서비스 메시(Istio·Consul Connect) 데이터 플레인. gRPC·HTTP/2/3 중심 인프라.
- **장점**:
  - 매우 강력한 L7 프록시 기능 (gRPC·HTTP/2·HTTP/3 1급 지원)
  - xDS API로 동적 구성 (런타임 라우팅 변경)
  - 서비스 메시 표준 (Istio·Consul·Gloo)
  - Cloud Native 표준
  - 매우 풍부한 observability (트레이싱·메트릭)
- **단점**:
  - 학습 곡선 매우 가파름
  - 단순 리버스 프록시 용도엔 과함
  - 메모리·리소스 사용량 큼
  - YAML 설정 verbose
- **세부사항**: 라이선스 Apache 2.0. Lyft 시작 → CNCF Graduated. C++.

### 5.8 Pingora 🔵
- **사용처**: Cloudflare가 자사 글로벌 프록시(수조 요청/일)를 Nginx에서 교체하기 위해 만든 Rust 기반 프록시 프레임워크.
- **장점**:
  - Rust 기반 — 매우 빠르고 메모리 안전
  - Cloudflare 운영 검증 (수조 요청/일 처리)
  - 비동기 Rust 생태계 (tokio)
  - 무중단 reload·zero-downtime upgrade
- **단점**:
  - **프레임워크(라이브러리) — 즉시 사용 가능한 바이너리 아님 → Rust 코드 작성 필요**
  - 매우 신생 (2024 OSS 공개)
  - 한국어 자료 거의 없음
  - 본 프로젝트 규모에 과한 수준
- **세부사항**: 라이선스 Apache 2.0. Cloudflare. 2024년 OSS 공개.

### 5.9 Varnish 🔵
- **사용처**: HTTP 캐시 가속 전용. 정적·반정적 응답 캐싱.
- **장점**:
  - 매우 빠른 HTTP 캐시 (메모리 기반)
  - VCL 스크립트로 캐시 로직 표현
  - 대형 미디어·뉴스 사이트 채택
  - 캐시 hit 비율 최대화 전략
- **단점**:
  - **HTTPS 미지원**(앞단에 별도 TLS 종료 필요 — Hitch·Nginx·HAProxy)
  - 리버스 프록시 단독 사용엔 부적합 (캐시 전용)
- **세부사항**: 라이선스 BSD-2. Varnish Cache Project.

### 5.10 Kong 🔵
- **사용처**: API Gateway. 인증·rate limit·로깅·플러그인 기반 API 운영.
- **장점**:
  - OpenResty 기반 API Gateway
  - 플러그인 풍부 (JWT·OAuth·Rate Limit·CORS·로깅 등)
  - 관리자 API·UI
  - K8s Ingress Controller 제공
  - Enterprise 기능 다수
- **단점**:
  - PostgreSQL 또는 Cassandra 의존성 (Kong DB-less 모드 별도)
  - 단순 리버스 프록시에 과한 수준
  - OSS/Enterprise 기능 차이 큼
- **세부사항**: 라이선스 Apache 2.0(OSS). Kong Inc.

### 5.11 APISIX 🔵
- **사용처**: Kong 대안의 클라우드 네이티브 API Gateway.
- **장점**:
  - OpenResty 기반·동적 구성
  - etcd 의존성 (PostgreSQL 불필요 → 가벼움)
  - 플러그인 풍부 (50+)
  - ASF 산하 안정적 운영
- **단점**:
  - 본 프로젝트 규모에 과한 수준
  - etcd 추가 운영 부담
- **세부사항**: 라이선스 Apache 2.0. Apache Software Foundation.

### 5.12 Tyk 🔵
- **사용처**: API Gateway 대안. 단일 바이너리 운영.
- **장점**:
  - Go 단일 바이너리
  - Redis 의존성만 필요 (가벼움)
  - 무료/상용 이중 라이선스
- **단점**:
  - Kong·APISIX 대비 채택률 낮음
  - 본 프로젝트 규모에 과한 수준
- **세부사항**: 라이선스 MPL 2.0(OSS). Tyk Technologies.

---

## 6. 비교 표

| # | 항목 | HTTPS 자동 | HTTP/2 | HTTP/3 | 정적 파일 | 동적 라우팅 | 의존성 | 본 프로젝트 적합도 |
|---|------|:---------:|:------:|:------:|:--------:|:----------:|--------|:----------------:|
| 1 | Nginx | X(certbot 별도) | O | O(1.25+) | ◎ | △ | 없음 | ◎ |
| 2 | Caddy | **O(내장)** | O | **O(기본)** | O | △ | 없음 | **◎ 확정 (§4)** |
| 3 | Apache | X | O | X | O | △ | 없음 | ○ |
| 4 | HAProxy | X | O | △(2.6+) | X | △ | 없음 | △ (LB 특화) |
| 5 | Traefik | O | O | O | △ | **O(Docker 라벨)** | 없음 | ○ |
| 6 | OpenResty | X | O | △ | O | O(Lua) | 없음 | △ (과한 수준) |
| 7 | Envoy | X | O | O | X | O(xDS) | 없음 | △ (과한 수준) |
| 8 | Pingora | △(코드) | O | O | △(코드) | △(코드) | Rust 빌드 | ⛔ (프레임워크) |
| 9 | Varnish | **X(미지원)** | △ | X | ◎(캐시) | △ | 없음 | ⛔ (HTTPS 불가) |
| 10 | Kong | O | O | O | X | O | PostgreSQL/etcd | △ (과한 수준) |
| 11 | APISIX | O | O | △ | X | O | etcd | △ (과한 수준) |
| 12 | Tyk | O | O | △ | X | O | Redis | △ (과한 수준) |

> ◎ 매우 적합 / O 적합 / △ 부분 적합 / X 부적합 / ⛔ 사용 불가
> "본 프로젝트 적합도"는 사주라 환경(Mac mini M2 Pro 16GB + Docker + 단일 노드 + MVP 50매장 + Authlib + FastAPI + PWA) 기준. §4에서 Caddy 확정.

---

