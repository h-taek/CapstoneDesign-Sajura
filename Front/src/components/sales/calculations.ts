// 판매 데이터 순수 계산 로직 (04_fe.md §7.0, §4.7).
import type { SaleListItem, TrendPoint } from "../../api/endpoints/sales";

export interface DaySaleSummary {
  date: string; // YYYY-MM-DD
  dayLabel: string; // "10월 19일 (월)"
  shortDate: string; // "10월 19일"
  dayOfWeek: string; // "(월)"
  quantity: number;
  revenue: number;
}

export interface HourlySalesPoint {
  hour: number;
  label: string; // "11시"
  revenue: number;
}

export interface MenuItemSalesSummary {
  menu_id: string;
  menu_name: string;
  quantity: number;
  revenue: number;
}

export interface DayAggregatedDetails {
  totalQuantity: number;
  totalRevenue: number;
  hourly: HourlySalesPoint[];
  menuItems: MenuItemSalesSummary[];
  allSales: SaleListItem[];
}

const DOW_KOREAN = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** YYYY-MM-DD 날짜 문자열 사이 일 수 계산 (시작/끝 포함) */
export function getDaysDiffInclusive(start: string, end: string): number {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  if (!sy || !sm || !sd || !ey || !em || !ed) return 0;
  const sUtc = Date.UTC(sy, sm - 1, sd);
  const eUtc = Date.UTC(ey, em - 1, ed);
  return Math.floor((eUtc - sUtc) / (24 * 60 * 60 * 1000)) + 1;
}

/** 1년(366일) 초과 여부 검사 */
export function isRangeExceeded(start: string, end: string): boolean {
  if (!start || !end) return false;
  if (start > end) return false;
  return getDaysDiffInclusive(start, end) > 366;
}

/** "2026-10-19" -> { dayLabel: "10월 19일 (월)", shortDate: "10월 19일", dayOfWeek: "(월)" } */
export function formatDayDisplay(dateIso: string): {
  dayLabel: string;
  shortDate: string;
  dayOfWeek: string;
} {
  const [y, m, d] = dateIso.split("-").map(Number);
  if (!y || !m || !d) {
    return { dayLabel: dateIso, shortDate: dateIso, dayOfWeek: "" };
  }
  const dateObj = new Date(y, m - 1, d);
  const dow = DOW_KOREAN[dateObj.getDay()] ?? "";
  const shortDate = `${m}월 ${d}일`;
  const dayOfWeek = `(${dow})`;
  return {
    dayLabel: `${shortDate} ${dayOfWeek}`,
    shortDate,
    dayOfWeek,
  };
}

/**
 * Trends 데이터(day)를 기반으로 start ~ end 사이의 모든 날짜를 채우고,
 * 최신 날짜순(내림차순)으로 정렬된 목록을 반환한다.
 * 판매가 없는 날도 0으로 채운다.
 */
export function buildContinuousDailySales(
  start: string,
  end: string,
  trendsData: TrendPoint[] = [],
): DaySaleSummary[] {
  if (!start || !end || start > end) return [];

  const trendMap = new Map<string, { quantity: number; revenue: number }>();
  for (const pt of trendsData) {
    trendMap.set(pt.date, {
      quantity: pt.quantity,
      revenue: pt.revenue,
    });
  }

  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  if (!sy || !sm || !sd || !ey || !em || !ed) return [];

  const cur = new Date(Date.UTC(ey, em - 1, ed));
  const sUtc = Date.UTC(sy, sm - 1, sd);

  const result: DaySaleSummary[] = [];

  while (cur.getTime() >= sUtc) {
    const yStr = cur.getUTCFullYear();
    const mStr = String(cur.getUTCMonth() + 1).padStart(2, "0");
    const dStr = String(cur.getUTCDate()).padStart(2, "0");
    const iso = `${yStr}-${mStr}-${dStr}`;

    const found = trendMap.get(iso) ?? { quantity: 0, revenue: 0 };
    const { dayLabel, shortDate, dayOfWeek } = formatDayDisplay(iso);

    result.push({
      date: iso,
      dayLabel,
      shortDate,
      dayOfWeek,
      quantity: found.quantity,
      revenue: found.revenue,
    });

    cur.setUTCDate(cur.getUTCDate() - 1);
  }

  return result;
}

/**
 * 특정 일자의 전체 판매 목록(SaleListItem[])을 받아
 * 시간대별 매출(0시~23시 중 데이터가 있는 구간 또는 전체), 메뉴별 집계, 전체 판매 목록을 최신순으로 묶는다.
 */
export function aggregateDaySales(sales: SaleListItem[]): DayAggregatedDetails {
  let totalQuantity = 0;
  let totalRevenue = 0;

  const hourlyMap = new Map<number, number>();
  const menuMap = new Map<string, MenuItemSalesSummary>();

  // 최신순 정렬 (sold_at 내림차순)
  const sortedSales = [...sales].sort((a, b) => b.sold_at.localeCompare(a.sold_at));

  for (const sale of sortedSales) {
    totalQuantity += sale.quantity;
    totalRevenue += sale.total_price;

    // 시각 파싱 ("2026-10-19T21:52:00" or "2026-10-19 21:52:00")
    let hour = 0;
    if (sale.sold_at.includes("T")) {
      hour = Number(sale.sold_at.split("T")[1]?.slice(0, 2) ?? 0);
    } else if (sale.sold_at.includes(" ")) {
      hour = Number(sale.sold_at.split(" ")[1]?.slice(0, 2) ?? 0);
    }
    hourlyMap.set(hour, (hourlyMap.get(hour) ?? 0) + sale.total_price);

    // 메뉴별 집계
    const existing = menuMap.get(sale.menu_id);
    if (existing) {
      existing.quantity += sale.quantity;
      existing.revenue += sale.total_price;
    } else {
      menuMap.set(sale.menu_id, {
        menu_id: sale.menu_id,
        menu_name: sale.menu_name,
        quantity: sale.quantity,
        revenue: sale.total_price,
      });
    }
  }

  // 시간대 배열 생성: 데이터가 있는 시간대의 최소~최대 범위 (최소 11시~22시 등 데이터 범위 반영, 없으면 빈 배열)
  const hoursWithData = Array.from(hourlyMap.keys());
  const hourly: HourlySalesPoint[] = [];

  if (hoursWithData.length > 0) {
    const minH = Math.min(...hoursWithData);
    const maxH = Math.max(...hoursWithData);
    for (let h = minH; h <= maxH; h++) {
      hourly.push({
        hour: h,
        label: `${h}시`,
        revenue: hourlyMap.get(h) ?? 0,
      });
    }
  }

  // 메뉴별 집계: 판매 수량 많은 순(동률이면 매출 많은 순, 그 다음 이름순)
  const menuItems = Array.from(menuMap.values()).sort((a, b) => {
    if (b.quantity !== a.quantity) return b.quantity - a.quantity;
    if (b.revenue !== a.revenue) return b.revenue - a.revenue;
    return a.menu_name.localeCompare(b.menu_name);
  });

  return {
    totalQuantity,
    totalRevenue,
    hourly,
    menuItems,
    allSales: sortedSales,
  };
}

/** "2026-10-19T21:52:00" -> "21:52" */
export function formatSaleTime(soldAtIso: string): string {
  if (!soldAtIso) return "";
  const timePart = soldAtIso.includes("T") ? soldAtIso.split("T")[1] : soldAtIso.split(" ")[1];
  if (!timePart) return soldAtIso;
  return timePart.slice(0, 5);
}
