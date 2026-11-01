// 홈 화면 순수 계산·포맷 함수 — 04_fe.md §4.3, §7.0.
import type { DailyPrediction } from "../../api/endpoints/forecast";
import type { InventoryItem, PriceTrendItem } from "../../api/endpoints/inventory";
import { calculatePriceChange } from "../../lib/price-trend";
import {
  daysUntil,
  isExpiryWarning,
  isStockWarning,
  sortInventory,
} from "../inventory/stock-status";

const DOW = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** "YYYY-MM-DD" 또는 Date를 로컬 Date 객체로 변환한다. */
export function parseLocalDate(val: Date | string): Date {
  if (val instanceof Date) {
    return new Date(val.getFullYear(), val.getMonth(), val.getDate());
  }
  const datePart = val.split("T")[0] ?? "";
  const [y, m, d] = datePart.split("-").map(Number);
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1);
}

/** "10월 19일" 형식 */
export function formatMonthDay(val: Date | string): string {
  const d = parseLocalDate(val);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** "10월 20일 (화)" 형식 */
export function formatMonthDayDow(val: Date | string): string {
  const d = parseLocalDate(val);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`;
}

/** "10/19" 차트 라벨 형식 */
export function formatChartLabel(val: Date | string): string {
  const d = parseLocalDate(val);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** 소비기한 D-day 표시 ("D-1", "D-0", "D+2", "—") */
export function formatExpiryDday(iso: string | null, today: Date): string {
  if (iso === null) return "—";
  const days = daysUntil(iso, today);
  if (days < 0) return `D+${Math.abs(days)}`;
  return `D-${days}`;
}

export interface FormattedPriceTrend {
  itemId: string;
  name: string;
  unit: string;
  currentPrice: number;
  changeRate: number;
  points: { date: string; unit_price: number }[];
}

/**
 * 쿠팡 단가 추세 품목 선별 (04_fe.md §4.3):
 * 1. 유효한(unit_price != null) 데이터 포인트가 2개 미만(마지막 날 1개뿐인 품목 포함)이거나
 *    첫 유효 단가가 0 이하인 품목은 뺀다.
 * 2. 변화율 = ((마지막 단가 - 첫 단가) / 첫 단가) * 100
 * 3. 변화율 절댓값 내림차순(동률 시 변화율 != 0 우선, 이후 가나다순)으로 정렬해 상위 N개 반환.
 */
export function selectTopPriceTrends(items: PriceTrendItem[], limit = 4): FormattedPriceTrend[] {
  const validItems: FormattedPriceTrend[] = [];

  for (const item of items) {
    const change = calculatePriceChange(item.points);
    if (!change) continue;
    const validPoints = item.points
      .filter((p): p is { date: string; unit_price: number } => p.unit_price != null)
      .sort((a, b) => a.date.localeCompare(b.date));
    const changeRate = change.direction === "down" ? -change.rate : change.rate;

    validItems.push({
      itemId: item.item_id,
      name: item.name,
      unit: item.unit,
      currentPrice: change.endPrice,
      changeRate,
      points: validPoints,
    });
  }

  validItems.sort((a, b) => {
    const absDiff = Math.abs(b.changeRate) - Math.abs(a.changeRate);
    if (Math.abs(absDiff) > 0.0001) return absDiff;
    const aNonZero = a.changeRate !== 0 ? 1 : 0;
    const bNonZero = b.changeRate !== 0 ? 1 : 0;
    if (aNonZero !== bNonZero) return bNonZero - aNonZero;
    return a.name.localeCompare(b.name, "ko");
  });

  return validItems.slice(0, limit);
}

export type MenuForecastSlice = NonNullable<DailyPrediction["menu_forecast"]>[number];

export interface MenuShareSlice {
  name: string;
  quantity: number;
  pct: number;
  opacity: number;
  isOther: boolean;
  dashLen: number;
  dashOffset: number;
}

const BRAND_OPACITIES = [1, 0.72, 0.52, 0.36, 0.24];
const CIRCUMFERENCE = 326.7;

/** 오늘 많이 나갈 메뉴 조각 계산 (06_home.html) */
export function buildMenuShareSlices(menuForecast: MenuForecastSlice[]): {
  slices: MenuShareSlice[];
  totalQty: number;
} {
  const totalQty = menuForecast.reduce((sum, m) => sum + m.expected_quantity, 0);
  if (totalQty <= 0) {
    return { slices: [], totalQty: 0 };
  }

  const sorted = [...menuForecast].sort((a, b) => b.expected_quantity - a.expected_quantity);
  const top5 = sorted.slice(0, 5);
  const others = sorted.slice(5);

  const rawSlices: { name: string; quantity: number; opacity: number; isOther: boolean }[] = [];

  for (let i = 0; i < top5.length; i++) {
    const item = top5[i];
    if (!item) continue;
    rawSlices.push({
      name: item.menu_name,
      quantity: item.expected_quantity,
      opacity: BRAND_OPACITIES[i] ?? 0.2,
      isOther: false,
    });
  }

  if (others.length > 0) {
    const otherQty = others.reduce((sum, m) => sum + m.expected_quantity, 0);
    if (otherQty > 0) {
      rawSlices.push({
        name: "그 외",
        quantity: otherQty,
        opacity: 0.5,
        isOther: true,
      });
    }
  }

  let currentOffset = 0;
  const slices: MenuShareSlice[] = rawSlices.map((item) => {
    const ratio = item.quantity / totalQty;
    const pct = Math.round(ratio * 100);
    const dashLen = Math.max(0, ratio * CIRCUMFERENCE - 2.5);
    const slice: MenuShareSlice = {
      name: item.name,
      quantity: item.quantity,
      pct,
      opacity: item.opacity,
      isOther: item.isOther,
      dashLen: Number(dashLen.toFixed(1)),
      dashOffset: Number((-currentOffset).toFixed(1)),
    };
    currentOffset += ratio * CIRCUMFERENCE;
    return slice;
  });

  return { slices, totalQty };
}

/** 확인 필요 재고 선별 및 기본 정렬 (소비기한 빠른순, 없으면 뒤) */
export function selectAlertInventory(items: InventoryItem[], today: Date): InventoryItem[] {
  const alertItems = items.filter((item) => isExpiryWarning(item, today) || isStockWarning(item));
  return sortInventory(alertItems, "expiry", "asc", today);
}
