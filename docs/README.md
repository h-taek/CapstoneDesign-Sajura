# 사주라 문서 가이드

문서 작업 전에 읽는다. 폴더 역할, 파일 목록, 작성 규칙을 담는다.

---

## 1. 폴더 구조

```
docs/
├── spec/        확정된 사실만 — 무엇을 할 것인가
├── research/    조사·실측의 관찰 결과
│   ├── backend/
│   ├── frontend/
│   └── ai/
├── plan/        어떻게 만들 것인가 — 작업 분해·검증 기준
└── README.md    이 파일
```

파일명은 `순번_이름.md`로 쓴다. 정해진 구조 밖에 새 폴더를 만들지 않는다.

### 1-1. 폴더별 역할

| 폴더 | 담을 내용 | 담지 말 내용 |
|---|---|---|
| `spec/` | 결정 사항. 요구사항, 계약(API·DB), 설계(서비스·플로우·정책)와 기준값 | 미확정 항목, 기술 비교, 구현 일정, 과거 이력, 왜 그렇게 됐는지, 실측치, 구현 방법 |
| `research/` | 기술·오픈소스 비교, 외부 데이터 조사, 실험·실측 결과와 기각 사유 | 결정 (spec 참조로 대체) |
| `plan/` | 작업 순서, 의존관계, 마일스톤, 파일 단위 분해, 메서드 시그니처, 검증 기준 | 결정된 설계 (spec 참조로 대체), 조사 중인 내용 |

### 1-2. 작성 순서

```
spec        무엇을 할지 정한다
  ↓
research    결정의 근거가 필요하면 조사·실측한다
  ↓
plan        어떻게 만들지 분해한다
  ↓
구현        spec을 기준으로 개발한다
```

범위가 정해지지 않은 채 plan을 먼저 쓰지 않는다. 실측 결과가 나오면 다음 단계로 가기 전에 research에 먼저 기록한다.

작업 컨텍스트와 다음 할 일은 `HANDOFF.md`, 완료 이력은 `PROGRESS.md` §4의 담당자별 문서를 본다.

---

## 2. spec 문서 목록

| 파일 | 정의하는 사실 |
|---|---|
| `01_requirements.md` | 프로젝트 목표·고객·가치 제안, 기능·비기능 요구사항, 제약 |
| `02_usecase.md` | 액터, UC별 목적·흐름·조건 |
| `03_mvp_scope.md` | MVP 포함/제외 기능, 성공 기준, 데모 시나리오, 데이터 확보 방식 |
| `04_feature_spec.md` | 기능 분류 + 기능별 비즈니스 규칙. §12는 화면 IA 원본 |
| `05_user_flow.md` | 점주 사용 흐름 |
| `06_sequence.md` | 컴포넌트 간 호출 시퀀스 |
| `07_api_spec.md` | API 계약 — 요청/응답, 상태코드, AI Server 계약(§8) |
| `08_schema.md` | DB 구조 — 컬럼·타입·FK·인덱스(§1~§6), 도메인·ERD·데이터 흐름(§7~§10) |
| `09_service_design.md` | BE 기술 스택, 계층 구조, 권한·에러·캐시·미들웨어·운영 토폴로지 |
| `10_frontend_design.md` | FE 기술 스택, 라우팅·상태·인증 통합·PWA·CI |
| `11_ai_spec.md` | 모델 설계 — 목적·초기 모델·피처·학습·출력·예측 근거 |
| `12_security.md` | 토큰 정책, 암호화, 접근 통제, 감사 로그 |
| `13_performance.md` | API·배치 SLA, 성능 전략 |

### 2-1. 연동 수정 파일 맵

spec 하나를 고치면 함께 확인할 파일이다.

| 수정 파일 | 함께 확인 |
|---|---|
| `01_requirements.md` | `03_mvp_scope.md`, `04_feature_spec.md` |
| `02_usecase.md` | `04_feature_spec.md`, `05_user_flow.md` |
| `03_mvp_scope.md` | `01_requirements.md`, `04_feature_spec.md`, `13_performance.md` |
| `04_feature_spec.md` | `07_api_spec.md`, `12_security.md`, `05_user_flow.md`, `01_requirements.md` |
| `05_user_flow.md` | `04_feature_spec.md`, `02_usecase.md` |
| `06_sequence.md` | `04_feature_spec.md`, `07_api_spec.md`, `09_service_design.md` |
| `07_api_spec.md` | `04_feature_spec.md`, `09_service_design.md`, `06_sequence.md` |
| `08_schema.md` | `09_service_design.md`, `11_ai_spec.md` |
| `09_service_design.md` | `07_api_spec.md`, `06_sequence.md`, `10_frontend_design.md`, `plan/01_be.md` |
| `10_frontend_design.md` | `07_api_spec.md`, `12_security.md`, `04_feature_spec.md` |
| `11_ai_spec.md` | `04_feature_spec.md`, `13_performance.md` |
| `12_security.md` | `04_feature_spec.md`, `07_api_spec.md` |
| `13_performance.md` | `03_mvp_scope.md`, `11_ai_spec.md` |

---

## 3. research 문서 목록

`backend/01~11·13·14` — 웹 프레임워크, 앱 서버, 리버스 프록시, 데이터 계층, 인증·보안, 외부 연동, 캐시·관측, 비동기 파이프라인, 테스트·품질, 배포, 기타, POS 어댑터, 보안 미결 항목

`frontend/01~11` — 프레임워크·빌드, 라우팅·상태, 데이터·HTTP, UI·스타일, 폼·검증, PWA·푸시, 차트, 인증·보안, 테스트·품질, 배포, 관측

`ai/03` — 외부 데이터 소스 조사

---

## 4. plan 문서 목록

| 파일 | 내용 |
|---|---|
| `01_be.md` | Backend — Phase별 마일스톤 + 서비스별 주요 메서드 시그니처 |
| `02_fe.md` | Frontend — Phase별 마일스톤 |
| `03_ai.md` | AI — Phase별 마일스톤 |
| `04_gantt.md` | 전체 작업 흐름, 파트 간 의존관계 |

---

## 5. 작성 규칙

### 5-1. 원칙

**사실은 한 곳에만 정의한다.** 한 문서에서 정의하고 나머지는 참조한다. 재기술이 필요하면 `> 기준: [파일명 §번호]`로 출처를 명시한다.

**덧대지 않는다.** 빼도 뜻이 그대로면 뺀다. 무관해진 과거 이력은 보존보다 폐기한다.

**폴더 역할을 지킨다.**

- spec에 "검토 예정", "별도 확정 예정" 같은 표현이 들어가면 안 된다. 그 항목은 research로 옮긴다.
- spec에 실측치·기각 사유·실험 회차를 적지 않는다. research가 답한다.
- spec에 단계별 구현 일정이나 메서드 분해를 적지 않는다. plan으로 옮긴다.
- research에 결정을 적지 않는다. plan에 설계를 다시 적지 않는다.

**한 문서를 바꾸면 연동 문서를 즉시 함께 수정한다.** 연동 관계는 §2-1 참고.

**팀원이 직접 쓴 문서는 확인받고 고친다.** 다른 담당자가 본문을 쓴 문서(`spec/11_ai_spec.md`, `plan/ai/`, `research/ai/`)는 임의로 고치지 않고 무엇을 왜 고쳐야 하는지 먼저 알린다.

### 5-2. 문체·형식

- 한국어 기술 문서는 하다체(~한다)로 쓴다. 경어체를 쓰지 않는다.
- 이모지와 강조용 특수문자를 쓰지 않는다. 굵은 글씨를 남발하지 않는다.
- 표는 최소 상태만 담고 부연은 비고로 분리한다.
- 같은 개념은 문서 전체에서 같은 표현을 쓴다. 공식 명칭은 약칭보다 풀네임을 쓴다.

### 5-3. 체크리스트

**시작 전**
- [ ] 대상 문서가 속한 폴더의 역할을 확인한다
- [ ] 쓰려는 내용이 이미 다른 문서에 정의되어 있는지 확인한다
- [ ] main 전용 문서면 최신 main과 동기화한다 (`README.md` §5)

**작성 중**
- [ ] 다른 문서의 내용을 재기술하지 않는다
- [ ] 연동 문서를 즉시 함께 고친다
- [ ] 미결 항목을 확정된 것처럼 쓰지 않는다

**작성 후**
- [ ] 본인 `PROGRESS_*.md` §2 문서 수정 이력에 남긴다
- [ ] 새 정책·방향 결정이면 `PROGRESS.md` §3 표에 행을 추가한다
