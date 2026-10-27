# 인증 · 암호화 · 시크릿 · 보안 부가

> **카테고리**: OAuth/JWT/비밀번호 라이브러리, 암호화·시크릿 관리, 보안 부가 미들웨어 후보 비교
> **연결 spec**: `docs/spec/03_be.md`, `docs/spec/03_be.md` §1

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

> fastapi-users는 사용자 모델·등록·로그인·OAuth·JWT를 패키지 단위로 제공하며, 카카오 OAuth는 직접 지원하지 않는다.

### 1.2 1차 벤치마크 — 필수 기능

| # | 후보 | Google | 카카오 | OAuth state·PKCE | async·FastAPI |
|---|------|:-----:|:------:|:----------------:|:-------------:|
| 1 | Authlib | ◎ | O(커스텀 매핑) | ◎ | ◎ |
| 2 | python-social-auth | O | O | △ | X(Django·Flask 중심) |
| 3 | Google Auth Library | ◎(Google 한정) | X(미지원) | △ | △ |
| 4 | Kakao REST(httpx) | X | ◎(직접) | X(직접 구현) | ◎ |

| # | 후보 | HS256 | RS256·ES256 | 활발 유지보수 |
|---|------|:-----:|:----------:|:-----------:|
| 5 | python-jose | O | O | △(2024 이후 둔화) |
| 6 | PyJWT | O | O(`[crypto]`) | ◎(활발) |
| 7 | jwcrypto | O | O | O |
| 8 | authx | O(헬퍼) | O | △(채택 적음) |

| # | 후보 | OWASP 권장 | 알고리즘 회전 | 추상화 | 적용 비용 |
|---|------|:----------:|:-----------:|:------:|:--------:|
| 9 | passlib[bcrypt] | O(bcrypt 허용) | ◎(자동) | ◎ | 낮음 |
| 10 | argon2-cffi | ◎(가장 권장) | △(passlib 경유) | △ | 중간 |
| 11 | bcrypt(직접) | O | X(수동) | X | 낮음 |

### 1.3 후보별 차이

- python-social-auth — Django·Flask 중심 설계이며 async 통합이 약하다.
- Google Auth Library — Google 전용이며 카카오를 지원하지 않는다.
- Kakao REST 직접 호출 — state·PKCE를 직접 구현해야 한다. Authlib에는 카카오를 커스텀 매핑으로 등록할 수 있다.
- python-jose — claim·exp·iss·jti를 표준대로 처리한다. 2024 이후 유지보수 활동이 둔화했다.
- PyJWT — 유지보수가 활발하다. JWE·JWK는 별도이며 python-jose보다 기능 범위가 좁다.
- jwcrypto — JWE 표준 구현이 충실하고 API가 복잡하다.
- authx — FastAPI 친화 JWT 헬퍼이며 채택 사례가 적다.
- bcrypt 직접 — 알고리즘 회전·deprecation 관리를 직접 해야 한다. passlib은 같은 bcrypt를 쓰면서 이를 추상화한다.

---

## 2. 암호화 · 시크릿

### 2.1 전체 후보 목록

대칭 암호 라이브러리 2개 + 로컬 시크릿 로딩 2개 + 시크릿 매니저 3개 = **총 7개**.

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | cryptography | 라이브러리 | pyca 표준 |
| 2 | PyNaCl | 라이브러리 | libsodium 바인딩 |
| 3 | python-dotenv | 로컬 로딩 | `.env` 파일 |
| 4 | pydantic-settings | 로컬 로딩 | Pydantic 통합 |
| 5 | HashiCorp Vault | 시크릿 매니저 | 중앙 관리·회전 |
| 6 | AWS Secrets Manager | 시크릿 매니저 | AWS 매니지드 |
| 7 | sops + age | Git 시크릿 | 암호화된 파일 보관 |

### 2.2 1차 벤치마크 — 필수 기능

| # | 후보 | AES-256-GCM | python-jose 백엔드 | FIPS 옵션 | 운영 부담 |
|---|------|:----------:|:----------------:|:--------:|:-------:|
| 1 | cryptography | ◎ | ◎ | O(OpenSSL FIPS) | 낮음 |
| 2 | PyNaCl | △(SecretBox = XSalsa20-Poly1305) | X | X | 낮음 |

| # | 후보 | 환경변수 통합 | 타입 안전 | 회전 |
|---|------|:-----------:|:--------:|:----:|
| 3 | python-dotenv | ◎ | X | X |
| 4 | pydantic-settings | ◎ | ◎ | X |

| # | 후보 | 동적 회전 | 감사 로그 | 운영 부담 |
|---|------|:--------:|:--------:|:-------:|
| 5 | HashiCorp Vault | ◎ | ◎ | 큼 |
| 6 | AWS Secrets Manager | ◎ | ◎ | 매니지드 |
| 7 | sops + age | X | △ | 중간 |

### 2.3 후보별 차이

- PyNaCl — libsodium의 안전 기본값을 제공하나 AES-GCM 직접 지원이 약하다(SecretBox는 XSalsa20-Poly1305). python-jose 백엔드로 쓸 수 없다.
- python-dotenv — 단독으로는 타입 안전을 제공하지 않는다. pydantic-settings가 내부적으로 dotenv 로딩을 포함한다.
- AWS Secrets Manager — AWS 매니지드 서비스다.
- sops + age — GitOps 친화적이다. 동적 회전을 지원하지 않고 회전·접근 정책을 별도로 구축해야 한다.

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

| # | 후보 | CI 통합 | 적용 비용 |
|---|------|:------:|:--------:|
| 1 | pip-audit | ◎ | 낮음 |
| 2 | OWASP Dependency-Check | ◎ | 중간(Java 의존) |
| 3 | secure 미들웨어 | — | 낮음(1줄) |
| 4 | python-keycloak | — | 큼(Keycloak 운영) |
| 5 | Casbin | — | 큼(정책 모델 학습) |

### 3.3 후보별 차이

- OWASP Dependency-Check — 다언어를 지원하며 Java 런타임에 의존한다. pip-audit은 Python 의존성만 스캔하고 더 가볍다.
- secure 미들웨어 — BE 응답마다 보안 헤더를 붙인다. HSTS·X-Frame-Options·Referrer-Policy는 Caddyfile `header` 디렉티브 한 블록으로도 설정할 수 있다.
- python-keycloak — Keycloak 서버를 따로 운영해야 한다.
- Casbin — 정책 파일 기반 RBAC/ABAC이며 정책 모델을 익혀야 한다.

---

## 4. 후보 세부 정보

### 4.1 Authlib
- **장점**: OAuth 1.0/2.0/OIDC 표준 일체, Starlette·FastAPI 통합 클라이언트 제공, state·PKCE·nonce 자동 처리
- **단점**: 카카오 OIDC 비표준 → manual 매핑 필요
- **세부사항**: 라이선스 BSD. `authlib.integrations.starlette_client.OAuth`

### 4.2 python-jose
- **장점**: JWS·JWE·JWK·JWT 모두 지원, RSA·EC·HMAC 알고리즘 일체
- **단점**: 보안 취약점 이슈 과거 존재, 유지보수 활동 둔화(2024 이후)
- **세부사항**: 라이선스 MIT. `python-jose[cryptography]`로 cryptography 백엔드

### 4.3 passlib (bcrypt)
- **장점**: 다중 알고리즘 추상화, 알고리즘 회전 자동, hash deprecation 관리
- **단점**: bcrypt 4.x 호환 이슈가 일부 버전에서 보고됨
- **세부사항**: 라이선스 BSD. `passlib[bcrypt]`

### 4.4 cryptography
- **장점**: pyca 표준, FIPS 준수 backend(OpenSSL), 광범위 알고리즘
- **단점**: API가 저수준
- **세부사항**: 라이선스 Apache 2.0/BSD. `AESGCM`(`cryptography.hazmat.primitives.ciphers.aead`)·`Fernet`·`HKDF` 제공

### 4.5 PyJWT
- **장점**: 가벼움, 활발한 유지보수, 광범위 채택
- **단점**: JWE·JWK 별도, python-jose 대비 기능 좁음
- **세부사항**: 라이선스 MIT. `PyJWT[crypto]`로 RSA/EC

### 4.6 argon2-cffi
- **장점**: 메모리 하드 함수로 GPU 공격 내성, OWASP 권장
- **단점**: bcrypt 대비 CPU·메모리 비용 큼
- **세부사항**: 라이선스 MIT. passlib을 통해서도 사용 가능하며, passlib의 `argon2` scheme으로 바꾸면 기존 해시의 자동 마이그레이션을 지원한다

### 4.7 HashiCorp Vault
- **장점**: 동적 시크릿·정책·감사로그·키 회전 표준. KV·Transit 엔진으로 키 회전 자동화 가능
- **단점**: 운영 부담 큼, 별도 클러스터 필요
- **세부사항**: 라이선스 BSL 1.1. Open source 포크 OpenBao

### 4.8 pip-audit
- **장점**: PyPA 공식, CI 통합 쉬움
- **단점**: 잠금 파일 관리 필요
- **세부사항**: 라이선스 Apache 2.0

### 4.9 Caddy `header` 디렉티브
- **장점**: 엣지에서 처리해 BE 코드 무관, HSTS·X-Frame-Options·X-Content-Type-Options·Referrer-Policy·Permissions-Policy를 설정 한 블록으로 적용

### 4.10 PyNaCl
- **장점**: libsodium 바인딩, 안전 기본값(misuse-resistant), 단순 API, AEAD·X25519·Ed25519 지원
- **단점**: AES-GCM 직접 지원 약함(SecretBox = XSalsa20-Poly1305)
- **세부사항**: 라이선스 Apache 2.0

### 4.11 python-dotenv
- **장점**: 단순·널리 채택, pydantic-settings에 통합
- **단점**: 회전 기능 없음
- **세부사항**: 라이선스 BSD. pydantic-settings가 내부적으로 사용한다

---

## 5. 비교 요약 표

| 분류 | 후보 | 특징 |
|------|------|------|
| OAuth | Authlib | OAuth/OIDC 표준 일체·async·state·PKCE 자동 |
| OAuth | python-social-auth | Django·Flask 중심·async 약함 |
| OAuth | Google Auth / Kakao REST | Google 전용 / state·PKCE 직접 구현 |
| JWT | python-jose | JWS/JWE/JWK 일체·2024 이후 유지보수 둔화 |
| JWT | PyJWT | 가벼움·유지보수 활발·JWE 별도 |
| JWT | jwcrypto / authx | JWE 충실·API 복잡 / 채택 적음 |
| 해싱 | passlib[bcrypt] | bcrypt·알고리즘 회전 자동 |
| 해싱 | argon2-cffi | OWASP 가장 권장·메모리 하드 |
| 해싱 | bcrypt 직접 | 회전·deprecation 수동 |
| 대칭 암호 | cryptography | AES-256-GCM·FIPS backend |
| 대칭 암호 | PyNaCl | XSalsa20-Poly1305·AES-GCM 약함 |
| 시크릿 로딩 | pydantic-settings | 타입 안전·환경변수 통합 |
| 시크릿 로딩 | python-dotenv | `.env` 로딩·타입 안전 없음 |
| 시크릿 매니저 | HashiCorp Vault | 동적 회전·감사 로그·별도 클러스터 |
| 시크릿 매니저 | AWS Secrets Manager | AWS 매니지드 |
| 시크릿 매니저 | sops + age | Git 암호화 파일·동적 회전 없음 |
| 의존성 스캔 | pip-audit | PyPA 공식·Python 한정 |
| 의존성 스캔 | OWASP DC | 다언어·Java 의존 |
| 보안 헤더 | Caddy `header` | 엣지 처리 |
| 보안 헤더 | secure 미들웨어 | FastAPI 미들웨어 |
| RBAC | Keycloak / Casbin | 별도 서버 운영 / 정책 모델 학습 |
