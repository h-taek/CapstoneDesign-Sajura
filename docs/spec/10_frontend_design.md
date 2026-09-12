# Frontend 구현 설계

> Frontend 구현의 확정 사실 원본. 기술 스택 상세는 `docs/research/SUMMARY.md` §11~18 참조 (본 문서에서 재기술하지 않음). 결정 근거는 각 `docs/research/frontend/0X_*.md` 참조.

---

## 1. 기술 스택 (확정값 요약)

> 상세 버전·역할·근거: `docs/research/SUMMARY.md` §11~18

| 영역 | 확정 결정 |
|------|----------|
| 언어·런타임 | TypeScript 5.x (strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes) / Node 22 LTS / pnpm 9 |
| 프레임워크·빌드 | React 19 + Vite 6 |
| 라우팅 | React Router v7 (data router 모드) |
| 클라이언트 상태 | Zustand 5 (auth 메모리 스토어 · preferences persist 스토어 분리) |
| 서버 상태·HTTP | TanStack Query v5 + ky 1.x |
| API 타입 | openapi-typescript 7.x (BE OpenAPI → FE 타입 코드젠) |
| UI·스타일 | Tailwind CSS v4 + shadcn/ui + lucide-react |
| 폼·검증 | React Hook Form 7 + zod 3 + `@hookform/resolvers/zod` |
| PWA | vite-plugin-pwa (injectManifest 전략) |
| Web Push | VAPID 키 환경변수 inline (빌드 시 주입) |
| 차트 | Recharts 2.x |
| 에러 모니터링 | Sentry (FE SaaS) + PII scrubbing + 소스맵 업로드 + sampleRate 환경별 분리 |
| 테스트 | Vitest 2 + @testing-library/react + MSW 2 + Playwright(Node) |
| 코드 품질 | Biome 1 + tsc --noEmit |
| 배포 | Caddy 컨테이너 자체 빌드(FE dist를 Caddy 이미지에 COPY) — `service_design.md` §11.1 |
| CI | GitHub Actions 8단계 — `docs/research/frontend/10_deployment.md` |

---

## 2. 인증 통합

> 토큰 정책 원본: `security.md` §2 / OAuth API 흐름 원본: `api_spec.md` §2

| 항목 | 결정 |
|------|------|
| OAuth 흐름 | BE 리다이렉트 방식 — FE는 `/api/auth/{provider}` 으로 이동만, BE 콜백에서 JWT 발급 후 FE root("/")로 302 redirect |
| Access Token 저장 | 메모리(Zustand auth 스토어). LocalStorage·SessionStorage·Cookie 저장 금지 |
| Refresh Token 저장 | HttpOnly · Secure · SameSite=Lax Cookie (BE Set-Cookie) — FE는 직접 접근 불가 |
| 첫 진입 시 동기 | FE 마운트 시 메모리 Access Token 부재 감지 → `POST /api/auth/refresh` 1회 호출로 Access Token 동기 |
| Access Token 갱신 | TanStack Query interceptor에서 401 응답 시 `POST /api/auth/refresh` 자동 호출 + 큐잉된 요청 재시도 |
| 로그아웃 | `POST /api/auth/logout` 호출 후 메모리 스토어 클리어 + root로 이동 |

근거: `docs/research/frontend/08_auth_security.md`

### 2.1 CSP 정책

> 원본 정의 위치: `docs/research/frontend/08_auth_security.md` §3.4 (8 디렉티브 블록). `docs/research/backend/03_reverse_proxy.md` §4.1과 `05_auth_security.md` §3.5는 동일 블록을 참조한다.

| 디렉티브 | 값 (요약) |
|---------|----------|
| `default-src` | `'self'` |
| `script-src` | `'self'` + nonce |
| `connect-src` | `'self'` + Sentry SaaS endpoint (`*.sentry.io`) |
| `img-src` | `'self'` data: |
| `font-src` | `'self'` |
| `style-src` | `'self'` + nonce |
| `frame-ancestors` | `'none'` |
| `base-uri` | `'self'` |

---

## 3. 라우팅 구조

> 화면 IA 원본: `feature_spec.md` §12 / 사용 흐름 원본: `user_flow.md`

| 경로 | 화면 | 가드 |
|------|------|------|
| `/login` | 로그인 (이메일/비밀번호 + Google·카카오 버튼) | 미인증만 |
| `/register` | 이메일 회원가입 (email·password·name) | 미인증만 |
| `/verify-business` | 사업자 검증 (사업자번호 입력 + 등록증 업로드, 반려 사유 표시) | 인증 + `business_status` ∈ {UNVERIFIED, REJECTED} |
| `/onboarding/*` | 온보딩 (매장 정보·POS 모드 선택·초기 재고/메뉴) | 인증 + `business_status` ∈ {PENDING, VERIFIED} + `onboarding_completed=false` |
| `/` | 홈 (오늘의 요약 + 경고 배지) | 인증 + 온보딩 완료 |
| `/dashboard` | 대시보드 (매출·예측) | 인증 + 온보딩 완료 |
| `/inventory` | 재고 관리 (목록·상세) | 동상 |
| `/menus` | 메뉴 관리 | 동상 |
| `/sales` | 판매 데이터 조회 | 동상 |
| `/forecast` | 수요예측 (1·2·3일 탭) | 동상 |
| `/orders` | 추천발주·승인 | 동상 |
| `/orders/{id}/result` | 쿠팡 자동화 결과 | 동상 |
| `/settings/*` | 설정 (POS·단가·알림·계정·앱 정보) | 동상 |
| `/admin/verifications` | (관리자) 사업자 검증 심사 큐 — 등록증 확인·승인/반려 | 인증 + `role=ADMIN` |

- 가드 미통과 시 redirect 순서: 미인증 → `/login` / `business_status` ∈ {UNVERIFIED, REJECTED} → `/verify-business` / {PENDING, VERIFIED} && 온보딩 미완료 → `/onboarding/{현재 스텝}` / 모두 완료 → `/`. `role=ADMIN`이 아닌데 `/admin/*` 접근 시 → `/`.
- 라우터는 React Router v7 data router 모드(loader/action)를 사용하되, 서버 데이터는 TanStack Query에 위임한다(loader는 권한 가드·라우트 진입 조건 검증 위주).

---

## 4. 상태 관리

### 4.1 분리 원칙

| 종류 | 도구 | 저장 위치 |
|------|------|----------|
| 인증 (Access Token, user 정보) | Zustand auth 스토어 | 메모리 only |
| 사용자 환경설정 (테마·정렬·필터) | Zustand preferences 스토어 (persist 미들웨어) | LocalStorage |
| 서버 데이터 (재고·메뉴·발주 등) | TanStack Query 캐시 | 메모리 (브라우저 새로고침 시 무효화) |
| 폼 입력 임시값 | React Hook Form 내부 | 컴포넌트 메모리 |

### 4.2 TanStack Query 정책

| 항목 | 값 |
|------|----|
| `staleTime` 기본 | 30초 |
| `gcTime` 기본 | 5분 |
| 인앱 알림 폴링 | 5분 고정 (코드 상수, 사용자 설정 없음 — `docs/research/frontend/02_routing_state.md`·`06_pwa_push.md`) |
| 토큰 갱신 (`refetchOnWindowFocus`) | 활성 |
| mutation 후 invalidation | 관련 query key 명시적 invalidate |

---

## 5. PWA·Web Push

> 알림 정책 원본: `feature_spec.md` §11

| 항목 | 결정 |
|------|------|
| PWA 전략 | vite-plugin-pwa `injectManifest` 모드 (커스텀 SW 직접 작성) |
| Service Worker 책임 | 정적 자산 캐시 + Push 이벤트 수신 + Notification 표시 + click 핸들러로 앱 deeplink |
| 캐시 전략 | 정적 자산 `CacheFirst` · API `NetworkOnly` (캐시는 TanStack Query 담당) |
| Web Push | VAPID 공개키 환경변수 inline, 구독 시 `POST /api/notifications/subscribe`로 BE 전송 |
| 인앱 알림 | TanStack Query 5분 폴링 (BE Web Push와 별개 보조 채널) |
| 알림 우선순위 | 긴급 → 경고 → 정보 정렬 (`feature_spec.md` §12.3) |

---

## 6. API 통합

### 6.1 OpenAPI 코드젠

- BE FastAPI가 `/openapi.json`을 제공한다.
- FE 빌드 파이프라인에서 `openapi-typescript`로 `src/api/types.gen.ts`를 생성한다.
- 모든 ky 호출은 생성된 타입을 인자·반환 타입으로 강제한다.
- BE API 변경 시 FE CI 단계에서 type 검사로 즉시 감지된다.

### 6.2 ky 인스턴스 정책

| 항목 | 값 |
|------|----|
| baseUrl | 환경변수 `VITE_API_BASE_URL` |
| credentials | `'include'` (HttpOnly Refresh Cookie 동봉) |
| Access Token 부착 | request hook에서 메모리 스토어 토큰 read |
| 401 처리 | response hook에서 `POST /api/auth/refresh` 1회 시도 → 성공 시 원 요청 재시도, 실패 시 로그아웃 |
| 재시도 | 5xx만 1회 (멱등 동사에 한정) |
| 타임아웃 | 10초 (예측 결과 조회 SLA 300ms 대비 충분한 여유) |

---

## 7. 폼·검증

| 항목 | 결정 |
|------|------|
| 폼 라이브러리 | React Hook Form 7 |
| 스키마 | zod 3 (BE Pydantic v2 호환 패턴 위주) |
| 통합 | `@hookform/resolvers/zod` |
| 서버 에러 매핑 | API 응답 422의 `errors` 배열을 RHF `setError`로 필드별 매핑 |
| 공통 스키마 위치 | `src/schemas/` (도메인별 분리) |

---

## 8. 에러 모니터링

> 원본 결정: `docs/research/frontend/11_observability.md` / 성능 항목 정합: `performance.md` §5

| 항목 | 결정 |
|------|------|
| 도구 | Sentry SaaS |
| 환경 분리 | dev / staging / prod (DSN 환경변수) |
| sampleRate | prod 0.1 · staging 0.5 · dev 1.0 |
| 소스맵 | 빌드 시 업로드, Sentry CLI를 CI 단계에 통합 |
| release tagging | git short SHA |
| PII scrubbing | beforeSend에서 이메일·토큰·매장명 마스킹 |

---

## 9. 빌드·배포·CI

> Caddy 배포 토폴로지: `service_design.md` §11.1 (caddy 컨테이너 자체 빌드, FE dist COPY)

### 9.1 CI 8단계 (GitHub Actions)

1. checkout · pnpm install (cache)
2. Biome lint
3. tsc --noEmit
4. openapi-typescript 재생성 + diff 검증
5. Vitest 유닛 테스트
6. Playwright E2E (Node 환경)
7. Vite build + Sentry 소스맵 업로드
8. Caddy 이미지 빌드 + 푸시 (FE dist COPY)

근거: `docs/research/frontend/10_deployment.md`

### 9.2 환경변수

| 변수 | 용도 |
|------|------|
| `VITE_API_BASE_URL` | BE API base URL |
| `VITE_VAPID_PUBLIC_KEY` | Web Push 구독 |
| `VITE_SENTRY_DSN` | Sentry 전송 |
| `VITE_SENTRY_RELEASE` | git short SHA |
| `VITE_SENTRY_SAMPLE_RATE` | 환경별 sampleRate |

---

## 10. 디렉토리 구조 (참고)

```
src/
├── api/              ky 인스턴스 + 생성 타입 (types.gen.ts)
├── routes/           React Router v7 라우트 정의 + loader/action
├── pages/            라우트별 화면 컴포넌트
├── components/       shadcn/ui 기반 공통 컴포넌트
├── features/         도메인별 컴포넌트·훅·스키마 (inventory, menus, orders, ...)
├── stores/           Zustand 스토어 (auth, preferences)
├── schemas/          zod 공통 스키마
├── lib/              유틸·hooks·상수
└── sw/               vite-plugin-pwa injectManifest용 커스텀 SW
```

> 본 구조는 권장값. 실제 구현 시 도메인 규모에 따라 조정 가능.

---

## 11. MVP / 2단계 매핑

> 단계별 기능 원본: `mvp_scope.md` §3 (MVP 포함), §4 (제외)

FE에서 [2단계]로 라벨링되는 화면·기능:

- 설정 > POS 연동 관리: POS API 재연동 버튼 (CSV 업로드 버튼은 MVP)
- 대시보드: ROI 카드·차트 영역 (매출/예측 시각화는 MVP)
- 데이터 내보내기·삭제 (마이페이지)

해당 영역은 MVP 빌드에서 화면 자체를 노출하지 않거나 "준비 중" placeholder로 처리한다. 라우트는 미리 등록하지 않는다.
