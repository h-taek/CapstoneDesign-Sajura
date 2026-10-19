// 재고 경고 배지 — alert_status 값 정의는 07_api_spec.md §5.
import type { AlertStatus } from "../../api/endpoints/inventory";

const BADGE: Record<AlertStatus, { label: string; className: string }> = {
  NEEDS_CHECK: { label: "재고 확인 필요", className: "bg-red-50 text-red-600" },
  EMPTY: { label: "재고 없음", className: "bg-red-50 text-red-600" },
  EXPIRED_SOON: { label: "소비기한 임박", className: "bg-amber-50 text-amber-700" },
  LOW: { label: "부족", className: "bg-amber-50 text-amber-700" },
  NORMAL: { label: "정상", className: "bg-emerald-50 text-emerald-700" },
};

export function AlertBadge({ status }: { status: AlertStatus }) {
  const { label, className } = BADGE[status];
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>{label}</span>
  );
}
