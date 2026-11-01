// 판매 데이터 전체 기록 판 (08_sales.html).
import { ChevronLeft, X } from "lucide-react";
import type { SaleListItem } from "../../api/endpoints/sales";
import { formatWon } from "../../lib/format";
import { formatSaleTime } from "./calculations";

export interface AllSalesPanelProps {
  dayShort: string; // "10월 19일"
  dateLabel: string; // "10월 19일 (월)"
  sales: SaleListItem[];
  totalCount: number;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  onBackToDay: () => void;
}

export function AllSalesPanel({
  dayShort,
  sales,
  totalCount,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  onBackToDay,
}: AllSalesPanelProps) {
  return (
    <aside
      data-panel="all"
      data-follow
      aria-label={`${dayShort} 판매 기록`}
      className="fixed inset-0 z-[60] overflow-y-auto lg:relative lg:inset-auto lg:z-auto lg:col-span-3 xl:col-span-2 lg:self-stretch lg:overflow-visible"
    >
      <div className="glass-card min-h-full px-4 pt-[5.25rem] pb-28 lg:sticky lg:top-[5.25rem] lg:max-h-[calc(100vh-6.25rem)] lg:min-h-0 lg:overflow-y-auto lg:rounded-2xl lg:p-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={`${dayShort}로`}
            onClick={onBackToDay}
            className="-ml-2 flex size-10 items-center justify-center rounded-full text-ink-2 hover:bg-white/60 xl:hidden"
          >
            <ChevronLeft className="size-6" />
          </button>
          <h2 className="min-w-0 flex-1 truncate text-xl font-bold text-ink">판매 기록</h2>
          <button
            type="button"
            aria-label="닫기"
            onClick={onBackToDay}
            className="hidden size-10 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-white/60 xl:flex"
          >
            <X className="size-5" />
          </button>
        </div>

        <p className="tabular mt-1 text-[0.95rem] text-ink-2">
          {dayShort} · <span className="font-bold text-ink">{totalCount}건</span>
        </p>

        {sales.length === 0 ? (
          <p className="mt-4 text-center text-xs text-ink-3">판매 기록이 없습니다.</p>
        ) : (
          <ul className="mt-4 divide-y divide-white/70">
            {sales.map((sale) => (
              <li
                key={sale.sale_id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-2"
              >
                <span className="min-w-0 text-[0.95rem] break-keep text-ink">{sale.menu_name}</span>
                <span className="tabular text-right text-[0.95rem] font-semibold text-ink">
                  {formatWon(sale.total_price)}
                </span>
                <span className="tabular text-sm text-ink-2">{formatSaleTime(sale.sold_at)}</span>
                <span className="tabular text-right text-sm text-ink-2">{sale.quantity}개</span>
              </li>
            ))}
          </ul>
        )}

        {hasMore ? (
          <button
            type="button"
            disabled={isLoadingMore}
            onClick={onLoadMore}
            className="mt-3 h-10 w-full rounded-full border border-white/80 text-sm font-semibold text-ink-2 hover:bg-white/30 disabled:opacity-50"
          >
            {isLoadingMore ? "불러오는 중…" : "더 보기"}
          </button>
        ) : null}
      </div>
    </aside>
  );
}
