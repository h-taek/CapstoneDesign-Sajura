/// <reference lib="webworker" />
// vite-plugin-pwa injectManifest — 04_fe.md §6 PWA.
// - 정적 자산 precache(CacheFirst) + 화면 이동은 오프라인이어도 index.html로 열리게 한다.
// - API(/api/*)는 캐시하지 않는다(NetworkOnly — 캐시는 TanStack Query 담당).
// - 새 버전 배포 시 바로 교체(registerType: autoUpdate).
// - push 페이로드 처리는 Phase 11 dashboard·알림에서 채워 넣는다.
import { clientsClaim } from "workbox-core";
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// SPA 라우트(/orders 등)를 홈 화면 앱에서 새로 열어도 흰 화면이 나오지 않게 한다.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("/index.html"), { denylist: [/^\/api\//] }),
);

self.addEventListener("push", (event: PushEvent) => {
  const data = event.data?.json() ?? {};
  const title: string = data.title ?? "사주라";
  const options: NotificationOptions = {
    body: data.body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: data.url ?? "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string })?.url ?? "/";
  event.waitUntil(self.clients.openWindow(url));
});
