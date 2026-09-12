# Research 폴더

> spec/ 작성을 위한 조사·분석 문서를 모은다. 확정된 사실은 즉시 해당 spec 파일에 반영하고, 본 폴더에서는 제거 또는 "확정 → spec 참조"로 갱신한다.

---

## 구조

```
research/
├── backend/      Backend 구현 후보 조사 (완료, 13 카테고리)
├── frontend/     Frontend 구현 후보 조사 (완료, 11 카테고리)
├── ai/           AI 모델·파이프라인 미확정 항목 조사
└── SUMMARY.md    확정된 기술 스택 일람
```

---

## backend/

| 파일 | 다루는 카테고리 | 연결 spec |
|------|----------------|-----------|
| `01_web_framework.md` | 웹 프레임워크 후보 비교 | `09_service_design.md` §1 |
| `02_app_server.md` | 애플리케이션 서버 후보 비교 | `09_service_design.md` §1 |
| `03_reverse_proxy.md` | 리버스 프록시 후보 비교 | `09_service_design.md` §1 |
| `04_data_layer.md` | ORM·DB 드라이버·검증·데이터 처리 | `09_service_design.md` §1, `08_schema.md` |
| `05_auth_security.md` | 인증·암호화·시크릿·보안 부가 | `12_security.md` |
| `06_external_integration.md` | HTTP 클라이언트·브라우저 자동화·알림 | `04_feature_spec.md` §9, §11 |
| `07_cache_observability.md` | 캐시·로깅·모니터링 | `09_service_design.md`, `13_performance.md` |
| `08_async_pipeline.md` | 백그라운드 작업·데이터 파이프라인 | `11_ai_spec.md` |
| `09_testing_quality.md` | 테스트·코드 품질·미들웨어·API 문서화 | `13_performance.md`, `07_api_spec.md` |
| `10_deployment.md` | 의존성·컨테이너·배포·환경 설정 | `09_service_design.md` §1 |
| `11_misc.md` | DI·유틸·결제·개발 편의 | `09_service_design.md` |
| `13_pos_adapter.md` | POS사별 API 연동 조사 | `04_feature_spec.md` §4.3 |
| `14_security_open_items.md` | 보안 정책 미확정 항목 | `12_security.md` |

## frontend/

| 파일 | 다루는 카테고리 | 연결 spec |
|------|----------------|-----------|
| `01_framework_build.md` | UI 프레임워크·빌드·언어 (React + Vite·Next.js·Remix·Astro + TypeScript) | `10_frontend_design.md` |
| `02_routing_state.md` | 라우팅·클라이언트 상태 (React Router·TanStack Router + Zustand·Redux Toolkit 등) | `10_frontend_design.md` |
| `03_data_http.md` | 서버 상태·HTTP·OpenAPI (TanStack Query + fetch·axios·ky + Codegen) | `10_frontend_design.md` §6, `07_api_spec.md` |
| `04_ui_styling.md` | 스타일·컴포넌트 (Tailwind + shadcn/ui·MUI·Mantine·Chakra·AntD) | `10_frontend_design.md` §1, `04_feature_spec.md` §12 |
| `05_form_validation.md` | 폼·검증 (React Hook Form + zod, Pydantic v2 호환) | `10_frontend_design.md` §7 |
| `06_pwa_push.md` | PWA·Web Push·인앱 알림 (vite-plugin-pwa·Workbox + VAPID + polling) | `10_frontend_design.md` §5 |
| `07_charts.md` | 차트·시각화 (Recharts·ECharts·Chart.js·Visx·Nivo) | `10_frontend_design.md` §1, `04_feature_spec.md` §8 |
| `08_auth_security.md` | OAuth 흐름·토큰 정책·CSP (BE 리다이렉트 + 메모리·HttpOnly Cookie) | `10_frontend_design.md` §2, `12_security.md` §2.3 |
| `09_testing_quality.md` | 테스트·코드 품질·문서화 (Vitest·Playwright·MSW·ESLint·Biome·Storybook) | `10_frontend_design.md` §9, `13_performance.md` |
| `10_deployment.md` | 패키지 매니저·빌드·배포·CI (pnpm·Vite 산출 + Caddy + GitHub Actions) | `10_frontend_design.md` §9, `09_service_design.md` §11 |
| `11_observability.md` | 에러 모니터링·관측가능성 (Sentry + PII scrubbing + 소스맵 정책) | `10_frontend_design.md` §8, `13_performance.md` §5 |

## ai/

| 파일 | 다루는 내용 | 연결 spec |
|------|------------|-----------|
| `00_ml_guide_reference.md` | 캡스톤 ML 통합가이드 (PART 0~5 + 부록) | — |
| `03_external_data_sources.md` | 외부 데이터 소스 조사 — 날씨·유동인구·상권·조치원 특화 | `11_ai_spec.md` §4 |

---

## 작성 규칙

- spec/에서 미확정으로 보류된 항목을 본 폴더로 옮긴다.
- 본 폴더에서 확정되면 즉시 해당 spec 파일에 반영한 뒤, 본 폴더 항목은 "확정 → spec 참조"로 갱신하거나 제거한다.
- 카테고리별 파일 크기가 커지면 분할한다 (예: `backend/` 12개 카테고리 분할 사례).
- spec에 이미 확정된 내용을 본 폴더에 다시 적지 않는다 — spec 경로를 참조한다.
