// 재고 경고 배지 — 판정 기준은 04_fe.md §4.6 (stock-status.ts).
import type { StockStatus } from "./stock-status";

const BADGE: Record<StockStatus, { label: string; className: string }> = {
  NEEDS_CHECK: { label: "재고 확인 필요", className: "bg-red-50 text-red-600" },
  EMPTY: { label: "재고 없음", className: "bg-red-50 text-red-600" },
  EXPIRED: { label: "소비기한 지남", className: "bg-red-50 text-red-600" },
  URGENT: { label: "소비기한 긴급", className: "bg-orange-50 text-orange-700" },
  SOON: { label: "소비기한 임박", className: "bg-amber-50 text-amber-700" },
  LOW: { label: "재고 부족", className: "bg-amber-50 text-amber-700" },
  NORMAL: { label: "정상", className: "bg-emerald-50 text-emerald-700" },
};

export function AlertBadge({ status }: { status: StockStatus }) {
  const { label, className } = BADGE[status];
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>{label}</span>
  );
}
