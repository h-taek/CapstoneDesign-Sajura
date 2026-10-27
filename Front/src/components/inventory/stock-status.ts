// 재고 경고 판정·정렬 — BE는 원본값만 주고 화면 판단은 FE가 한다 (04_fe.md §4.6, 03_be.md §2).
import type { InventoryItem } from "../../api/endpoints/inventory";

// 01_basic_design.md §3.3.6 — D-1 긴급, D-3 경고
const EXPIRY_URGENT_DAYS = 1;
const EXPIRY_WARN_DAYS = 3;

// 여러 조건이면 앞쪽 하나 (04_fe.md §4.6 표 순서)
export const STOCK_STATUS_ORDER = [
  "NEEDS_CHECK",
  "EMPTY",
  "EXPIRED",
  "URGENT",
  "SOON",
  "LOW",
  "NORMAL",
] as const;
export type StockStatus = (typeof STOCK_STATUS_ORDER)[number];

export type InventorySortKey = "expiry" | "name" | "quantity" | "status";
export type SortDir = "asc" | "desc";

function localDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1);
}

/** 오늘 기준 남은 일수. 지났으면 음수. */
export function daysUntil(iso: string, today: Date): number {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((localDate(iso).getTime() - start.getTime()) / 86_400_000);
}

export function stockStatus(item: InventoryItem, today: Date): StockStatus {
  if (item.needs_check) return "NEEDS_CHECK";
  if (item.total_quantity <= 0) return "EMPTY";
  if (item.nearest_expiry_date !== null) {
    const days = daysUntil(item.nearest_expiry_date, today);
    if (days < 0) return "EXPIRED";
    if (days <= EXPIRY_URGENT_DAYS) return "URGENT";
    if (days <= EXPIRY_WARN_DAYS) return "SOON";
  }
  if (item.total_quantity <= item.low_stock_threshold) return "LOW";
  return "NORMAL";
}

/** 재고 화면 소비기한 경고 — 단계 없이 D-3 이내(지난 것 포함)면 기한 글씨를 빨갛게 한다. */
export function isExpiryWarning(item: InventoryItem, today: Date): boolean {
  return (
    item.nearest_expiry_date !== null &&
    daysUntil(item.nearest_expiry_date, today) <= EXPIRY_WARN_DAYS
  );
}

/** 재고 화면 수량 경고 — 확인 필요·재고 없음·기준 이하면 수량 글씨를 빨갛게 한다. */
export function isStockWarning(item: InventoryItem): boolean {
  return (
    item.needs_check || item.total_quantity <= 0 || item.total_quantity <= item.low_stock_threshold
  );
}

/** 소비기한이 없는 재료는 방향과 무관하게 맨 뒤. 같으면 재료명순. */
export function sortInventory(
  items: InventoryItem[],
  key: InventorySortKey,
  dir: SortDir,
  today: Date,
): InventoryItem[] {
  const sign = dir === "asc" ? 1 : -1;
  const byName = (a: InventoryItem, b: InventoryItem) => a.name.localeCompare(b.name, "ko");
  return [...items].sort((a, b) => {
    if (key === "expiry") {
      const ea = a.nearest_expiry_date;
      const eb = b.nearest_expiry_date;
      if (ea === null || eb === null) {
        return ea === eb ? byName(a, b) : ea === null ? 1 : -1;
      }
      return (ea < eb ? -1 : ea > eb ? 1 : 0) * sign || byName(a, b);
    }
    if (key === "quantity") return (a.total_quantity - b.total_quantity) * sign || byName(a, b);
    if (key === "status") {
      const rank = (i: InventoryItem) => STOCK_STATUS_ORDER.indexOf(stockStatus(i, today));
      return (rank(a) - rank(b)) * sign || byName(a, b);
    }
    return byName(a, b) * sign;
  });
}
