# PWA · Web Push · 인앱 알림

> **카테고리**: PWA 인프라(Service Worker·manifest·캐시 전략), Web Push(VAPID 구독·`push` 이벤트), 인앱 알림(BE polling) 결정
> **연결 spec**:
> - `03_mvp_scope.md` §3 (PWA + 푸시·인앱 알림 MVP 포함)
> - `09_service_design.md` §1 (BE pywebpush)·§4 NotificationService·§11 (Caddy 정적 서빙)
> - `07_api_spec.md` §10 (알림 5개 endpoint)
> - `08_schema.md` §3.22 `notifications`·§3.23 `push_subscriptions`
> - `docs/research/backend/06_external_integration.md` §3.4 (pywebpush 결정·VAPID·iOS Safari 16.4+ 지원)
> - `docs/research/backend/14_security_open_items.md` §6 (다중 디바이스 — 각 디바이스 자체 토큰)
> - `04_feature_spec.md` §11 (알림 정책 6개 상황)

---

## 0. 카테고리 구성 & 결정 항목

| 하위 카테고리 | 후보 수 | 결정 항목 수 |
|------------|--------|------------|
| §1 PWA 인프라 (Vite 플러그인·Workbox 모드·manifest) | 4 | 2 (플러그인 + SW 모드) |
| §2 Web Push (구독·이벤트 핸들링) | — | 1 (BE pywebpush 정합 구현 패턴 — 라이브러리 결정 아님) |
| §3 인앱 알림 (BE polling 방식) | 3 | 1 (polling 라이브러리·주기) |
| §4 통합 결정 | — | §4 참조 |

### 본 research가 결정하는 항목

| 항목 | 결정 | 결정 근거 위치 |
|------|------|--------------|
| PWA 빌드 플러그인 | **vite-plugin-pwa** | §1.4 |
| Service Worker 모드 | **injectManifest** (커스텀 SW 코드 + Workbox precaching 주입) | §1.4 |
| 매니페스트 표준 | **W3C Web App Manifest** (`display: standalone`·`theme_color`·icons 다중 사이즈) | §1.5 |
| Web Push 구독 흐름 | PushManager.subscribe → `POST /api/notifications/subscribe` | §2 |
| 인앱 알림 polling | **TanStack Query `refetchInterval` 5분 고정(코드 상수)** (포그라운드만, `refetchIntervalInBackground: false`) + 수동 새로고침 버튼 | §3.4 |

---

## 1. PWA 인프라

### 1.1 전체 후보 목록

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | vite-plugin-pwa | Vite 플러그인 (Workbox 통합) | 공식 권장, generateSW + injectManifest 두 모드 |
| 2 | Workbox CLI (단독) | CLI 도구 | Vite 빌드와 별도 단계 필요 |
| 3 | 직접 SW 작성 + Workbox runtime | 수동 | precaching·매니페스트 수동 |
| 4 | Serwist | next-pwa 대안 | Next.js 우선 — Vite 지원 부분 |

### 1.2 1차 벤치마크 — 사주라 MVP 필수 기능

| # | 후보 | Vite 빌드 통합 | precaching 자동 | manifest 자동 | push 이벤트 커스텀 | 마인드셰어 | 결과 |
|---|------|:---:|:---:|:---:|:---:|:---:|:---|
| 1 | vite-plugin-pwa | ◎ | ◎ (Workbox) | ◎ | ◎ (injectManifest 모드에서 커스텀 SW) | ◎ | ✅ **통과** |
| 2 | Workbox CLI 단독 | △ (별도 단계) | ◎ | △ (수동) | △ | O | ⛔ (Vite 통합 부재) |
| 3 | 직접 SW + Workbox runtime | △ (수동) | △ (수동) | ⛔ | ◎ | ⛔ | ⛔ (보일러플레이트 큼) |
| 4 | Serwist | ⛔ (Next.js 우선) | O | O | O | △ | ⛔ |

### 1.3 SW 모드 선택 (generateSW vs injectManifest)

| 모드 | 특징 | 사주라 적합도 |
|------|------|------------|
| `generateSW` | Workbox가 SW 코드 자동 생성. 커스텀 코드 추가 불가 | △ (push 이벤트 처리 못 함) |
| `injectManifest` | 개발자가 작성한 `src/sw.ts` 파일에 Workbox precaching manifest 자동 주입 | ◎ (push·notificationclick 핸들러 작성 가능) |

→ **injectManifest 모드** 선택 — 사주라는 push 이벤트·notificationclick 처리 필수(`04_feature_spec.md` §11 6개 알림 상황 표시).

### 1.4 최종 선발

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **PWA 플러그인** | **vite-plugin-pwa** ✅ | Vite 빌드 후 manifest·precaching·SW 자동 생성. injectManifest 모드로 push 이벤트 처리 커스텀 SW 작성 가능 |
| **SW 모드** | **injectManifest** ✅ | 사주라 Web Push·notificationclick 핸들러 필요. Workbox precaching은 manifest 자동 주입으로 보존 |

### 1.5 권장 manifest

```ts
// vite.config.ts 발췌
VitePWA({
  registerType: 'autoUpdate',
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.ts',
  injectManifest: {
    globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
  },
  manifest: {
    name: '사주라 — 점주 운영 도구',
    short_name: '사주라',
    description: '재고·발주·수요예측 통합 관리',
    theme_color: '#3b82f6',
    background_color: '#ffffff',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'ko',
    start_url: '/',
    scope: '/',
    icons: [
      { src: '/icons/192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
}),
```

| 항목 | 값 | 사유 |
|------|---|------|
| `display: standalone` | — | 점주는 모바일 홈 화면에서 앱처럼 사용 |
| `orientation: portrait` | — | 모바일 세로 화면 기본 |
| 아이콘 (192·512·512-maskable·180-apple) | 4 사이즈 | iOS·Android·Windows·Chromium 모두 표준 충족 |
| `theme_color` | 사주라 브랜드 (`04_ui_styling.md` §1.5 `--color-primary` 정합) | 모바일 상태 표시줄·태스크 전환 색 |

### 1.6 캐시 전략

```ts
// src/sw.ts (injectManifest 진입)
/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);   // Vite 산출물 자동 precache

// 정적 이미지 — CacheFirst (1일 30개)
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 86_400 })],
  }),
);

// GET API (캐시 가능한 메뉴·재고 목록 등) — StaleWhileRevalidate (60s 갱신)
registerRoute(
  ({ url, request }) => request.method === 'GET' && /^\/api\/(menus|inventory|stores)/.test(url.pathname),
  new StaleWhileRevalidate({
    cacheName: 'api-cache',
    plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 })],
  }),
);

// 그 외 API — 네트워크 우선 (캐시 안 함 — 인증·민감 데이터 회피)
// 통화·예측 등 캐시 부적합 데이터는 Workbox runtime 캐시 미적용 — TanStack Query persist가 처리
```

| 자원 | 전략 | 사유 |
|------|------|------|
| HTML/JS/CSS (Vite 산출) | precache | 첫 로드 후 오프라인 동작 |
| 이미지 (`request.destination === 'image'`) | CacheFirst (1일·30개) | 정적 — 자주 변경 안 됨 |
| GET `/api/menus`·`/api/inventory`·`/api/stores` | StaleWhileRevalidate (60s) | 즉시 표시 + 백그라운드 최신화 |
| GET `/api/auth/me`·`/api/forecast`·기타 | 캐시 안 함 | 인증·민감 데이터·자주 변경 — TanStack Query persist가 별도 처리 |
| 모든 POST/PUT/PATCH/DELETE | 캐시 안 함 (Workbox 기본) | 변경 작업은 항상 네트워크 |

---

## 2. Web Push (VAPID 구독·이벤트)

### 2.1 BE 정합 가정

`docs/research/backend/06_external_integration.md` §3.4에서 결정:
- **BE 라이브러리**: pywebpush (VAPID 표준·Google 비종속·iOS Safari 16.4+)
- **DB**: `push_subscriptions(endpoint UNIQUE, p256dh, auth, user_agent)` (`08_schema.md` §3.23)
- **endpoint**: `POST /api/notifications/subscribe` · `DELETE /api/notifications/subscribe/{id}` (`07_api_spec.md` §10)
- **발송 트리거**: BE `NotificationService.create_and_push` (`09_service_design.md` §4)

FE 책임:
1. VAPID 공개 키 BE에서 받기 (환경변수 또는 `/api/notifications/vapid-public-key` endpoint — 신규 필요 여부 §2.4)
2. `Notification.requestPermission()` → `PushManager.subscribe({ applicationServerKey })`
3. 구독 정보 BE `POST /api/notifications/subscribe`로 등록
4. `sw.ts`의 `push` 이벤트 → `self.registration.showNotification(...)`
5. `notificationclick` 이벤트 → 해당 화면 라우트 이동 (`related_resource` 기반)

### 2.2 권장 SW push 핸들러

```ts
// src/sw.ts (계속)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const payload = event.data.json() as {
    title: string;
    body: string;
    related_resource?: { type: string; id: string };
    priority?: 'URGENT' | 'WARNING' | 'INFO';
  };
  const tag = payload.related_resource
    ? `${payload.related_resource.type}:${payload.related_resource.id}`
    : 'general';
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons/192.png',
      badge: '/icons/badge-72.png',
      tag,
      renotify: payload.priority === 'URGENT',
      data: payload.related_resource,
      requireInteraction: payload.priority === 'URGENT',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const resource = event.notification.data as { type: string; id: string } | undefined;
  const url = resource ? resourceToUrl(resource) : '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(url));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    }),
  );
});

function resourceToUrl({ type, id }: { type: string; id: string }) {
  switch (type) {
    case 'inventory_item': return `/inventory/${id}`;
    case 'order': return `/orders/${id}`;
    case 'forecast': return `/forecast`;
    default: return '/';
  }
}
```

| 동작 | 처리 |
|------|------|
| `push` 이벤트 수신 | BE pywebpush가 전송한 payload JSON 파싱 → `showNotification` |
| `tag` 사용 | 동일 리소스 알림 누적 회피 (예: 같은 재고 D-1 알림 1건만 표시) |
| `requireInteraction` | URGENT 우선순위(소비기한 D-1·초과) 알림은 사용자가 닫기 전까지 유지 |
| `notificationclick` | 해당 화면 라우트 이동 — 이미 열린 탭은 focus, 없으면 새 창 |

### 2.3 권한·구독 흐름 (Frontend 진입점)

```ts
// lib/web-push.ts
export async function ensurePushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (sub) return sub;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const vapidPublicKey = await fetchVapidPublicKey();   // §2.4 참고
  sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });
  await http.post('notifications/subscribe', {
    json: {
      endpoint: sub.endpoint,
      keys: sub.toJSON().keys,
      user_agent: navigator.userAgent,
    },
  });
  return sub;
}
```

### 2.4 VAPID 공개 키 전달 — BE 정합 사항 (확인 필요)

현재 `07_api_spec.md` §10에는 VAPID 공개 키 조회 endpoint가 명시되어 있지 않음. 두 가지 옵션:

| 옵션 | 방식 | 평가 |
|------|------|------|
| A. 환경변수 주입 (`VITE_VAPID_PUBLIC_KEY`) | 빌드 시 FE 번들에 inline | 단순·캐시 적합. 키 회전 시 재배포 필요 |
| B. `GET /api/notifications/vapid-public-key` 신규 endpoint | 런타임 조회 | 키 회전 유연. endpoint 1개 추가 |

**결정**: **옵션 A (환경변수 주입)** — MVP 단계에서 VAPID 키 회전 빈도 낮음(연 1회 미만 예상). 운영 비용·복잡도 회피. 키 회전 시 FE 재배포 + BE 환경변수 갱신을 동시 수행하는 정책으로 충분.

→ **BE spec 변경 없음**. VAPID 공개·비밀 키는 BE/FE 환경변수로 양쪽에 주입(`09_service_design.md` §1 pywebpush 행 정합).

---

## 3. 인앱 알림 (BE polling)

### 3.1 결정 흐름

BE NotificationService는 인앱 알림을 `notifications` 테이블에 INSERT(`09_service_design.md` §4·`07_api_spec.md` §10 `GET /api/notifications`). FE는 주기적으로 polling하여 미읽 개수·최근 알림 목록을 표시.

### 3.2 전체 후보 (polling 방식)

| # | 후보 | 분류 | 비고 |
|---|------|------|------|
| 1 | TanStack Query `refetchInterval` | client polling | §03 결정 라이브러리 재사용 |
| 2 | Server-Sent Events (SSE) | server push | BE 신규 endpoint 필요 |
| 3 | WebSocket | 양방향 | BE 신규 핸들러 필요 |

### 3.3 1차 벤치마크

| # | 후보 | BE 구현 부담 | FE 구현 부담 | 즉시성 | 배터리·네트워크 비용 | 결과 |
|---|------|:---:|:---:|:---:|:---:|:---|
| 1 TanStack Query polling | ◎ (기존 endpoint 재사용) | ◎ (1줄) | △ (간격에 따라 ~30s 지연) | O (간격 조정으로 균형) | ✅ **통과** |
| 2 SSE | △ (FastAPI SSE 가능하나 reverse proxy·keepalive·재연결 설계 추가) | O | ◎ | O | ⛔ (운영 부담) |
| 3 WebSocket | △ (FastAPI 지원·운영은 Caddy keepalive·재연결·heartbeat 설계) | △ | ◎ (양방향) | △ (idle 연결 유지) | ⛔ (MVP에 과함) |

### 3.4 판정 기준 및 탈락 사유

| 기능 | 필수도 | 근거 |
|------|-------|------|
| 즉시성 필수도 | 중간 | 인앱 알림은 Web Push가 즉시성 담당. 폴링은 보완 표시 (배지 카운트·최근 목록) |
| BE 운영 부담 최소 | **필수** | 1인 운영 — SSE·WebSocket 재연결·keepalive 설계 회피 |
| Web Push와 중복 회피 | **필수** | Web Push가 즉시 알림 책임. 폴링은 보완용 |

**탈락 사유:**

- **#2 SSE / #3 WebSocket** — 즉시성은 Web Push가 담당하므로 인앱 폴링까지 실시간일 필요 없음. BE 운영 부담(재연결·heartbeat·reverse proxy 설계)이 사주라 MVP에 과함.

### 3.5 최종 선발

| 역할 | 선택 | 결정 사유 |
|------|------|---------|
| **인앱 알림 polling** | **TanStack Query `refetchInterval: 300_000` (5분 고정·코드 상수)** ✅ | `useQuery` 1줄로 표현. 포그라운드 5분 폴링·백그라운드 비활성(`refetchIntervalInBackground: false`). Web Push가 즉시성 담당이므로 폴링은 미읽 카운트·최근 목록 보완용 — 5분 주기로 충분. 사용자 설정 미노출(BE rate limit 60/min 보호) |

### 3.6 권장 hook 패턴

```ts
// hooks/use-notifications.ts
import { useQuery } from '@tanstack/react-query';
import { http } from '@/lib/http';
import { queryKeys } from '@/app/query-keys';

// 알림 폴링 주기 — 5분 고정.
// 사유: 즉시성은 Web Push 담당, 폴링은 미읽 카운트 보완용.
// 사용자 설정 노출 안 함 (BE GET /api/notifications 60/min rate limit 보호).
const NOTIFICATION_POLLING_MS = 5 * 60_000;

export function useUnreadNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications.unread(),
    queryFn: () => http.get('notifications', { searchParams: { is_read: false, limit: 20 } }).json(),
    refetchInterval: NOTIFICATION_POLLING_MS,
    refetchIntervalInBackground: false,
    staleTime: NOTIFICATION_POLLING_MS / 2,
  });
}
```

| 옵션 | 값 | 사유 |
|------|---|------|
| `refetchInterval` 5분 | 코드 상수 (사용자 설정 미노출) | 동시 접속 20명 × 분당 0.2회 = 4 req/분 (BE 부하 무시 가능 + 모바일 배터리·데이터 절약). 즉시성은 Web Push가 담당 |
| `refetchIntervalInBackground` false | — | 탭 비활성 시 폴링 정지 — 배터리·네트워크 절약 |
| `staleTime` 2.5분 | — | 같은 화면 내 컴포넌트 mount 시 중복 refetch 회피 |

> **사용자 알림 새로고침 UX**: 점주가 즉시 갱신하고 싶을 때를 위해 알림 목록 화면에 수동 "새로고침" 버튼 제공 권장(`refetch()` 호출). 자동 폴링이 5분이라 즉시성 보완.

---

## 4. 통합 최종 결정 (spec 반영)

### 4.1 결정 항목 (4건)

| 항목 | 결정 | spec 반영 위치 |
|------|------|--------------|
| PWA 플러그인 | **vite-plugin-pwa** | FE spec 신설 시 명시 |
| Service Worker 모드 | **injectManifest** (커스텀 SW + Workbox precaching) | FE spec 신설 시 명시 |
| VAPID 공개 키 전달 | **환경변수 주입** (`VITE_VAPID_PUBLIC_KEY`) | BE spec 변경 없음 — `09_service_design.md` §1 pywebpush 정합 |
| 인앱 알림 polling | **TanStack Query `refetchInterval` 5분 고정(코드 상수) + 백그라운드 비활성 + 수동 새로고침 버튼** | FE spec 신설 시 명시 |

> 본 카테고리 결정은 BE schema/api/service 변경을 유발하지 않는다. BE `notifications`·`push_subscriptions` 테이블과 5개 endpoint(`07_api_spec.md` §10)는 그대로이며 FE가 그 계약을 따른다.

### 4.2 결정에 따라 다른 카테고리에 미치는 영향

| 영향 | 영향 받는 카테고리 |
|------|----------------|
| 환경변수 `VITE_VAPID_PUBLIC_KEY` 추가 | `10_deployment.md` (CI·환경 분리 시점에 환경변수 목록 명시) |
| SW 코드 `src/sw.ts` 추가 → 린트·타입 검사 대상 (`lib: WebWorker`) | `01_framework_build.md` §3.5 tsconfig `lib` 이미 포함 |
| 캐시 전략 — TanStack Query persist와 정합 (중복 캐시 회피) | `03_data_http.md` §1.5 persist 범위 검토 |
| Web Push 권한 요청 UX | `04_feature_spec.md` §12 — 설정 화면에서 권한 요청 트리거 화면 추가 검토 (FE spec) |

### 4.3 BE 정합 확인 사항 (변경 없음 — 기재만)

| 항목 | BE 위치 | FE 정합 |
|------|---------|--------|
| `POST /api/notifications/subscribe` | `07_api_spec.md` §10 | `ensurePushSubscription()` 1회 호출 |
| `DELETE /api/notifications/subscribe/{id}` | 동상 | 설정 화면 — 알림 끄기 |
| `GET /api/notifications` | 동상 | TanStack Query 폴링 |
| `PATCH /api/notifications/{id}/read` · `PATCH /api/notifications/read-all` | 동상 | mutation + invalidate query |
| `push_subscriptions` `user_agent` 필드 | `08_schema.md` §3.23 | `navigator.userAgent` 전달 |
| 다중 디바이스 — 각 디바이스 자체 구독 | `14_security_open_items.md` §6 | 디바이스마다 `endpoint` UNIQUE — 자연 동작 |

---

## 5. 후보 세부 정보

### 5.1 vite-plugin-pwa ✅
- **사용처**: Vite build → manifest·SW 자동 생성
- **장점**: Vite 빌드와 1단계 통합·Workbox precaching 자동·generateSW/injectManifest 양 모드·dev-server에서도 SW 동작 확인
- **단점**: injectManifest 모드는 SW 코드 직접 작성 필요 (사주라는 push 핸들러 필요로 자연)
- **세부사항**: MIT. `vite-plugin-pwa`

### 5.2 Workbox (자동 포함) ✅
- **사용처**: precacheAndRoute · routing · strategies (StaleWhileRevalidate·CacheFirst 등) · ExpirationPlugin
- **장점**: 캐시 전략 표준 추상화·Google 유지보수
- **단점**: 직접 SW에 import 시 번들 크기 영향 — vite-plugin-pwa가 tree-shake
- **세부사항**: MIT. Google

### 5.3 TanStack Query polling ✅ (재사용)
- **사용처**: 인앱 알림 미읽 목록 30s 폴링
- **장점**: 추가 라이브러리 0·`refetchIntervalInBackground` 옵션·기존 cache·DevTools
- **단점**: 즉시성은 Web Push가 담당
- **세부사항**: `03_data_http.md` §1 참조

### 5.4 탈락 후보 요약

| 후보 | 분류 | 탈락 사유 |
|------|------|---------|
| Workbox CLI 단독 | PWA | Vite 통합 부재 |
| 직접 SW + Workbox runtime | PWA | 보일러플레이트 큼 |
| Serwist | PWA | Next.js 우선 |
| SSE | 폴링 | BE 운영 부담 |
| WebSocket | 폴링 | MVP에 과함 |

---

## 6. 비교 요약 표

| 분류 | 후보 | 결과 | 핵심 사유 |
|------|------|------|---------|
| PWA 플러그인 | vite-plugin-pwa | ✅ | Vite 통합·Workbox·injectManifest 모드 |
| PWA 플러그인 | Workbox CLI 단독 | ⛔ | Vite 통합 부재 |
| PWA 플러그인 | 직접 SW | ⛔ | 보일러플레이트 |
| PWA 플러그인 | Serwist | ⛔ | Next.js 우선 |
| SW 모드 | injectManifest | ✅ | push·notificationclick 핸들러 가능 |
| SW 모드 | generateSW | ⛔ | 커스텀 코드 불가 |
| Web Push | pywebpush (BE 결정) + browser PushManager | ✅ | BE `06_external_integration.md` §3.4 정합 |
| VAPID 키 전달 | 환경변수 주입 | ✅ | MVP 단순·키 회전 빈도 낮음 |
| 인앱 폴링 | TanStack Query 5분 고정 | ✅ | 추가 라이브러리 0·배경 비활성·BE rate limit 보호 |
| 인앱 폴링 | SSE / WebSocket | ⛔ | 운영 부담·즉시성은 Web Push가 담당 |
