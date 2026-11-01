// Web Push 구독·해지 단위 시험 — VAPID 키 없음·권한 거부·구독 등록·해지 (04_fe.md §6).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as notificationsApi from "../api/endpoints/notifications";
import {
  getStoredSubscriptionId,
  setStoredSubscriptionId,
  subscribePush,
  unsubscribePush,
  urlBase64ToUint8Array,
} from "../lib/push";

const SAMPLE_VAPID_KEY =
  "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";

function installPushEnvironment(options: {
  permission?: NotificationPermission;
  requestPermissionResult?: NotificationPermission;
  existingSubscription?: PushSubscription | null;
  newSubscription?: PushSubscription;
}) {
  const requestPermission = vi
    .fn<() => Promise<NotificationPermission>>()
    .mockResolvedValue(options.requestPermissionResult ?? "granted");

  Object.defineProperty(globalThis, "Notification", {
    value: {
      permission: options.permission ?? "default",
      requestPermission,
    },
    configurable: true,
    writable: true,
  });

  Object.defineProperty(globalThis, "PushManager", {
    value: class {},
    configurable: true,
    writable: true,
  });

  const defaultSub = {
    endpoint: "https://fcm.googleapis.com/fcm/send/sub-1",
    unsubscribe: vi.fn().mockResolvedValue(true),
    toJSON: () => ({
      endpoint: "https://fcm.googleapis.com/fcm/send/sub-1",
      keys: {
        p256dh: "p256dh-key-1",
        auth: "auth-key-1",
      },
    }),
  } as unknown as PushSubscription;

  const getSubscription = vi.fn().mockResolvedValue(options.existingSubscription ?? null);
  const subscribe = vi.fn().mockResolvedValue(options.newSubscription ?? defaultSub);

  Object.defineProperty(navigator, "serviceWorker", {
    value: {
      ready: Promise.resolve({
        pushManager: {
          getSubscription,
          subscribe,
        },
      }),
    },
    configurable: true,
  });

  return { requestPermission, getSubscription, subscribe, defaultSub };
}

describe("Web Push 도우미 (src/lib/push.ts)", () => {
  beforeEach(() => {
    setStoredSubscriptionId(null);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    setStoredSubscriptionId(null);
    vi.restoreAllMocks();
  });

  it("VITE_VAPID_PUBLIC_KEY가 비어 있으면 missing_vapid_key로 실패하고 서버를 부르지 않는다", async () => {
    const subSpy = vi.spyOn(notificationsApi, "createPushSubscription");

    const res = await subscribePush({ vapidPublicKey: "" });
    expect(res).toEqual({
      ok: false,
      reason: "missing_vapid_key",
      message: "푸시 공개 키가 설정되지 않았습니다.",
    });
    expect(subSpy).not.toHaveBeenCalled();
  });

  it("알림 권한이 거부되면 permission_denied를 돌려주고 서버 subscribe를 부르지 않는다", async () => {
    const { requestPermission, subscribe } = installPushEnvironment({
      requestPermissionResult: "denied",
    });
    const subSpy = vi.spyOn(notificationsApi, "createPushSubscription");

    const res = await subscribePush({ vapidPublicKey: SAMPLE_VAPID_KEY });
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(res).toEqual({
      ok: false,
      reason: "permission_denied",
      message: "알림 권한이 거부되었습니다.",
    });
    expect(subscribe).not.toHaveBeenCalled();
    expect(subSpy).not.toHaveBeenCalled();
  });

  it("권한이 허용되면 VAPID 키로 구독을 만들어 BE subscribe에 보내고 subscription_id를 저장한다", async () => {
    const { subscribe } = installPushEnvironment({
      requestPermissionResult: "granted",
    });
    const subSpy = vi
      .spyOn(notificationsApi, "createPushSubscription")
      .mockResolvedValue({ subscription_id: "sub-uuid-1" });

    const res = await subscribePush({ vapidPublicKey: SAMPLE_VAPID_KEY });
    expect(res).toEqual({
      ok: true,
      subscriptionId: "sub-uuid-1",
    });
    expect(subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(SAMPLE_VAPID_KEY),
    });
    expect(subSpy).toHaveBeenCalledWith({
      endpoint: "https://fcm.googleapis.com/fcm/send/sub-1",
      keys: { p256dh: "p256dh-key-1", auth: "auth-key-1" },
      user_agent: navigator.userAgent,
    });
    expect(getStoredSubscriptionId()).toBe("sub-uuid-1");
  });

  it("unsubscribePush는 브라우저 구독을 해지하고 BE DELETE /notifications/subscribe/{id}를 호출한다", async () => {
    const unsubscribeMock = vi.fn().mockResolvedValue(true);
    const existingSub = {
      endpoint: "https://fcm.googleapis.com/fcm/send/sub-1",
      unsubscribe: unsubscribeMock,
      toJSON: () => ({}),
    } as unknown as PushSubscription;

    installPushEnvironment({ existingSubscription: existingSub });
    setStoredSubscriptionId("sub-uuid-1");

    const unsubSpy = vi.spyOn(notificationsApi, "deletePushSubscription").mockResolvedValue();

    const ok = await unsubscribePush();
    expect(ok).toBe(true);
    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
    expect(unsubSpy).toHaveBeenCalledWith("sub-uuid-1");
    expect(getStoredSubscriptionId()).toBeNull();
  });
});
