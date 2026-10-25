// 재고 경고 배지 — 판정 기준은 04_fe.md §4.6 (stock-status.ts).
import type { StockStatus } from "./stock-status";

const BADGE: Record<StockStatus, { label: string; className: string }> = {
  NEEDS_CHECK: { label: "재고 확인 필요", className: "bg-danger-soft text-danger" },
  EMPTY: { label: "재고 없음", className: "bg-danger-soft text-danger" },
  EXPIRED: { label: "소비기한 지남", className: "bg-danger-soft text-danger" },
  URGENT: { label: "소비기한 긴급", className: "bg-danger-soft text-danger" },
  SOON: { label: "소비기한 임박", className: "bg-warn-soft text-warn" },
  LOW: { label: "재고 부족", className: "bg-warn-soft text-warn" },
  NORMAL: { label: "정상", className: "bg-ok-soft text-ok" },
};

export function AlertBadge({ status }: { status: StockStatus }) {
  // 모르는 상태값이 와도 화면 전체가 멈추지 않게 한다.
  const { label, className } = BADGE[status] ?? BADGE.NEEDS_CHECK;
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold whitespace-nowrap ${className}`}
    >
      {label}
    </span>
  );
}
