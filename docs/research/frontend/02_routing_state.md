# 라우팅·클라이언트 상태

> **카테고리**: 라우터 라이브러리, 클라이언트 사이드 상태 관리 라이브러리 비교
> **연결 spec**: `04_fe.md` §4 (화면 IA — 라우트 구조 파생), `03_be.md` §7.3 (Access Token 메모리 저장 — 클라이언트 상태에 보관)

---

## 1. 라우터

### 1.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | React Router v7 | 표준 라우터 | Remix와 통합되었으나 라이브러리 모드(SPA)로 사용 가능 |
| 2 | TanStack Router 1.x | 타입 안전 라우터 | 파일 기반 + 코드 기반, 강력한 type-safe params |
| 3 | Wouter | 경량 라우터 | < 2KB, 최소 기능 |
| 4 | React Router v6 | 이전 메이저 | 후속 v7 출시 |

### 1.2 1차 벤치마크 — 필수 기능

| # | 후보 | 중첩 라우팅 | 보호 라우트 | 코드 분할 (lazy) | 타입 안전 params | 마인드셰어·자료 |
|---|------|:---:|:---:|:---:|:---:|:---:|
| 1 | React Router v7 | ◎ | ◎ (loader·action·loader guard) | ◎ (`lazy` route export) | O (manual `useParams<...>()` 또는 generated) | ◎ (압도) |
| 2 | TanStack Router | ◎ | ◎ (beforeLoad) | ◎ | ◎ (자동 추론) | △ (성장 중) |
| 3 | Wouter | X (flat) | △ (수동) | O | △ | △ |
| 4 | React Router v6 | ◎ | ◎ | O | O | ◎ |

### 1.3 후보별 차이

- Wouter — 중첩 라우팅을 지원하지 않는다(flat).
- React Router v6 — 이전 메이저 버전이며 후속 v7이 출시돼 있다.

---

## 2. 클라이언트 상태

### 2.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | Zustand | 단순 store | < 1KB, 훅 기반 |
| 2 | Redux Toolkit | flux/redux | DevTools·미들웨어·RTK Query |
| 3 | Jotai | atomic | primitive atom 단위 |
| 4 | Recoil | atomic | **Meta 유지보수 정체** |
| 5 | React Context (내장) | 기본 | re-render 광범위 |
| 6 | MobX | observable | 데코레이터 패턴 |
| 7 | Valtio | proxy | atomic + proxy |

### 2.2 1차 벤치마크 — 필수 기능

| # | 후보 | 보일러플레이트 | TS 1급 | DevTools | persist 미들웨어 | 번들 크기 |
|---|------|:---:|:---:|:---:|:---:|:---:|
| 1 | Zustand | ◎ (store 함수 1개) | ◎ | O (devtools 미들웨어) | ◎ (persist 미들웨어) | ◎ (< 1KB gzip) |
| 2 | Redux Toolkit | △ (slice·reducer·action) | ◎ | ◎ | ◎ (redux-persist) | △ (~10KB gzip) |
| 3 | Jotai | O | ◎ | O | O (jotai/utils) | ◎ |
| 4 | Recoil | O | O | △ | O | O |
| 5 | React Context | ◎ (내장) | ◎ | X | X (수동) | 0 |
| 6 | MobX | △ (데코레이터·observer) | △ (TS 데코레이터 설정 부담) | O | X (수동) | △ |
| 7 | Valtio | O | O | △ | O | O |

### 2.3 후보별 차이

- Redux Toolkit — slice·reducer·action·dispatch 패턴을 쓴다. RTK Query는 TanStack Query와 기능이 겹친다.
- Recoil — Meta의 유지보수가 정체돼 있다(2023 이후 commit 거의 없음).
- React Context — 값이 바뀌면 consumer 전체가 re-render된다.
- MobX — TS strict 환경에서 데코레이터 설정이 필요하다. React 생태계 마인드셰어가 약해졌다.
- Valtio — proxy 모델이며 마인드셰어·트러블슈팅 자료가 Zustand·Jotai보다 적다.

---

## 3. 후보 세부 정보

### 3.1 React Router v7
- **장점**: 마인드셰어·자료 압도적. SPA 모드 + data router(`createBrowserRouter`) + loader/action으로 진입 가드·데이터 prefetch 표준 표현. `lazy` import로 코드 분할 1줄
- **단점**: 자동 타입 추론은 TanStack Router 대비 약함 (수동 generic 또는 generated types 필요)
- **세부사항**: MIT 라이선스. `react-router@^7`

### 3.2 Zustand 5
- **장점**: API 표면 최소(`create` + selector hook), 미들웨어 조합(persist·devtools·immer·subscribeWithSelector), Provider 불필요
- **단점**: 정적 분석 도구(action tracker 등)는 Redux Toolkit 대비 약함
- **세부사항**: MIT. `zustand@^5`

### 3.3 TanStack Router
- **장점**: 자동 타입 추론·search params 스키마(zod 연동)·beforeLoad 가드
- **단점**: 마인드셰어 성장 중, 자료가 React Router 대비 적음
- **세부사항**: MIT

### 3.4 Jotai
- **장점**: primitive atom + derived atom으로 fine-grained 의존성 표현
- **단점**: 멘탈 모델 학습 비용·디버깅 복잡도
- **세부사항**: MIT

---

## 4. 비교 요약 표

| 분류 | 후보 | 특징 |
|------|------|------|
| 라우터 | React Router v7 | 마인드셰어·data router·lazy·자료 압도 |
| 라우터 | TanStack Router | 타입 추론 자동·search params 스키마 |
| 라우터 | Wouter | 중첩 미지원 |
| 라우터 | React Router v6 | 이전 메이저 |
| 상태 | Zustand 5 | 보일러플레이트 최소·persist 미들웨어·번들 < 1KB |
| 상태 | Jotai | atomic·derived atom |
| 상태 | Redux Toolkit | slice·reducer 패턴·RTK Query가 TanStack Query와 중복 |
| 상태 | Recoil | 유지보수 정체 |
| 상태 | Context (단독) | re-render 광범위 |
| 상태 | MobX / Valtio | 데코레이터 설정 / 마인드셰어 약함 |
