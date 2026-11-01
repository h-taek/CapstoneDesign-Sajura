// 알림 팝오버 및 종 버튼 — 5분 주기 폴링 + 우선순위 정렬(URGENT→WARNING→INFO) + POS 끊김 상단 고정 (04_fe.md §4.3, mockup.js).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bell } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router";
import {
  NOTIFICATION_POLL_INTERVAL_MS,
  type NotificationItem,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationDotClass,
  notificationTargetPath,
  sortNotifications,
} from "../../api/endpoints/notifications";
import { getPosStatus } from "../../api/endpoints/pos";
import { cn } from "../../lib/utils";
import { useAuthStore } from "../../stores/auth-store";

/** ISO 시각 문자열을 한국어 상대 시각으로 바꾼다. */
export function formatNotificationTime(iso?: string, now: Date = new Date()): string {
  if (!iso) return "";
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return iso;
  const diffSec = Math.max(0, Math.floor((now.getTime() - time) / 1000));
  if (diffSec < 60) return "방금";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return "어제";
  if (diffDay < 7) return `${diffDay}일 전`;
  const d = new Date(time);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** 알림 관리 훅 — 5분 주기 폴링과 POS 상태 조회를 묶는다. */
export function useShellNotifications(enabled = true) {
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listNotifications({ page: 1, size: 20 }),
    refetchInterval: NOTIFICATION_POLL_INTERVAL_MS,
    enabled,
    retry: false,
  });

  const posQuery = useQuery({
    queryKey: ["pos", "status"],
    queryFn: getPosStatus,
    refetchInterval: NOTIFICATION_POLL_INTERVAL_MS,
    enabled,
    retry: false,
  });

  const readOneMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const readAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const rawItems = notificationsQuery.data?.items ?? [];
  const sortedItems = sortNotifications(rawItems);
  const posStatus = posQuery.data?.status;
  const isPosAlert = posStatus === "ERROR" || posStatus === "DISCONNECTED";

  const apiUnread = sortedItems.filter((item) => !item.is_read).length;
  const unreadCount = apiUnread + (isPosAlert ? 1 : 0);

  return {
    items: sortedItems,
    isPosAlert,
    unreadCount,
    isLoading: notificationsQuery.isLoading,
    markRead: (id: string) => readOneMutation.mutate(id),
    markAllRead: () => readAllMutation.mutate(),
    isMarkingAll: readAllMutation.isPending,
  };
}

export interface NotificationBellButtonProps {
  open: boolean;
  unreadCount: number;
  onToggle: () => void;
  variant?: "web" | "app";
  className?: string;
}

export function NotificationBellButton({
  open,
  unreadCount,
  onToggle,
  variant = "web",
  className,
}: NotificationBellButtonProps) {
  const label = unreadCount > 0 ? `알림, 안 읽음 ${unreadCount}개` : "알림";
  const isWeb = variant === "web";

  return (
    <button
      type="button"
      data-notif-toggle
      aria-label={label}
      aria-expanded={open}
      aria-haspopup="dialog"
      onClick={onToggle}
      className={cn(
        isWeb
          ? "glass-bar relative flex size-12 items-center justify-center rounded-full text-ink-2 hover:text-ink"
          : "relative flex size-10 items-center justify-center rounded-full text-ink-2 hover:bg-white/40 hover:text-ink",
        className,
      )}
    >
      <Bell className="size-5" />
      {unreadCount > 0 ? (
        <span
          data-testid="notif-badge"
          className={cn(
            " absolute size-2 rounded-full bg-danger ring-2 ring-white",
            isWeb ? "top-2.5 right-2.5" : "top-2 right-2",
          )}
        />
      ) : null}
    </button>
  );
}

export interface NotificationPopoverProps {
  open: boolean;
  onClose: () => void;
  items: NotificationItem[];
  isPosAlert: boolean;
  onMarkRead?: (notificationId: string) => void;
  onMarkAllRead?: () => void;
  isMarkingAll?: boolean;
}

export function NotificationPopover({
  open,
  onClose,
  items,
  isPosAlert,
  onMarkRead,
  onMarkAllRead,
  isMarkingAll = false,
}: NotificationPopoverProps) {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLDialogElement | null>(null);
  const sorted = sortNotifications(items);

  useEffect(() => {
    if (!open) return;

    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target) return;
      if (sectionRef.current?.contains(target)) return;
      if (target.closest("[data-notif-toggle]")) return;
      onClose();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleItemClick = (n: NotificationItem) => {
    if (!n.is_read) {
      onMarkRead?.(n.notification_id);
    }
    onClose();
    navigate(notificationTargetPath(n));
  };

  return (
    <dialog
      open
      ref={sectionRef}
      aria-label="알림"
      className="glass-strong fixed top-[4.5rem] right-3 left-3 z-50 m-0 w-auto max-w-sm rounded-2xl p-0 text-ink sm:left-auto sm:w-full lg:top-20 lg:right-16 xl:right-24"
    >
      <header className="flex items-center justify-between border-b border-white/70 px-4 py-3">
        <h2 className="text-base font-bold text-ink">알림</h2>
        <button
          type="button"
          disabled={isMarkingAll}
          onClick={() => onMarkAllRead?.()}
          className="text-xs font-semibold text-brand hover:underline disabled:opacity-50"
        >
          모두 읽음
        </button>
      </header>

      <ul className="max-h-96 divide-y divide-white/70 overflow-y-auto">
        {isPosAlert ? (
          <li className="bg-danger-soft/40">
            <Link
              to="/settings/pos"
              onClick={onClose}
              className="flex gap-3 px-4 py-3 hover:bg-danger-soft/70"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">POS 연동이 끊겼어요</p>
                <p className="mt-0.5 text-xs text-ink-2">
                  새 매출이 들어오지 않아요. 눌러서 다시 연동하세요.
                </p>
              </div>
            </Link>
          </li>
        ) : null}

        {sorted.length === 0 && !isPosAlert ? (
          <li className="px-4 py-8 text-center text-sm text-ink-3">새로운 알림이 없어요.</li>
        ) : (
          sorted.map((n) => {
            const dotClass = notificationDotClass(n);
            const targetPath = notificationTargetPath(n);
            return (
              <li key={n.notification_id}>
                <Link
                  to={targetPath}
                  onClick={(e) => {
                    e.preventDefault();
                    handleItemClick(n);
                  }}
                  className="flex gap-3 px-4 py-3 hover:bg-white/30"
                >
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", dotClass)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p
                        className={cn(
                          "truncate text-sm font-semibold",
                          n.is_read ? "text-ink-3" : "text-ink",
                        )}
                      >
                        {n.title}
                      </p>
                      <span className="tabular shrink-0 text-xs text-ink-3">
                        {formatNotificationTime(n.created_at)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-2">{n.body}</p>
                  </div>
                </Link>
              </li>
            );
          })
        )}
      </ul>

      <footer className="border-t border-white/70 px-4 py-2.5 text-right">
        <Link
          to="/settings/notifications"
          onClick={onClose}
          className="text-xs font-semibold text-ink-2 hover:text-ink"
        >
          알림 설정
        </Link>
      </footer>
    </dialog>
  );
}

/** 인증 상태를 자동 반영하는 연결형 알림 팝오버·벨 묶음. */
export function useConnectedNotifications() {
  const hasUser = useAuthStore((s) => Boolean(s.user || s.accessToken));
  return useShellNotifications(hasUser);
}
