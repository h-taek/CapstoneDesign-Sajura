// Web Push 구독·해지 도우미 (04_fe.md §6, 02_implementation_design.md §3.10).
import { createPushSubscription, deletePushSubscription } from "../api/endpoints/notifications";

export const PUSH_SUBSCRIPTION_ID_KEY = "sajura:push-subscription-id";

export type PushFailureReason =
  | "missing_vapid_key"
  | "unsupported"
  | "permission_denied"
  | "invalid_subscription"
  | "error";

export type PushSubscribeResult =
  | { ok: true; subscriptionId: string }
  | { ok: false; reason: PushFailureReason; message: string };

export interface PushOptions {
  vapidPublicKey?: string;
}

export interface PushSubscriptionStatus {
  supported: boolean;
  vapidConfigured: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
  subscriptionId: string | null;
}

export function getVapidPublicKey(overrideKey?: string): string {
  if (overrideKey !== undefined) return overrideKey.trim();
  const envKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  return typeof envKey === "string" ? envKey.trim() : "";
}

export function isPushSupported(): boolean {
  return (
    typeof globalThis !== "undefined" &&
    "Notification" in globalThis &&
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in globalThis
  );
}

let memorySubscriptionId: string | null = null;

export function getStoredSubscriptionId(): string | null {
  try {
    if (typeof localStorage !== "undefined" && typeof localStorage?.getItem === "function") {
      return localStorage.getItem(PUSH_SUBSCRIPTION_ID_KEY);
    }
  } catch {
    // 스토리지 접근 불가 환경에서는 메모리 값 사용
  }
  return memorySubscriptionId;
}

export function setStoredSubscriptionId(subscriptionId: string | null): void {
  memorySubscriptionId = subscriptionId;
  try {
    if (typeof localStorage !== "undefined" && typeof localStorage?.setItem === "function") {
      if (subscriptionId) {
        localStorage.setItem(PUSH_SUBSCRIPTION_ID_KEY, subscriptionId);
      } else {
        localStorage.removeItem(PUSH_SUBSCRIPTION_ID_KEY);
      }
    }
  } catch {
    // 스토리지 접근 불가 환경에서는 무시
  }
}

// Base64URL 형식의 VAPID 공개 키를 PushManager.subscribe용 Uint8Array로 바꾼다.
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// 현재 브라우저의 푸시 지원·권한·구독 상태를 확인한다.
export async function getPushSubscriptionStatus(
  options: PushOptions = {},
): Promise<PushSubscriptionStatus> {
  const vapidConfigured = Boolean(getVapidPublicKey(options.vapidPublicKey));
  if (!isPushSupported()) {
    return {
      supported: false,
      vapidConfigured,
      permission: "unsupported",
      subscribed: false,
      subscriptionId: null,
    };
  }
  const permission = Notification.permission;
  const subscriptionId = getStoredSubscriptionId();
  if (permission !== "granted") {
    return {
      supported: true,
      vapidConfigured,
      permission,
      subscribed: false,
      subscriptionId,
    };
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    return {
      supported: true,
      vapidConfigured,
      permission,
      subscribed: Boolean(sub && subscriptionId),
      subscriptionId,
    };
  } catch {
    return {
      supported: true,
      vapidConfigured,
      permission,
      subscribed: Boolean(subscriptionId),
      subscriptionId,
    };
  }
}

// VITE_VAPID_PUBLIC_KEY로 브라우저 PushManager 구독을 만들고 BE /api/notifications/subscribe로 등록한다.
export async function subscribePush(options: PushOptions = {}): Promise<PushSubscribeResult> {
  const vapidKey = getVapidPublicKey(options.vapidPublicKey);
  if (!vapidKey) {
    return {
      ok: false,
      reason: "missing_vapid_key",
      message: "푸시 공개 키가 설정되지 않았습니다.",
    };
  }

  if (!isPushSupported()) {
    return {
      ok: false,
      reason: "unsupported",
      message: "이 브라우저는 웹 푸시를 지원하지 않습니다.",
    };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return {
      ok: false,
      reason: "permission_denied",
      message: "알림 권한이 거부되었습니다.",
    };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      }));

    const json = subscription.toJSON();
    const endpoint = json.endpoint || subscription.endpoint;
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;
    if (!endpoint || !p256dh || !auth) {
      return {
        ok: false,
        reason: "invalid_subscription",
        message: "구독 키를 읽을 수 없습니다.",
      };
    }

    const res = await createPushSubscription({
      endpoint,
      keys: { p256dh, auth },
      user_agent: navigator.userAgent,
    });
    setStoredSubscriptionId(res.subscription_id);
    return {
      ok: true,
      subscriptionId: res.subscription_id,
    };
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      message: err instanceof Error && err.message ? err.message : "푸시 구독에 실패했습니다.",
    };
  }
}

// 브라우저 PushManager 구독을 해제하고 BE /api/notifications/subscribe/{subscription_id}를 부른다.
export async function unsubscribePush(subscriptionId?: string | null): Promise<boolean> {
  const targetId = subscriptionId ?? getStoredSubscriptionId();
  if (isPushSupported()) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        await existing.unsubscribe();
      }
    } catch {
      // 브라우저 구독 해지 실패 시에도 서버 구독 해제는 시도한다
    }
  }
  if (targetId) {
    await deletePushSubscription(targetId);
  }
  setStoredSubscriptionId(null);
  return true;
}
