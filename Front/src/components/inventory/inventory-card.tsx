// 재고 카드 — 4:3 비율, 재료명·총수량·소비기한(D-n · 날짜), 경고 시 해당 글씨만 빨갛게 (04_fe.md §4.6, 09_inventory.html).
import type { InventoryItem } from "../../api/endpoints/inventory";
import { SelectMark } from "../bulk/bulk-delete";
import { formatExpiryDisplay, isExpiryWarning, isStockWarning } from "./stock-status";

function fmtQty(v: number | string): string {
  return Number(v).toLocaleString("ko-KR", { maximumFractionDigits: 3 });
}

export interface InventoryCardProps {
  item: InventoryItem;
  today: Date;
  isSelected?: boolean;
  /** 일괄 삭제로 고르는 중 — 체크 표시를 보이고 누르면 고르기/풀기 */
  selecting?: boolean;
  onClick: () => void;
}

export function InventoryCard({
  item,
  today,
  isSelected = false,
  selecting = false,
  onClick,
}: InventoryCardProps) {
  const stockWarn = isStockWarning(item);
  const expiryWarn = isExpiryWarning(item, today);
  const expiryDisplay = formatExpiryDisplay(item.nearest_expiry_date, today);

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selecting ? isSelected : undefined}
        className={`relative flex aspect-[4/3] w-full flex-col justify-between rounded-2xl p-4 text-left glass-card hover:bg-white/50 transition-all ${
          isSelected ? "outline-2 -outline-offset-2 outline-brand ring-2 ring-brand/20" : ""
        }`}
      >
        {selecting && <SelectMark checked={isSelected} />}
        <span className={`truncate text-[0.95rem] font-bold text-ink ${selecting ? "pr-8" : ""}`}>
          {item.name}
        </span>
        <span>
          <span
            className={`tabular block text-[1.75rem] leading-none font-bold tracking-tight ${
              stockWarn ? "text-danger" : "text-ink"
            }`}
          >
            {fmtQty(item.total_quantity)}
            <span
              className={`ml-1 text-sm font-semibold ${stockWarn ? "text-danger" : "text-ink-2"}`}
            >
              {item.unit}
            </span>
          </span>
          <span
            className={`tabular mt-2 block text-sm ${expiryWarn ? "text-danger" : "text-ink-2"}`}
          >
            {expiryDisplay ? `${expiryDisplay.dday} · ${expiryDisplay.dateText}` : "소비기한 —"}
          </span>
        </span>
      </button>
    </li>
  );
}
