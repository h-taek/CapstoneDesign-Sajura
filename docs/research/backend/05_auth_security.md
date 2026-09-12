# 인증 · 암호화 · 시크릿 · 보안 부가

> **카테고리**: OAuth/JWT/비밀번호 라이브러리, 암호화·시크릿 관리, 보안 부가 미들웨어
> **연결 spec**: `docs/spec/12_security.md`, `docs/spec/09_service_design.md` §1

---

## 0. 카테고리 구성 & spec 매핑

| 하위 카테고리 | 후보 수 | 연결 spec 섹션 | 결정 항목 수 |
|------------|--------|--------------|------------|
| §1 인증 (OAuth · JWT · 비밀번호) | 11 | `12_security.md` §2 | 3 (OAuth / JWT / 해싱) |
| §2 암호화 · 시크릿 | 7 | `12_security.md` §4 | 2 (대칭 암호 라이브러리 / 시크릿 로딩) |
| §3 보안 부가 | 5 | `12_security.md` §5, §7 | 2 (응답 헤더 / 의존성 스캔) |

### 본 research가 결정한 라이브러리 (spec 반영)

본 문서는 23개 후보를 평가해 4개 라이브러리를 채택한다. 채택 사유는 각 카테고리 §1.4 / §2.4 / §3.4에 정량 근거와 함께 정리.

| 라이브러리 | 카테고리 | 결정 근거 위치 | spec 반영 위치 |
|----------|---------|--------------|--------------|
| Authlib | OAuth | §1.2 OAuth 1차 벤치 + §1.4 | `09_service_design.md` §1, `12_security.md` §2.1 |
| python-jose | JWT | §1.2 JWT 1차 벤치 + §1.4 | `09_service_design.md` §1, `12_security.md` §2.3 |
| passlib[bcrypt] | 해싱 | §1.2 해싱 1차 벤치 + §1.4 | `09_service_design.md` §1, `12_security.md` §2.2 |
| **cryptography** | 대칭 암호·JWT 백엔드 | §2.2 1차 벤치 + §2.4 | `09_service_design.md` §1 (신규 행), `12_security.md` §4.1 적용 |

> 보존(probe-dependent 재평가) 후보: PyJWT(§1.5), argon2-cffi(§1.5), HashiCorp Vault(§2.5).

---

## 1. 인증 (OAuth · JWT · 비밀번호)

### 1.1 전체 후보 목록

OAuth 4개 + JWT 4개 + 해싱 3개 = **총 11개**.

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | Authlib | OAuth | OAuth 1.0/2.0/OIDC 표준 일체 |
| 2 | python-social-auth | OAuth | 한국 포함 다수 백엔드 |
| 3 | Google Auth Library | OAuth(공급자) | Google 공식 SDK |
| 4 | Kakao REST(httpx) | OAuth(공급자) | Kakao 공식 Python SDK 없음 |
| 5 | python-jose | JWT | JWS/JWE/JWK/JWT 일체 |
| 6 | PyJWT | JWT | 가벼움·활발한 유지보수 |
| 7 | jwcrypto | JWT/JWE | 표준 충실 |
| 8 | authx | JWT 헬퍼 | FastAPI 친화 |
| 9 | passlib[bcrypt] | 해싱 | 알고리즘 회전 추상 |
| 10 | argon2-cffi | 해싱 | OWASP 권장 |
| 11 | bcrypt(직접) | 해싱 | 추상화 없이 단순 |

> fastapi-users는 사용자 모델·등록·로그인 통합 패키지로 사주라의 자체 JWT·온보딩 흐름과 추상화 충돌 → 후보 외 제외 (참고: 본 문서 §5.13).

### 1.2 1차 벤치마크 — 필수 기능

| # | 후보 | Google | 카카오 | OAuth state·PKCE | async·FastAPI | 사주라 자체 흐름 정합 | 결과 |
|---|------|:-----:|:------:|:----------------:|:-------------:|:------------------:|:----|
| 1 | Authlib | ◎ | O(커스텀 매핑) | ◎ | ◎ | ◎ | ✅ **통과 (OAuth)** |
| 2 | python-social-auth | O | O | △ | ⛔(Django·Flask 중심) | △ | ⛔ |
| 3 | Google Auth Library | ◎(Google 한정) | ⛔(미지원) | △ | △ | ⛔(Authlib 중복) | ⛔ |
| 4 | Kakao REST(httpx) | ⛔ | ◎(직접) | ⛔(직접) | ◎ | △(Authlib과 흐름 중복) | ⛔ |

| # | 후보 | HS256 | RS256·ES256 | 활발 유지보수 | Refresh Rotation 패턴 적합 | 결과 |
|---|------|:-----:|:----------:|:-----------:|:------------------------:|:----|
| 5 | python-jose | O | O | △(2024 이후 둔화) | ◎(claim·exp·iss 모두 표준) | ✅ **통과 (JWT, 단 PyJWT 재평가)** |
| 6 | PyJWT | O | O(`[crypto]`) | ◎(활발) | ◎ | 🟡 **보존 (재평가 후보)** |
| 7 | jwcrypto | O | O | O | △(JWE 미사용 — 본 프로젝트는 JWS만) | ⛔ |
| 8 | authx | O(헬퍼) | O | △(채택 적음) | △(Rotation·HttpOnly Cookie 흐름 자체 구현이 더 명확) | ⛔ |

| # | 후보 | OWASP 권장 | 알고리즘 회전 | 추상화 | 사주라 적용 비용 | 결과 |
|---|------|:----------:|:-----------:|:------:|:--------------:|:----|
| 9 | passlib[bcrypt] | O(bcrypt 허용) | ◎(자동) | ◎ | 낮음 | ✅ **통과 (해싱)** |
| 10 | argon2-cffi | ◎(가장 권장) | △(passlib 경유) | △ | 중간 | 🟡 **보존 (재평가 후보)** |
| 11 | bcrypt(직접) | O | ⛔(수동) | ⛔ | 낮음 | ⛔ (passlib이 우위) |

### 1.3 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| Google + 카카오 OAuth | **필수** | `12_security.md` §2.1 / `04_feature_spec.md` §1.1 |
| OAuth state·PKCE·nonce | **필수** | OAuth 2.0 표준 + CSRF·인가코드 가로채기 방어 |
| async FastAPI 통합 | **필수** | `02_app_server.md` §4.1 I/O bound |
| JWT RS256/HS256 | **필수** | Access Token 서명 (`12_security.md` §2.3) |
| OWASP 권장 해시 | **필수** | bcrypt 또는 argon2 |
| 알고리즘 회전 추상화 | 중요 | 미래 해시 알고리즘 교체 대비 |

**탈락 사유:**

- **#2 python-social-auth** — Django·Flask 중심 설계, async 통합 약함. FastAPI에 부적합.
- **#3 Google Auth Library** — Google 전용. 카카오 미지원으로 Authlib과 이중 통합 필요.
- **#4 Kakao REST 직접 호출** — Authlib에 카카오 커스텀 매핑으로 통합 가능. 직접 호출은 state·PKCE를 수동 구현해야 함.
- **#7 jwcrypto** — JWE 표준 충실하나 사주라는 JWT 서명만 사용(JWE 미사용). API 복잡도만 증가.
- **#8 authx** — FastAPI 친화적이나 채택 적고 spec의 자체 토큰 흐름을 직접 구현하는 게 더 명확.
- **#11 bcrypt 직접** — passlib이 같은 bcrypt를 사용하면서 알고리즘 회전·deprecation 관리를 추상화 → passlib 우위.

### 1.4 최종 선발

| 역할 | 선택 | 비고 |
|------|------|------|
| **OAuth (Google/카카오)** | **Authlib** ✅ | `authlib.integrations.starlette_client.OAuth`. 카카오는 OIDC 비표준이라 manual config 매핑 필요 |
| **JWT** | **python-jose** ✅ | `python-jose[cryptography]` (RS256/HS256). JWS·JWE·JWK·JWT 모두 지원하며 `12_security.md` §2.3 Refresh Token Rotation 흐름의 claim·exp·iss·jti 표준 처리. PyJWT는 §1.5 재평가 후보 보존 |
| **비밀번호 해싱** | **passlib[bcrypt]** ✅ | bcrypt 4.x 핀 고정 권장. argon2 재평가 보존 |

### 1.5 보존 후보 (재평가 트리거)

**PyJWT (JWT 대체 후보)**

| 지표 | 임계치 |
|------|------|
| python-jose 최근 커밋·릴리스 | 12개월 이상 무활동 |
| python-jose CVE 발견 | 1건 이상 미해결 |
| Refresh Token 토큰 클레임 확장 요구 | JWE 등 추가 기능 필요 시 |

→ 1개 이상 발생 시 PyJWT 전환 검토 (HS256/RS256 마이그레이션, JWT 서명 키 회전 절차 포함).

**argon2-cffi (해싱 대체 후보)**

| 지표 | 임계치 |
|------|------|
| OWASP Top 10 / ASVS 권장 변경 | bcrypt 제외 권장 |
| 비밀번호 정책 강화 요구 | 운영 정책 변경 |
| GPU 공격 사례 보고 | bcrypt 안전성 의문 발생 |

→ 1개 이상 발생 시 passlib 내 `argon2` schema로 알고리즘 전환 (passlib이 자동 마이그레이션 지원).

---

## 2. 암호화 · 시크릿

### 2.1 전체 후보 목록

대칭 암호 라이브러리 2개 + 로컬 시크릿 로딩 2개 + 시크릿 매니저 3개 = **총 7개**.

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | cryptography | 라이브러리 | pyca 표준 |
| 2 | PyNaCl | 라이브러리 | libsodium 바인딩 |
| 3 | python-dotenv | 로컬 로딩 | `.env` 파일 |
| 4 | pydantic-settings | 로컬 로딩 | Pydantic 통합 (04 확정) |
| 5 | HashiCorp Vault | 시크릿 매니저 | 중앙 관리·회전 |
| 6 | AWS Secrets Manager | 시크릿 매니저 | AWS 매니지드 |
| 7 | sops + age | Git 시크릿 | 암호화된 파일 보관 |

### 2.2 1차 벤치마크 — 필수 기능

| # | 후보 | AES-256-GCM | python-jose 백엔드 | FIPS 옵션 | MVP 운영 부담 | 결과 |
|---|------|:----------:|:----------------:|:--------:|:-----------:|:----|
| 1 | cryptography | ◎ | ◎ | O(OpenSSL FIPS) | 낮음 | ✅ **통과 (대칭 암호)** |
| 2 | PyNaCl | △(SecretBox = XSalsa20-Poly1305) | ⛔ | ⛔ | 낮음 | ⛔ |

| # | 후보 | 환경변수 통합 | 타입 안전 | 회전 | MVP 적합 | 결과 |
|---|------|:-----------:|:--------:|:----:|:-------:|:----|
| 3 | python-dotenv | ◎ | ⛔ | ⛔ | △(pydantic-settings에 포함) | ⛔ |
| 4 | pydantic-settings | ◎ | ◎ | ⛔ | ◎ | ✅ **통과 (시크릿 로딩, 04 확정)** |

| # | 후보 | 동적 회전 | 감사 로그 | 운영 부담 | MVP 적합 | 결과 |
|---|------|:--------:|:--------:|:-------:|:-------:|:----|
| 5 | HashiCorp Vault | ◎ | ◎ | 큼 | ⛔(MVP 과함) | 🟡 **보존 (2단계 재평가)** |
| 6 | AWS Secrets Manager | ◎ | ◎ | 매니지드 | ⛔(사주라는 AWS 미사용 — Mac mini 자체 운영) | ⛔ |
| 7 | sops + age | ⛔ | △ | 중간 | ⛔(MVP는 환경변수로 충분) | ⛔ |

### 2.3 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| AES-256-GCM | **필수** | `12_security.md` §4.1 `pos_connections.api_key` 적용 대상 |
| python-jose `[cryptography]` 백엔드 | **필수** | JWT RS256·ES256 서명 |
| 환경변수·`.env` 통합 | **필수** | 운영 컨테이너 시크릿 주입 |
| 회전 가능 | 중요 | MVP는 수동 회전 허용 |

**탈락 사유:**

- **#2 PyNaCl** — libsodium 안전 기본값은 매력적이나 AES-GCM 직접 지원이 약함(SecretBox는 XSalsa20-Poly1305). spec이 AES-256 명시이므로 cryptography 우위.
- **#3 python-dotenv** — 단독 사용 시 타입 안전 없음. pydantic-settings가 내부적으로 dotenv를 통합하므로 별도 추가 불필요.
- **#6 AWS Secrets Manager** — 사주라 운영 환경은 Mac mini 자체 운영(AWS 미사용). 도입 필연성 없음.
- **#7 sops + age** — GitOps 친화적이나 MVP는 `.env` + Docker secret으로 충분. 회전·접근 정책 별도 구축 부담.

### 2.4 최종 선발

| 역할 | 선택 | 비고 |
|------|------|------|
| **대칭 암호 (AES-256-GCM)** | **cryptography** ✅ | `cryptography.hazmat.primitives.ciphers.aead.AESGCM`. 키는 환경변수 → pydantic-settings 로딩 |
| **JWT 백엔드** | **cryptography** (python-jose extras) | `python-jose[cryptography]` 설치 |
| **해시 (token_hash)** | Python 표준 `hashlib.sha256` | `12_security.md` §4.1 SHA-256 — 외부 라이브러리 불필요 |
| **시크릿 로딩** | **pydantic-settings** ✅ | 04에서 확정 |

### 2.5 보존 후보 (재평가 트리거)

**HashiCorp Vault (시크릿 매니저)**

| 지표 | 임계치 |
|------|------|
| 매장 수 | ≥ 300 (2단계) |
| POS 키 수동 회전 빈도 | 분기 1회 이상 |
| 감사·컴플라이언스 요구 | ISMS-P·SOC2 등 |

→ 1개 이상 발생 시 Vault(또는 OpenBao) 도입 검토. KV·Transit 엔진으로 POS 키 회전 자동화.

---

## 3. 보안 부가

### 3.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | pip-audit | 의존성 취약점 | PyPA 공식 |
| 2 | OWASP Dependency-Check | 의존성 취약점 | 다언어 |
| 3 | secure 미들웨어 | HTTP 보안 헤더 | FastAPI 미들웨어 |
| 4 | python-keycloak | RBAC | OIDC 통합 |
| 5 | Casbin (pycasbin) | RBAC/ABAC | 정책 파일 |

### 3.2 1차 벤치마크 — 필수 기능

| # | 후보 | CI 통합 | 사주라 적용 비용 | 위치 | 결과 |
|---|------|:------:|:--------------:|:----:|:----|
| 1 | pip-audit | ◎ | 낮음 | `09_testing_quality.md`에서 정의 | 🔗 **위임** |
| 2 | OWASP Dependency-Check | ◎ | 중간(Java 의존) | — | ⛔ (pip-audit이 Python 한정으로 충분) |
| 3 | secure 미들웨어 | — | 낮음 (1줄) but Caddy로 처리 가능 | — | ⛔ (Caddy 응답 헤더로 대체) |
| 4 | python-keycloak | — | 큼 (Keycloak 운영) | — | ⛔ (단일 역할 점주에 과함) |
| 5 | Casbin | — | 큼 (정책 모델 학습) | — | ⛔ (단일 역할 점주에 과함) |

### 3.3 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| 의존성 취약점 스캔 | **필수** | `12_security.md` §7 외부 라이브러리 라이선스·취약점 검토 |
| HTTP 보안 헤더 (HSTS·X-Frame·CSP) | **필수** | OWASP 권장 |
| RBAC 정책 엔진 | 참고 | `12_security.md` §5.1 — MVP는 단일 역할 점주 |

**탈락 사유:**

- **#2 OWASP Dependency-Check** — 다언어 지원이 강점이나 사주라는 Python·JS 한정. pip-audit이 가벼움.
- **#3 secure 미들웨어** — HSTS·X-Frame-Options·Referrer-Policy를 Caddyfile `header` 디렉티브로 한 블록 처리 가능. FastAPI 미들웨어 추가 시 BE 응답마다 헤더 추가 비용 발생. **Caddy 엣지에서 처리하는 게 책임 분리에 맞음.**
- **#4 python-keycloak / #5 Casbin** — 단일 역할(점주)에 과한 도입. `12_security.md` §5.1 RBAC는 "추후 확장".

### 3.4 최종 선발

| 역할 | 선택 | 위치 |
|------|------|------|
| **의존성 취약점 스캔** | **pip-audit** ✅ | `09_testing_quality.md` §2에서 정의. CI에 통합 |
| **HTTP 보안 헤더** | **Caddy `header` 디렉티브** ✅ | `03_reverse_proxy.md` §4에 추가 가능 |
| RBAC 정책 엔진 | (미채택) | MVP 단일 역할, 추후 확장 시 재평가 |

### 3.5 Caddy 보안 헤더 권장값

`03_reverse_proxy.md` §4.1 Caddyfile에 다음 블록 추가 권장:

```caddy
header {
    # HSTS — 외부 HTTPS 강제
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    # Clickjacking 방어
    X-Frame-Options "DENY"
    # MIME 스니핑 방지
    X-Content-Type-Options "nosniff"
    # Referrer 정보 최소화
    Referrer-Policy "strict-origin-when-cross-origin"
    # 권한 정책
    Permissions-Policy "geolocation=(), microphone=(), camera=(), payment=()"
    # CSP — PWA(SW·manifest) + Tailwind + shadcn/ui(Radix) + Recharts 정합. 상세 결정: docs/research/frontend/08_auth_security.md §3.4
    Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://*.ingest.sentry.io; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests"
}
```

> CSP 디렉티브 상세 근거(왜 `style-src 'unsafe-inline'`을 유지하고 `script-src`는 nonce 미도입인지)는 `docs/research/frontend/08_auth_security.md` §3 참조. nonce 도입 트리거는 동 문서 §3.5에 정량 임계치로 기록.

→ 본 블록은 `03_reverse_proxy.md` §4.1 Caddyfile 예시에 통합되어 있음.

---

## 4. 통합 최종 결정 (spec 반영용)

본 research가 채택한 4개 라이브러리 중 spec에 신규 반영되는 항목:

| 라이브러리 | 역할 |
|----------|------|
| **cryptography** | `pos_connections.api_key` AES-256-GCM 암호화·복호화. python-jose [cryptography] 백엔드 |

> 본 research 결정 중 Authlib · python-jose · passlib(bcrypt)는 이미 동일 결정으로 spec에 반영되어 있어 행 추가 없음. `12_security.md` 정책(TLS 1.3·Rotation·AES-256·SHA-256) 모두 본 research 결정과 정합.
> SHA-256 해시(refresh_tokens.token_hash)는 Python 표준 `hashlib`로 처리 — 외부 라이브러리 미사용.

### 4.1 후속 반영 권장 (별도 작업)

| 항목 | 위치 | 비고 |
|------|------|------|
| Caddy 보안 헤더 블록 | `03_reverse_proxy.md` §4.1 Caddyfile 예시 | HSTS·X-Frame·X-Content-Type 등 (본 문서 §3.5) |
| `secrets_manager` 재평가 트리거 | `12_security.md` §4 또는 본 문서 §2.5 | 매장 300+ 시 Vault 도입 |

---

## 5. 후보 세부 정보

### 5.1 Authlib ✅
- **사용처**: Google·카카오 OAuth 2.0 인가·콜백 처리. `/api/auth/login/{provider}`, `/api/auth/callback/{provider}`
- **장점**: OAuth 1.0/2.0/OIDC 표준 일체, Starlette·FastAPI 통합 클라이언트 제공, state·PKCE·nonce 자동 처리
- **단점**: 카카오 OIDC 비표준 → manual 매핑 필요
- **세부사항**: 라이선스 BSD. `authlib.integrations.starlette_client.OAuth`

### 5.2 python-jose ✅
- **사용처**: 자체 JWT Access Token 발급·검증
- **장점**: JWS·JWE·JWK·JWT 모두 지원, RSA·EC·HMAC 알고리즘 일체
- **단점**: 보안 취약점 이슈 과거 존재 → 최신 버전 추적 필요, 유지보수 활동 둔화(2024 이후)
- **세부사항**: 라이선스 MIT. `python-jose[cryptography]`로 cryptography 백엔드

### 5.3 passlib (bcrypt) ✅
- **사용처**: 이메일 로그인 비밀번호 해싱·검증
- **장점**: 다중 알고리즘 추상화, 알고리즘 회전 자동, hash deprecation 관리
- **단점**: bcrypt 4.x 호환 이슈 일부 버전에서 보고 → 핀 고정 권장
- **세부사항**: 라이선스 BSD. `passlib[bcrypt]`

### 5.4 cryptography ✅ (신규)
- **사용처**: `pos_connections.api_key` AES-256-GCM 암호화·복호화. JWT 서명 백엔드(python-jose 의존)
- **장점**: pyca 표준, FIPS 준수 backend(OpenSSL), 광범위 알고리즘
- **단점**: API가 저수준 → high-level wrapper 직접 작성 권장
- **세부사항**: 라이선스 Apache 2.0/BSD. `AESGCM`·`Fernet`·`HKDF` 제공

### 5.5 PyJWT 🟡 (보존)
- **사용처**: 단일 라이브러리 의존이 필요한 JWT 발급·검증
- **장점**: 가벼움, 활발한 유지보수, 광범위 채택
- **단점**: JWE·JWK 별도, python-jose 대비 기능 좁음
- **세부사항**: 라이선스 MIT. `PyJWT[crypto]`로 RSA/EC

### 5.6 argon2-cffi 🟡 (보존)
- **사용처**: bcrypt 대체 비밀번호 해싱
- **장점**: 메모리 하드 함수로 GPU 공격 내성, OWASP 권장
- **단점**: bcrypt 대비 CPU·메모리 비용 큼
- **세부사항**: 라이선스 MIT. passlib을 통해서도 사용 가능

### 5.7 HashiCorp Vault 🟡 (보존)
- **사용처**: 운영 단계 시크릿 중앙 관리
- **장점**: 동적 시크릿·정책·감사로그·키 회전 표준
- **단점**: 운영 부담 큼, 별도 클러스터 필요
- **세부사항**: 라이선스 BSL 1.1. Open source 포크 OpenBao

### 5.8 pip-audit ✅ (`09_testing_quality.md` 위임)
- **사용처**: Python 의존성 알려진 취약점 스캔
- **장점**: PyPA 공식, CI 통합 쉬움
- **단점**: 잠금 파일 관리 필요
- **세부사항**: 라이선스 Apache 2.0. 상세 운영 절차는 `09_testing_quality.md` §2

### 5.9 Caddy `header` 디렉티브 ✅
- **사용처**: HSTS·X-Frame-Options·X-Content-Type-Options·Referrer-Policy·Permissions-Policy 일괄 적용
- **장점**: 엣지에서 처리해 BE 코드 무관, 설정 한 블록
- **단점**: `style-src 'unsafe-inline'`은 React/PWA 통상 패턴이라 포함 — strict CSP를 원하면 Frontend nonce 도입 필요
- **세부사항**: `03_reverse_proxy.md` §4.1 Caddyfile에 통합

### 5.10 PyNaCl 🟡
- **사용처**: cryptography 대안. AEAD·X25519·Ed25519 사용 시
- **장점**: libsodium 바인딩, 안전 기본값(misuse-resistant), 단순 API
- **단점**: AES-GCM 직접 지원 약함(SecretBox = XSalsa20-Poly1305)
- **세부사항**: 라이선스 Apache 2.0

### 5.11 python-dotenv 🟡
- **사용처**: 로컬 `.env` 로딩
- **장점**: 단순·널리 채택, pydantic-settings에 통합
- **단점**: 운영 환경에는 부적합 (회전 없음)
- **세부사항**: 라이선스 BSD. pydantic-settings에 흡수되므로 별도 도입 불필요

### 5.12 AWS Secrets Manager / sops+age / OWASP DC / Keycloak / Casbin / jwcrypto / authx / fastapi-users / python-social-auth / Google Auth / Kakao SDK / bcrypt 직접 — **탈락**

탈락 사유는 §1.3 / §2.3 / §3.3 참조.

### 5.13 fastapi-users — 후보 외 제외 사유

자체 사용자 모델·OAuth·JWT를 패키지 단위로 제공하나 사주라의 자체 JWT 흐름(`12_security.md` §2.3 Rotation·HttpOnly Cookie)·온보딩(`04_feature_spec.md` §1)과 추상화 충돌. 카카오 OAuth도 직접 지원 없음.

---

## 6. 비교 요약 표

| 분류 | 후보 | 결과 | 핵심 사유 |
|------|------|------|---------|
| OAuth | Authlib | ✅ | OAuth/OIDC 표준 일체·async |
| OAuth | python-social-auth | ⛔ | Django·Flask 중심·async 약함 |
| OAuth | Google Auth / Kakao SDK | ⛔ | Authlib 중복 |
| JWT | python-jose | ✅ | JWS/JWE/JWK 일체·Rotation claim 표준 |
| JWT | PyJWT | 🟡 보존 | 유지보수 활발 — python-jose 둔화 시 전환 |
| JWT | jwcrypto / authx | ⛔ | JWE 미사용 / 채택 적음 |
| 해싱 | passlib[bcrypt] | ✅ | OWASP 권장 bcrypt·알고리즘 회전 자동 |
| 해싱 | argon2-cffi | 🟡 보존 | OWASP 권장 강화 시 전환 |
| 해싱 | bcrypt 직접 | ⛔ | passlib 우위 |
| 대칭 암호 | cryptography | ✅ (신규) | AES-256-GCM·FIPS backend |
| 대칭 암호 | PyNaCl | ⛔ | AES-GCM 약함 |
| 시크릿 로딩 | pydantic-settings | ✅ (04 확정) | 타입 안전 |
| 시크릿 로딩 | python-dotenv | ⛔ | pydantic-settings에 흡수 |
| 시크릿 매니저 | HashiCorp Vault | 🟡 보존 | 매장 300+ 시 도입 |
| 시크릿 매니저 | AWS Secrets Manager | ⛔ | AWS 미사용 |
| 시크릿 매니저 | sops + age | ⛔ | MVP 환경변수로 충분 |
| 의존성 스캔 | pip-audit | ✅ (09 위임) | PyPA 공식 |
| 의존성 스캔 | OWASP DC | ⛔ | Python에 pip-audit이 가벼움 |
| 보안 헤더 | Caddy `header` | ✅ | 엣지 처리 |
| 보안 헤더 | secure 미들웨어 | ⛔ | Caddy로 대체 |
| RBAC | Keycloak / Casbin | ⛔ | 단일 역할 점주에 과함 |
