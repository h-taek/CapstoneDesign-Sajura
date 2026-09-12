# Frontend 조사

> **목적**: Frontend(React + PWA) 구현에 사용할 오픈소스·라이브러리·도구를 카테고리별로 결정한다.
> **작성 패턴**: `docs/research/backend/`와 동일 — §0 카테고리 구성 → §x 1차/2차 벤치마크 → §x.4 최종 선발 → §x.5 보존 후보 → §통합 결정 → §후보 세부 → §비교 요약.
> **연결 spec**:
> - `docs/spec/04_feature_spec.md` §12 (화면별 UI 구성)
> - `docs/spec/05_user_flow.md` (UX 흐름)
> - `docs/spec/07_api_spec.md` (FE가 호출할 endpoint)
> - `docs/spec/09_service_design.md` §10 (미들웨어·CORS·Rate Limit), §11 (Caddy 정적 서빙)
> - `docs/spec/12_security.md` §2.3 (토큰 정책 — Access 메모리 / Refresh HttpOnly Cookie / Rotation)
> - `docs/spec/03_mvp_scope.md` §3 (PWA + 푸시·인앱 알림 MVP 포함)

---

## 결정 흐름 원칙

- **probe 의존이 아닌 모든 항목은 결정 확정** — "검토 예정·미정·추후 정의" 표현 금지
- **보존 후보는 probe-dependent 재평가 트리거만 유지** — 정량 임계치(지표 수 + 기간) 형태로 기록
- **research는 결정·운영 흐름의 source-of-truth** — DB 컬럼·API 계약·서비스 시그니처는 spec에 위임
- spec ↔ research 정합 일관 — 결정은 즉시 해당 spec 파일에 반영
- backend research 보존 후보 트리거(매장 300+·BE 노드 2+ 등)와 일관성 유지

---

## 카테고리 목록

| 파일 | 다루는 카테고리 | 핵심 결정 항목 |
|------|----------------|--------------|
| `01_framework_build.md` | UI 프레임워크·빌드·언어 | React + 빌드 도구(Vite vs Next.js vs Remix vs Astro) + TypeScript |
| `02_routing_state.md` | 라우팅·클라이언트 상태 | 라우터(React Router vs TanStack Router) + Client State(Zustand vs Redux Toolkit vs Jotai vs Context) |
| `03_data_http.md` | 서버 상태·HTTP 클라이언트·OpenAPI | TanStack Query + HTTP 클라이언트(fetch vs axios vs ky) + OpenAPI Codegen |
| `04_ui_styling.md` | 스타일·컴포넌트 라이브러리 | Tailwind CSS + 컴포넌트(shadcn/ui vs MUI vs Mantine vs Chakra vs Ant Design) |
| `05_form_validation.md` | 폼·검증 | React Hook Form + zod (BE Pydantic v2 호환) |
| `06_pwa_push.md` | PWA 인프라·Web Push·인앱 알림 | vite-plugin-pwa + Workbox + Web Push(VAPID, pywebpush 정합) + `GET /api/notifications` polling |
| `07_charts.md` | 차트·시각화 | Recharts vs Apache ECharts vs Chart.js vs Visx vs Nivo (대시보드·수요예측·ROI) |
| `08_auth_security.md` | OAuth 흐름·토큰 정책·CSP | BE 인가 URL 리다이렉트 + Access Token 메모리 + Refresh HttpOnly Cookie + CSP nonce 도입 여부 |
| `09_testing_quality.md` | 테스트·코드 품질·문서화 | Vitest + Playwright(E2E) + MSW + ESLint vs Biome + Prettier + Storybook |
| `10_deployment.md` | 패키지 매니저·빌드 산출·배포·CI | pnpm vs npm vs bun + Vite 빌드 산출 + Caddy 정적 서빙 정합 + GitHub Actions |
| `11_observability.md` | 에러 모니터링·관측가능성 | Sentry(`@sentry/react` + `@sentry/vite-plugin`) + PII scrubbing + 소스맵 업로드 + sampleRate |

---

## 작성 후 spec 반영 정책

frontend 결정이 일정 규모 쌓이면 `docs/spec/07_frontend/` (또는 동일 수준 폴더) 도입을 검토한다. 현재는 frontend 관련 사실이 다음 위치에 분산되어 있다:

- `09_service_design.md` §10 (미들웨어·CORS·Rate Limit — BE 측 정합)
- `09_service_design.md` §11 (Caddy 정적 파일 서빙 — FE 산출 위치)
- `04_feature_spec.md` §12 (화면별 UI 구성)
- `12_security.md` §2.3 (토큰 정책 — FE 저장 위치 명시)
- `07_api_spec.md` (FE가 호출할 endpoint 일체)

→ 신규 spec 폴더 도입은 frontend research 10개가 모두 결정된 다음 세션에 일괄 검토.
