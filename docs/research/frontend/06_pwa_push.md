# PWA · Web Push · 인앱 알림

> **카테고리**: PWA 인프라(Service Worker·manifest·캐시 전략), Web Push(VAPID 구독·`push` 이벤트), 인앱 알림(BE polling) 비교
> **연결 spec**:
> - `02_implementation_design.md` §1.3 (PWA + 푸시·인앱 알림 MVP 포함)
> - `03_be.md` §1 (BE pywebpush)·§4 NotificationService·§15 (Caddy 정적 서빙)
> - `02_implementation_design.md` §3.10 (알림 5개 endpoint)
> - `02_implementation_design.md` §4.3.22 `notifications`·§4.3.23 `push_subscriptions`
> - `docs/research/backend/06_external_integration.md` §4.7 (pywebpush·VAPID·iOS Safari 16.4+ 지원)
> - `01_basic_design.md` §3.12 (알림 정책 6개 상황)

---

## 1. PWA 인프라

### 1.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | vite-plugin-pwa | Vite 플러그인 (Workbox 통합) | 공식 권장, generateSW + injectManifest 두 모드 |
| 2 | Workbox CLI (단독) | CLI 도구 | Vite 빌드와 별도 단계 필요 |
| 3 | 직접 SW 작성 + Workbox runtime | 수동 | precaching·매니페스트 수동 |
| 4 | Serwist | next-pwa 대안 | Next.js 우선 — Vite 지원 부분 |

### 1.2 1차 벤치마크 — 필수 기능

| # | 후보 | Vite 빌드 통합 | precaching 자동 | manifest 자동 | push 이벤트 커스텀 | 마인드셰어 |
|---|------|:---:|:---:|:---:|:---:|:---:|
| 1 | vite-plugin-pwa | ◎ | ◎ (Workbox) | ◎ | ◎ (injectManifest 모드에서 커스텀 SW) | ◎ |
| 2 | Workbox CLI 단독 | △ (별도 단계) | ◎ | △ (수동) | △ | O |
| 3 | 직접 SW + Workbox runtime | △ (수동) | △ (수동) | X | ◎ | X |
| 4 | Serwist | X (Next.js 우선) | O | O | O | △ |

### 1.3 SW 모드 (generateSW vs injectManifest)

| 모드 | 특징 |
|------|------|
| `generateSW` | Workbox가 SW 코드를 자동 생성한다. 커스텀 코드를 추가할 수 없어 push 이벤트를 처리하지 못한다 |
| `injectManifest` | 개발자가 작성한 `src/sw.ts` 파일에 Workbox precaching manifest를 자동 주입한다. push·notificationclick 핸들러를 작성할 수 있다 |

### 1.4 후보별 차이

- Workbox CLI 단독 — Vite 빌드와 통합되지 않아 별도 빌드 단계가 필요하다.
- 직접 SW + Workbox runtime — precaching·manifest를 수동으로 작성해야 해 보일러플레이트가 크다.
- Serwist — Next.js 우선이며 Vite 지원은 부분적이다.

---

## 2. Web Push (VAPID 구독·이벤트)

### 2.1 브라우저 API 동작

| API | 동작 |
|-----|------|
| `Notification.requestPermission()` → `PushManager.subscribe({ userVisibleOnly, applicationServerKey })` | 권한이 `granted`일 때 VAPID 공개 키로 구독을 만든다. 구독은 `endpoint`와 `keys`(p256dh·auth)를 가진다 |
| SW `push` 이벤트 | push service가 전달한 payload를 SW가 받아 `self.registration.showNotification(...)`으로 표시한다 |
| `showNotification`의 `tag` | 같은 tag의 알림은 하나만 남아 누적되지 않는다 |
| `showNotification`의 `requireInteraction` | 사용자가 닫기 전까지 알림이 유지된다 |
| SW `notificationclick` 이벤트 | `clients.matchAll`로 열린 창을 찾아 focus하거나 `clients.openWindow`로 새 창을 연다 |

### 2.2 VAPID 공개 키 전달 방식

| 옵션 | 방식 | 특징 |
|------|------|------|
| A. 환경변수 주입 (`VITE_VAPID_PUBLIC_KEY`) | 빌드 시 FE 번들에 inline | 단순·캐시 적합. 키 회전 시 재배포 필요 |
| B. `GET /api/notifications/vapid-public-key` 신규 endpoint | 런타임 조회 | 키 회전 유연. endpoint 1개 추가 |

---

## 3. 인앱 알림 (BE polling)

### 3.1 전체 후보 (polling 방식)

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | TanStack Query `refetchInterval` | client polling | TanStack Query `useQuery` 옵션 |
| 2 | Server-Sent Events (SSE) | server push | BE 신규 endpoint 필요 |
| 3 | WebSocket | 양방향 | BE 신규 핸들러 필요 |

### 3.2 1차 벤치마크

| # | 후보 | BE 구현 부담 | FE 구현 부담 | 즉시성 | 배터리·네트워크 비용 |
|---|------|:---:|:---:|:---:|:---:|
| 1 | TanStack Query polling | ◎ (기존 endpoint 재사용) | ◎ (1줄) | △ (간격에 따라 ~30s 지연) | O (간격 조정으로 균형) |
| 2 | SSE | △ (FastAPI SSE 가능하나 reverse proxy·keepalive·재연결 설계 추가) | O | ◎ | O |
| 3 | WebSocket | △ (FastAPI 지원·운영은 Caddy keepalive·재연결·heartbeat 설계) | △ | ◎ (양방향) | △ (idle 연결 유지) |

### 3.3 후보별 차이

- TanStack Query polling — 기존 `GET` endpoint를 그대로 쓰고, 즉시성은 polling 간격만큼 늦다.
- SSE·WebSocket — 즉시 전달되나 BE에 재연결·heartbeat·reverse proxy keepalive 설계가 추가로 필요하다. WebSocket은 idle 연결을 유지한다.

### 3.4 TanStack Query polling 옵션

| 옵션 | 동작 |
|------|------|
| `refetchInterval` | 지정한 간격(ms)마다 refetch한다 |
| `refetchIntervalInBackground: false` | 탭이 비활성이면 polling을 멈춘다 |
| `staleTime` | 그 시간 안에는 같은 query를 쓰는 컴포넌트가 mount돼도 refetch하지 않는다 |
| `refetch()` | 호출 시점에 즉시 다시 조회한다 |

polling 간격 5분은 접속자 1명당 분당 0.2회 요청이며, 동시 접속 20명이면 분당 4회다. BE `GET /api/notifications` rate limit은 60/min이다(`03_be.md` §13.4).

---

## 4. 후보 세부 정보

### 4.1 vite-plugin-pwa
- **장점**: Vite 빌드와 1단계 통합·Workbox precaching 자동·generateSW/injectManifest 양 모드·dev-server에서도 SW 동작 확인
- **단점**: injectManifest 모드는 SW 코드 직접 작성 필요
- **세부사항**: MIT. `vite-plugin-pwa`

### 4.2 Workbox (자동 포함)
- **장점**: 캐시 전략 표준 추상화(precacheAndRoute · routing · StaleWhileRevalidate·CacheFirst 등 strategies · ExpirationPlugin)·Google 유지보수
- **단점**: 직접 SW에 import 시 번들 크기 영향 — vite-plugin-pwa가 tree-shake
- **세부사항**: MIT. Google

### 4.3 TanStack Query polling
- **장점**: 추가 라이브러리 0·`refetchIntervalInBackground` 옵션·기존 cache·DevTools
- **단점**: polling 간격만큼 표시가 늦다
- **세부사항**: `03_data_http.md` §1 참조

---

## 5. 비교 요약 표

| 분류 | 후보 | 특징 |
|------|------|------|
| PWA 플러그인 | vite-plugin-pwa | Vite 통합·Workbox·injectManifest 모드 |
| PWA 플러그인 | Workbox CLI 단독 | Vite 통합 없음·별도 빌드 단계 |
| PWA 플러그인 | 직접 SW | precaching·manifest 수동 |
| PWA 플러그인 | Serwist | Next.js 우선 |
| SW 모드 | injectManifest | push·notificationclick 핸들러 작성 가능 |
| SW 모드 | generateSW | 커스텀 코드 불가 |
| VAPID 키 전달 | 환경변수 주입 | 빌드 시 inline·키 회전 시 재배포 |
| VAPID 키 전달 | 런타임 endpoint | 키 회전 유연·endpoint 추가 |
| 인앱 폴링 | TanStack Query polling | 추가 라이브러리 0·백그라운드 정지 옵션·간격만큼 지연 |
| 인앱 폴링 | SSE / WebSocket | 즉시 전달·재연결·heartbeat 설계 필요 |
