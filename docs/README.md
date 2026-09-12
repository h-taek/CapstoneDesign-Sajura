# 사주라 문서 가이드

설계 문서를 처음 접하는 팀원, 또는 문서 작업 전 참고해야 할 모든 규칙을 담은 파일이다.

---

## 1. 폴더 구조

```
docs/
├── spec/           확정된 사실만 (요구사항·계약·설계)
├── research/       spec 작성을 위한 조사·분석 (기술 스택, 미결 항목 검토)
│   ├── backend/
│   ├── frontend/
│   └── ai/
├── plan/           spec에서 확정된 내용을 구현하기 위한 계획
└── README.md       이 파일
```

### 1-1. 폴더별 역할

| 폴더 | 담을 내용 | 담지 말 내용 |
|------|-----------|--------------|
| `spec/` | **확정된 사실만.** 요구사항, 계약(API·DB), 설계(서비스·플로우·정책)와 그 기준값 | 미확정·검토 중 사항, 기술 스택 비교, 구현 일정 |
| `research/` | **spec을 작성하기 위한 조사.** 기술/오픈소스 비교, 외부 데이터·도구 조사, spec에서 보류된 항목의 검토 자료 | 확정된 설계 사실 (spec 참조로 대체) |
| `plan/` | **spec 확정 내용을 구현하기 위한 계획.** 작업 순서, 의존관계, 마일스톤, 역할 분담 | 확정된 설계 사실 (spec 참조로 대체), 조사 중 내용 |

### 1-2. 작업 흐름

```
research/   → spec/ 초안 작성을 위한 조사
   ↓
spec/       → 확정된 사실만 남김
   ↓
plan/       → 확정된 내용을 구현 단위로 분해
   ↓
구현        → spec/을 기준으로 개발 진행
```

조사 중인 내용은 `research/`, 확정된 사실만 `spec/`, 구현 계획은 `plan/`에 둔다. 다음 작업의 컨텍스트와 진입점은 `HANDOFF.md`를 참고한다.

---

## 2. spec/ 문서 목록

| 파일 | 역할 | 정의하는 사실 |
|------|------|--------------|
| `docs/spec/01_requirements.md` | 요구사항 원본 | 프로젝트 목표·고객·기능·비기능 요구사항 |
| `docs/spec/02_usecase.md` | 유즈케이스 원본 | 액터 관계, UC별 목적·흐름·조건 |
| `docs/spec/03_mvp_scope.md` | MVP 범위 원본 | 포함/제외 기능, 성공기준, 로드맵, 개발역할 |
| `docs/spec/04_feature_spec.md` | 기능 목록 원본 | 기능 분류, 베이스라인 모델 순서, 추천발주 단계 정책 |
| `docs/spec/04_feature_spec.md` | 비즈니스 규칙 원본 | 신뢰도 기준, FIFO 로직, 인증 정책, 알림 정책 |
| `docs/spec/05_user_flow.md` | UX 흐름 원본 | 점주 사용 흐름, 화면 IA |
| `docs/spec/06_sequence.md` | 시스템 흐름 시각화 | 소셜로그인·수요예측·발주 시퀀스 다이어그램 |
| `docs/spec/07_api_spec.md` | API 계약 원본 | 요청/응답 구조, 상태코드, AI Server API |
| `docs/spec/08_schema.md` | DB 구조 원본 | 컬럼명, 타입, FK, 인덱스 |
| `docs/spec/08_schema.md` | 08_schema.md 시각화 | schema와 항상 동기화 필요 |
| `docs/spec/09_service_design.md` | 백엔드 구현 설계 | 기술스택, 서비스 클래스·메서드 시그니처 |
| `docs/spec/10_frontend_design.md` | 프론트엔드 구현 설계 | 라우팅·상태·인증 통합·PWA·CI |
| `docs/spec/11_ai_spec.md` | ML 모델 설계 원본 | 베이스라인 순서, 입력피처, 출력, XAI 설계 |
| `docs/spec/11_ai_spec.md` | AI 파이프라인 원본 | 파이프라인 단계·입출력·전처리·배치 실행 시각 |
| `docs/spec/12_security.md` | 보안 정책 원본 | 토큰 정책, 암호화, 접근통제, 감사로그 항목 |
| `docs/spec/13_performance.md` | 성능 기준 원본 | API SLA, 배치 SLA, Playwright 타임아웃 기준 |

---

## 3. research/ 문서 목록

> 인덱스: `docs/research/README.md`

### backend/

| 파일 | 다루는 카테고리 |
|------|----------------|
| `01_web_framework.md` | 웹 프레임워크 후보 비교 |
| `02_app_server.md` | 애플리케이션 서버 후보 비교 |
| `03_reverse_proxy.md` | 리버스 프록시 후보 비교 |
| `04_data_layer.md` | ORM·DB 드라이버·마이그레이션·데이터 검증·데이터 처리 |
| `05_auth_security.md` | 인증·암호화·시크릿·보안 부가 |
| `06_external_integration.md` | HTTP 클라이언트·외부 API·브라우저 자동화·알림 |
| `07_cache_observability.md` | 캐시·로깅·모니터링 |
| `08_async_pipeline.md` | 백그라운드 작업·데이터 파이프라인 |
| `09_testing_quality.md` | 테스트·코드 품질·미들웨어·API 문서화 |
| `10_deployment.md` | 의존성·컨테이너·배포·환경 설정 |
| `11_misc.md` | DI·유틸·결제·개발 편의 |
| `13_pos_adapter.md` | POS사별 API 연동 조사 (TossPlace/키움/OKPOS) |
| `14_security_open_items.md` | 보안 정책 미확정 항목 검토 |

### frontend/

| 파일 | 다루는 카테고리 |
|------|----------------|
| `01_framework_build.md` | React + 빌드 도구(Vite·Next.js·Remix·Astro) + TypeScript |
| `02_routing_state.md` | 라우팅(React Router·TanStack Router) + 클라이언트 상태 |
| `03_data_http.md` | TanStack Query + HTTP 클라이언트(fetch·axios·ky) + OpenAPI Codegen |
| `04_ui_styling.md` | Tailwind + 컴포넌트(shadcn/ui·MUI·Mantine·Chakra·AntD) |
| `05_form_validation.md` | React Hook Form + zod |
| `06_pwa_push.md` | PWA(vite-plugin-pwa·Workbox) + Web Push(VAPID) + 인앱 polling |
| `07_charts.md` | Recharts·ECharts·Chart.js·Visx·Nivo |
| `08_auth_security.md` | OAuth 흐름·Token 정책·CSP |
| `09_testing_quality.md` | Vitest·Playwright·MSW·ESLint·Biome·Storybook |
| `10_deployment.md` | pnpm·빌드·배포·CI |
| `11_observability.md` | Sentry·PII scrubbing·소스맵·sampleRate |

### ai/

| 파일 | 다루는 내용 |
|------|------------|
| `00_ml_guide_reference.md` | 캡스톤 ML 통합가이드 (PART 0~5 + 부록) — 프로젝트 ML 설계 전반의 참고문서 |
| `03_external_data_sources.md` | 외부 데이터 소스 조사 — 날씨·유동인구·상권·조치원 특화 데이터 수집 가능성 |

---

## 4. plan/ 문서 목록

| 파일 | 역할 |
|------|------|
| `plan_gantt.md` | 구현 작업 흐름, 파트 간 의존관계, Phase별 작업 |

---

## 5. 문서 작성 규칙

### 5-1. 일반 원칙

**사실은 한 곳에만 정의한다**

같은 내용을 두 문서에 따로 쓰는 순간 불일치가 시작된다. 한 문서에서 **정의**하고, 나머지는 **참조**만 한다. 재기술이 꼭 필요하면 `> 기준: [파일명 섹션번호]` 형태로 출처를 명시한다.

**폴더 역할을 지킨다**

- spec에 "검토 예정", "확실하지 않음", "추후 정의 필요" 같은 표현이 들어가면 안 된다. 그 항목은 research로 이동한다.
- spec에 "1단계는 ~, 2단계는 ~" 식의 단계별 구현 일정이 들어가면 안 된다. 그 항목은 plan으로 이동한다.
- research에 확정된 사실을 다시 적지 않는다 — spec을 참조한다.
- plan에 확정된 설계를 다시 적지 않는다 — spec을 참조한다.

**한 문서를 바꾸면 연동 문서를 즉시 함께 수정한다**

"나중에 수정"은 거의 반드시 누락된다. spec/ 문서 간 연동 관계는 아래 파일 맵을 참고한다.

### 5-2. 작업 전/중/후 체크리스트

**BEFORE — 시작 전**
- [ ] 작업 대상 문서가 속한 폴더의 역할(spec/research/plan)을 확인한다
- [ ] 쓰려는 내용이 이미 다른 문서에 정의된 사실인지 확인한다
- [ ] 관련 인수인계 문서나 선행 조사 문서가 있으면 먼저 읽는다

**DURING — 작성 중**
- [ ] 다른 문서에 있는 내용을 그대로 재기술하지 않는다
- [ ] 한 문서를 바꾸면 연동 문서도 즉시 함께 수정한다
- [ ] 미결·조사 중인 내용을 spec/에 확정된 것처럼 쓰지 않는다

**AFTER — 작성 후**
- [ ] spec/ 문서를 수정했다면 `PROGRESS.md` 섹션 4 문서 수정 이력에 날짜·수정 내용을 남긴다
- [ ] 새로운 정책·방향 결정이 생겼다면 `PROGRESS.md` 섹션 3 결정 이력 테이블에 추가한다

### 5-3. spec/ 연동 수정 파일 맵

> spec/ 문서 수정 시 함께 확인해야 할 파일 목록이다.

| 수정 파일 | 함께 확인할 파일 |
|----------|----------------|
| `01_requirements.md` | `04_feature_spec.md`, `03_mvp_scope.md` |
| `02_usecase.md` | `04_feature_spec.md`, `05_user_flow.md` |
| `03_mvp_scope.md` | `01_requirements.md`, `04_feature_spec.md` |
| `04_feature_spec.md` | `04_feature_spec.md`, `03_mvp_scope.md` |
| `04_feature_spec.md` | `07_api_spec.md`, `12_security.md`, `05_user_flow.md`, `01_requirements.md` |
| `05_user_flow.md` | `04_feature_spec.md`, `02_usecase.md` |
| `06_sequence.md` | `04_feature_spec.md`, `07_api_spec.md`, `09_service_design.md` |
| `07_api_spec.md` | `04_feature_spec.md`, `09_service_design.md`, `06_sequence.md` |
| `08_schema.md` | `08_schema.md`, `09_service_design.md`, `11_ai_spec.md` |
| `08_schema.md` | `08_schema.md` |
| `09_service_design.md` | `07_api_spec.md`, `06_sequence.md`, `10_frontend_design.md` |
| `10_frontend_design.md` | `07_api_spec.md`, `12_security.md`, `04_feature_spec.md`, `09_service_design.md` §11 |
| `11_ai_spec.md` | `11_ai_spec.md`, `04_feature_spec.md` |
| `11_ai_spec.md` | `11_ai_spec.md`, `13_performance.md` |
| `12_security.md` | `04_feature_spec.md`, `07_api_spec.md` |
| `13_performance.md` | `03_mvp_scope.md`, `11_ai_spec.md` |
