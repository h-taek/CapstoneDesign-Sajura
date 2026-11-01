// 최근 발주 타일 — 06_home.html.
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { type OrderSummary, getOrder } from "../../api/endpoints/orders";
import { formatMonthDayDow } from "../../lib/format";
import { formatOrderCost } from "../orders/order-calc";

interface RecentOrderTileProps {
  order: OrderSummary;
}

export function RecentOrderTile({ order }: RecentOrderTileProps) {
  const { data: detail } = useQuery({
    queryKey: ["order-detail", order.order_id],
    queryFn: () => getOrder(order.order_id),
    staleTime: 60_000,
  });

  const firstItem = detail?.items[0];
  const extraCount = order.item_count - 1;
  const title = firstItem
    ? extraCount > 0
      ? `${firstItem.item_name} 외 ${extraCount}개`
      : firstItem.item_name
    : `품목 ${order.item_count}개`;

  const sub =
    detail?.items && detail.items.length > 1
      ? detail.items
          .slice(1)
          .map((i) => i.item_name)
          .join(" · ")
      : "";

  const isPending = detail?.items.some((i) => i.receipt_status === "PENDING") ?? false;

  return (
    <li>
      <Link
        to="/orders"
        className="flex h-full flex-col rounded-xl p-3.5 glass-card hover:bg-white/50"
      >
        <span className="self-start rounded-full bg-white/60 px-2.5 py-1 text-xs font-semibold text-ink-2">
          {formatMonthDayDow(order.approved_at)}
        </span>
        <span className="mt-3 text-[0.95rem] leading-snug font-bold text-ink">{title}</span>
        <span className="mt-0.5 truncate text-xs text-ink-3">{sub || " "}</span>
        <span className="tabular mt-auto pt-3 text-[1.35rem] leading-none font-bold tracking-tight text-ink">
          {formatOrderCost(order.total_estimated_cost)}
        </span>
        <span className="mt-1.5 flex items-center justify-between gap-2 text-xs">
          {isPending ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-warn">
              <span className="size-1.5 rounded-full bg-warn" />
              입고 대기
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-semibold text-ok">
              <span className="size-1.5 rounded-full bg-ok" />
              입고 완료
            </span>
          )}
          <span className="text-ink-3">품목 {order.item_count}개</span>
        </span>
      </Link>
    </li>
  );
}
