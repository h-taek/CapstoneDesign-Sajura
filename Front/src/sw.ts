/// <reference lib="webworker" />
// vite-plugin-pwa injectManifest — 10_frontend_design.md §1 PWA.
// Phase 2 시점에는 precache + push 기본 핸들러만 둠. 실제 push 페이로드
// 처리는 Phase 11 dashboard·알림에서 채워 넣는다.
import { precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("push", (event: PushEvent) => {
  const data = event.data?.json() ?? {};
  const title: string = data.title ?? "사주라";
  const options: NotificationOptions = {
    body: data.body,
    icon: "/icon-192.png",
    data: { url: data.url ?? "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string })?.url ?? "/";
  event.waitUntil(self.clients.openWindow(url));
});
