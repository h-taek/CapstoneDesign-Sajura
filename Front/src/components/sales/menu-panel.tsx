// 판매 데이터 메뉴 판 (08_sales.html).
import { ChevronLeft, X } from "lucide-react";
import type { SaleListItem } from "../../api/endpoints/sales";
import { formatWon } from "../../lib/format";
import { formatSaleTime } from "./calculations";

export interface MenuPanelProps {
  dayShort: string; // "10월 19일"
  dateLabel: string; // "10월 19일 (월)"
  menuName: string;
  totalQuantity: number;
  totalRevenue: number;
  sales: SaleListItem[];
  isLoading?: boolean;
  onBackToDay: () => void;
}

export function MenuPanel({
  dayShort,
  menuName,
  totalQuantity,
  totalRevenue,
  sales,
  isLoading = false,
  onBackToDay,
}: MenuPanelProps) {
  return (
    <aside
      data-panel="menu"
      data-follow
      aria-label={`${dayShort} ${menuName}`}
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
          <h2 className="min-w-0 flex-1 text-xl font-bold break-keep text-ink">{menuName}</h2>
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
          {dayShort} · <span className="font-bold text-ink">{totalQuantity}개</span> ·{" "}
          <span className="font-bold text-ink">{formatWon(totalRevenue)}</span>
        </p>

        <h3 className="mt-5 text-sm font-bold text-ink">
          판매 기록 <span className="tabular font-normal text-ink-2">{sales.length}건</span>
        </h3>

        {isLoading ? (
          <p className="mt-4 text-center text-xs text-ink-3">불러오는 중…</p>
        ) : sales.length === 0 ? (
          <p className="mt-4 text-center text-xs text-ink-3">판매 기록이 없습니다.</p>
        ) : (
          <ul className="mt-2 divide-y divide-white/70">
            {sales.map((sale) => (
              <li key={sale.sale_id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="tabular text-[0.95rem] text-ink">
                  {formatSaleTime(sale.sold_at)}
                </span>
                <span className="tabular text-sm text-ink-2">
                  <span className="font-semibold text-ink">{sale.quantity}개</span> ·{" "}
                  {formatWon(sale.total_price)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
