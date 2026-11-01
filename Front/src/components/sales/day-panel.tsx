// 판매 데이터 날짜 판 (08_sales.html).
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { formatWon } from "../../lib/format";
import type { DayAggregatedDetails, MenuItemSalesSummary } from "./calculations";
import { HourlySalesChart } from "./hourly-sales-chart";

export interface DayPanelProps {
  dateLabel: string;
  totalQuantity: number;
  totalRevenue: number;
  details?: DayAggregatedDetails | undefined;
  isLoading?: boolean;
  selectedMenuId?: string | null | undefined;
  isAllSelected?: boolean;
  onClose: () => void;
  onSelectMenu: (menu: MenuItemSalesSummary) => void;
  onSelectAll: () => void;
  hideOnMediumWhenThirdOpen?: boolean; // 1024~1279px에서 세 번째 판이 열리면 숨김
}

export function DayPanel({
  dateLabel,
  totalQuantity,
  totalRevenue,
  details,
  isLoading = false,
  selectedMenuId,
  isAllSelected = false,
  onClose,
  onSelectMenu,
  onSelectAll,
  hideOnMediumWhenThirdOpen = false,
}: DayPanelProps) {
  return (
    <aside
      data-panel="day"
      data-follow
      aria-label={dateLabel}
      className={`fixed inset-0 z-50 overflow-y-auto lg:relative lg:inset-auto lg:z-auto lg:col-span-3 lg:self-stretch lg:overflow-visible ${
        hideOnMediumWhenThirdOpen ? "max-xl:hidden xl:col-span-2" : ""
      }`}
    >
      <div className="glass-card min-h-full px-4 pt-[5.25rem] pb-28 lg:sticky lg:top-[5.25rem] lg:max-h-[calc(100vh-6.25rem)] lg:min-h-0 lg:overflow-y-auto lg:rounded-2xl lg:p-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="목록으로"
            onClick={onClose}
            className="-ml-2 flex size-10 items-center justify-center rounded-full text-ink-2 hover:bg-white/60 lg:hidden"
          >
            <ChevronLeft className="size-6" />
          </button>
          <h2 className="min-w-0 flex-1 truncate text-xl font-bold text-ink">{dateLabel}</h2>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="hidden size-10 items-center justify-center rounded-full text-ink-2 hover:bg-white/60 lg:flex"
          >
            <X className="size-5" />
          </button>
        </div>

        <p className="tabular mt-1 text-[0.95rem] text-ink-2">
          <span className="font-bold text-ink">{totalQuantity}개</span> ·{" "}
          <span className="font-bold text-ink">{formatWon(totalRevenue)}</span>
        </p>

        <h3 className="mt-5 text-sm font-bold text-ink">시간대별 매출</h3>
        {isLoading ? (
          <div className="mt-2 flex h-40 w-full items-center justify-center text-xs text-ink-3">
            불러오는 중…
          </div>
        ) : (
          <HourlySalesChart data={details?.hourly ?? []} />
        )}

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-white/70 pt-4">
          <h3 className="text-sm font-bold text-ink">메뉴별 판매</h3>
          <button
            type="button"
            data-all
            onClick={onSelectAll}
            className={`inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold transition-colors ${
              isAllSelected ? "text-brand" : "text-ink-3 hover:text-ink"
            }`}
          >
            전체 판매 기록
            <ChevronRight className="size-3.5" />
          </button>
        </div>

        {isLoading ? (
          <p className="mt-4 text-center text-xs text-ink-3">불러오는 중…</p>
        ) : (details?.menuItems.length ?? 0) === 0 ? (
          <p className="mt-4 text-center text-xs text-ink-3">판매된 메뉴가 없습니다.</p>
        ) : (
          <ul className="-mx-2 mt-2 divide-y divide-white/70">
            {details?.menuItems.map((item) => {
              const isSelected = selectedMenuId === item.menu_id;
              return (
                <li key={item.menu_id}>
                  <button
                    type="button"
                    onClick={() => onSelectMenu(item)}
                    className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/30 ${
                      isSelected ? "outline-2 outline-brand -outline-offset-2" : ""
                    }`}
                  >
                    <span className="min-w-0 flex-1 text-[0.95rem] break-keep text-ink">
                      {item.menu_name}
                    </span>
                    <span className="tabular shrink-0 text-sm text-ink-2">
                      <span className="font-semibold text-ink">{item.quantity}개</span> ·{" "}
                      {formatWon(item.revenue)}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-ink-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
