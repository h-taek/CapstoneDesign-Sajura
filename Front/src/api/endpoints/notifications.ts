// 알림 및 웹 푸시 API — 02_implementation_design.md §3.10, 01_basic_design.md §3.12·§4.11, 04_fe.md §4.3.
import { api } from "../../lib/api";
import type { components } from "../types.gen";

type S = components["schemas"];

export type NotificationItem = S["NotificationItem"];
export type NotificationListResponse = S["NotificationListResponse"];
export type NotificationSettings = S["NotificationSettings"];
export type NotificationSettingsUpdate = S["NotificationSettingsUpdate"];
export type SubscribeRequest = S["SubscribeRequest"];
export type SubscribeResponse = S["SubscribeResponse"];
export type PushKeys = S["PushKeys"];

export interface NotificationListParams {
  is_read?: boolean;
  page?: number;
  size?: number;
}

/** 알림 폴링 주기 — 5분 상수 (04_fe.md §5.2). */
export const NOTIFICATION_POLL_INTERVAL_MS = 5 * 60_000;

/** 알림 목록 조회 (`GET /api/notifications`). */
export async function listNotifications(
  params?: NotificationListParams,
): Promise<NotificationListResponse> {
  const searchParams: Record<string, string | number | boolean> = {};
  if (params?.is_read !== undefined) searchParams.is_read = params.is_read;
  if (params?.page !== undefined) searchParams.page = params.page;
  if (params?.size !== undefined) searchParams.size = params.size;
  return api.get("notifications", { searchParams }).json<NotificationListResponse>();
}

/** 단건 읽음 처리 (`PATCH /api/notifications/{notification_id}/read`). */
export async function markNotificationRead(notificationId: string): Promise<void> {
  await api.patch(`notifications/${encodeURIComponent(notificationId)}/read`);
}

/** 전체 읽음 처리 (`PATCH /api/notifications/read-all`). */
export async function markAllNotificationsRead(): Promise<void> {
  await api.patch("notifications/read-all");
}

/** 알림 수신 설정 조회 (`GET /api/notifications/settings`). */
export async function getNotificationSettings(): Promise<NotificationSettings> {
  return api.get("notifications/settings").json<NotificationSettings>();
}

/** 알림 수신 설정 변경 (`PATCH /api/notifications/settings`). */
export async function updateNotificationSettings(
  payload: NotificationSettingsUpdate,
): Promise<NotificationSettings> {
  return api.patch("notifications/settings", { json: payload }).json<NotificationSettings>();
}

/** 웹 푸시 구독 등록 (`POST /api/notifications/subscribe`). */
export async function createPushSubscription(
  payload: SubscribeRequest,
): Promise<SubscribeResponse> {
  return api.post("notifications/subscribe", { json: payload }).json<SubscribeResponse>();
}

/** 웹 푸시 구독 해제 (`DELETE /api/notifications/subscribe/{subscription_id}`). */
export async function deletePushSubscription(subscriptionId: string): Promise<void> {
  await api.delete(`notifications/subscribe/${encodeURIComponent(subscriptionId)}`);
}

// BE 알림 종류·긴급도 — Back/app/models/notification.py. 생성 타입은 문자열이라 값은 여기서 맞춘다
const PRIORITY_RANK: Record<string, number> = { URGENT: 0, WARNING: 1, INFO: 2 };

/** 알림을 긴급 → 경고 → 정보 순으로 정렬한다. 같은 긴급도는 BE 순서(최신순)를 둔다 (04_fe.md §4.3). */
export function sortNotifications<T extends Pick<NotificationItem, "priority">>(
  items: readonly T[],
): T[] {
  const rank = (n: T) => PRIORITY_RANK[n.priority] ?? 2;
  return [...items].sort((a, b) => rank(a) - rank(b));
}

// 알림을 눌렀을 때 갈 화면 (01_basic_design.md §4.11, BE PUSH_URL과 같다)
const TARGET_PATH: Record<string, string> = {
  STOCK_LOW: "/inventory",
  EXPIRY_D3: "/inventory",
  EXPIRY_D1: "/inventory",
  EXPIRY_OVER: "/inventory",
  FORECAST_DONE: "/orders",
  ANOMALY_HIGH: "/sales",
};

export function notificationTargetPath(n: Pick<NotificationItem, "type">): string {
  return TARGET_PATH[n.type] ?? "/";
}

/** 안 읽은 알림 점 색 — 긴급은 위험색, 경고는 경고색, 정보는 포인트색. */
export function notificationDotClass(n: Pick<NotificationItem, "priority" | "is_read">): string {
  if (n.is_read) return "";
  const rank = PRIORITY_RANK[n.priority] ?? 2;
  return rank === 0 ? "bg-danger" : rank === 1 ? "bg-warn" : "bg-brand";
}
