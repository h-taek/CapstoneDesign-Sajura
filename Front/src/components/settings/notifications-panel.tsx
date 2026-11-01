// 알림 설정 판 — 4개 알림 카테고리 스위치 + 이 기기로 푸시 받기 (Web Push).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  type NotificationSettings,
  getNotificationSettings,
  updateNotificationSettings,
} from "../../api/endpoints/notifications";
import { getPushSubscriptionStatus, subscribePush, unsubscribePush } from "../../lib/push";
import { FollowPanel } from "../shell/follow-panel";

export function NotificationsPanel({ onBack }: { onBack?: () => void }) {
  const queryClient = useQueryClient();

  const { data: settings } = useQuery<NotificationSettings>({
    queryKey: ["notifications", "settings"],
    queryFn: getNotificationSettings,
  });

  const updateMutation = useMutation({
    mutationFn: (body: Partial<NotificationSettings>) => updateNotificationSettings(body),
    onSuccess: (updated) => {
      queryClient.setQueryData(["notifications", "settings"], updated);
    },
  });

  const current = settings ?? {
    expiry: true,
    stock_low: true,
    forecast_done: true,
    anomaly: false,
  };

  const toggleCategory = (key: keyof NotificationSettings) => {
    const nextVal = !current[key];
    updateMutation.mutate({ [key]: nextVal });
  };

  // 푸시 구독 상태 관리
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushSupported, setPushSupported] = useState(true);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    getPushSubscriptionStatus().then((res) => {
      setPushSupported(res.supported);
      setPushSubscribed(res.subscribed);
    });
  }, []);

  const togglePush = async () => {
    if (pushLoading) return;
    setPushLoading(true);
    try {
      if (pushSubscribed) {
        await unsubscribePush();
        setPushSubscribed(false);
      } else {
        const res = await subscribePush();
        if (res.ok) {
          setPushSubscribed(true);
        } else {
          setPushSubscribed(false);
        }
      }
    } finally {
      setPushLoading(false);
    }
  };

  return (
    <FollowPanel
      title="알림"
      aria-label="알림"
      className="lg:col-span-3"
      {...(onBack ? { onClose: onBack } : {})}
    >
      <ul className="mt-4 divide-y divide-white/70">
        <li className="flex items-center justify-between gap-4 py-3">
          <span className="text-[0.95rem] font-semibold text-ink">소비기한 임박</span>
          <button
            type="button"
            role="switch"
            aria-checked={current.expiry}
            aria-label="소비기한 임박"
            onClick={() => toggleCategory("expiry")}
            className={`relative h-7 w-12 shrink-0 rounded-full p-1 transition-colors ${
              current.expiry ? "bg-brand" : "bg-ink-3/40"
            }`}
          >
            <span
              className={`block size-5 rounded-full bg-white shadow transition-transform ${
                current.expiry ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </li>

        <li className="flex items-center justify-between gap-4 py-3">
          <span className="text-[0.95rem] font-semibold text-ink">재고 부족</span>
          <button
            type="button"
            role="switch"
            aria-checked={current.stock_low}
            aria-label="재고 부족"
            onClick={() => toggleCategory("stock_low")}
            className={`relative h-7 w-12 shrink-0 rounded-full p-1 transition-colors ${
              current.stock_low ? "bg-brand" : "bg-ink-3/40"
            }`}
          >
            <span
              className={`block size-5 rounded-full bg-white shadow transition-transform ${
                current.stock_low ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </li>

        <li className="flex items-center justify-between gap-4 py-3">
          <span className="text-[0.95rem] font-semibold text-ink">예측 완료</span>
          <button
            type="button"
            role="switch"
            aria-checked={current.forecast_done}
            aria-label="예측 완료"
            onClick={() => toggleCategory("forecast_done")}
            className={`relative h-7 w-12 shrink-0 rounded-full p-1 transition-colors ${
              current.forecast_done ? "bg-brand" : "bg-ink-3/40"
            }`}
          >
            <span
              className={`block size-5 rounded-full bg-white shadow transition-transform ${
                current.forecast_done ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </li>

        <li className="flex items-center justify-between gap-4 py-3">
          <span className="text-[0.95rem] font-semibold text-ink">이상치 감지</span>
          <button
            type="button"
            role="switch"
            aria-checked={current.anomaly}
            aria-label="이상치 감지"
            onClick={() => toggleCategory("anomaly")}
            className={`relative h-7 w-12 shrink-0 rounded-full p-1 transition-colors ${
              current.anomaly ? "bg-brand" : "bg-ink-3/40"
            }`}
          >
            <span
              className={`block size-5 rounded-full bg-white shadow transition-transform ${
                current.anomaly ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </li>
      </ul>

      {/* 이 기기 푸시 */}
      <section className="mt-6 border-t border-white/70 pt-5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[0.95rem] font-semibold text-ink">이 기기로 푸시 받기</span>
          <button
            type="button"
            role="switch"
            disabled={!pushSupported || pushLoading}
            aria-checked={pushSubscribed}
            aria-label="이 기기로 푸시 받기"
            onClick={togglePush}
            className={`relative h-7 w-12 shrink-0 rounded-full p-1 transition-colors disabled:opacity-50 ${
              pushSubscribed ? "bg-brand" : "bg-ink-3/40"
            }`}
          >
            <span
              className={`block size-5 rounded-full bg-white shadow transition-transform ${
                pushSubscribed ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </section>
    </FollowPanel>
  );
}
