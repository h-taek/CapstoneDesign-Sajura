// 발주 이력 목록 컴포넌트 — 04_fe.md §4.8, 목업 10_orders.html lines 214~259.
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { type OrderSummary, getOrder } from "../../api/endpoints/orders";
import { formatMonthDayDow, formatQty, formatWon } from "../../lib/format";
import { cn } from "../../lib/utils";
import { CountUp } from "../ui/count-up";
import { formatOrderCost } from "./order-calc";

function OrderHistoryItem({
  order,
  defaultOpen = false,
}: { order: OrderSummary; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  const { data: detail, isLoading } = useQuery({
    queryKey: ["orders", order.order_id],
    queryFn: () => getOrder(order.order_id),
    enabled: open,
    staleTime: 60_000,
  });

  const dayText = formatMonthDayDow(order.approved_at);

  // 상세 품목이 로드되었으면 첫 번째 품목명 외 N개, 아니면 품목 N개
  let titleText = `품목 ${order.item_count}개`;
  let pendingCount = order.item_count;
  let receivedCount = 0;

  if (detail && detail.items.length > 0) {
    const firstItem = detail.items[0]!;
    const remainingCount = detail.items.length - 1;
    titleText =
      remainingCount > 0 ? `${firstItem.item_name} 외 ${remainingCount}개` : firstItem.item_name;

    pendingCount = detail.items.filter((i) => i.receipt_status === "PENDING").length;
    receivedCount = detail.items.filter((i) => i.receipt_status === "RECEIVED").length;
  }

  const hasPending = pendingCount > 0;

  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-3 py-3.5 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink-2">{dayText}</span>
          <span className="mt-0.5 block truncate text-[0.95rem] font-bold text-ink">
            {titleText}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="tabular block text-[0.95rem] font-bold text-ink">
            <CountUp value={order.total_estimated_cost} format={formatOrderCost} />
          </span>
          <span
            className={cn(
              "mt-0.5 inline-flex items-center gap-1.5 text-xs font-semibold",
              hasPending ? "text-warn" : "text-ok",
            )}
          >
            <span className={cn("size-1.5 rounded-full", hasPending ? "bg-warn" : "bg-ok")} />
            {hasPending
              ? `입고 대기 ${pendingCount}`
              : `입고 완료 ${receivedCount || order.item_count}`}
          </span>
        </span>
        <ChevronDown
          className={cn("size-5 text-ink-2 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="mb-3 rounded-xl px-3.5 py-2 text-sm glass-card">
          {isLoading || !detail ? (
            <p className="py-2 text-ink-3">불러오는 중…</p>
          ) : (
            <>
              <ul>
                {detail.items.map((item) => (
                  <li
                    key={item.order_item_id}
                    className="flex items-baseline justify-between gap-3 py-1.5"
                  >
                    <span className="min-w-0 text-ink">
                      {item.item_name}{" "}
                      <span className="tabular text-ink-2">
                        {formatQty(item.final_quantity)} {item.unit}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-baseline gap-3">
                      <span className="tabular text-ink">
                        {item.subtotal != null ? formatWon(item.subtotal) : "—"}
                      </span>
                      <span
                        className={cn(
                          "w-16 text-right text-xs font-semibold",
                          item.receipt_status === "RECEIVED"
                            ? "text-ok"
                            : item.receipt_status === "PENDING"
                              ? "text-warn"
                              : "text-ink-3",
                        )}
                      >
                        {item.receipt_status === "RECEIVED"
                          ? "입고 완료"
                          : item.receipt_status === "PENDING"
                            ? "입고 대기"
                            : "입고 안 함"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              {detail.note && <p className="mt-1.5 text-xs text-ink-2">메모 · {detail.note}</p>}
            </>
          )}
        </div>
      )}
    </li>
  );
}

export function OrderHistory({ orders }: { orders: OrderSummary[] }) {
  if (orders.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl px-5 pt-4 pb-1 glass-card">
      <h2 className="text-lg font-bold text-ink">발주 이력</h2>
      <ul className="mt-1 divide-y divide-white/70">
        {orders.map((order, idx) => (
          <OrderHistoryItem key={order.order_id} order={order} defaultOpen={idx === 0} />
        ))}
      </ul>
    </section>
  );
}
