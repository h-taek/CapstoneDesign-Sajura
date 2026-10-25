// 판매 데이터 업로드 API — 02_implementation_design.md §3.6.
import { api } from "../../lib/api";

export interface CSVUploadResponse {
  imported: number;
  skipped: number;
  skipped_reasons: string[];
  anomaly_count: number;
  auto_created_menus: number;
  inventory_deduction: {
    deducted_sales: number; // 재고 차감에 반영된 판매 행 수
    needs_check_items: { item_id: string; name: string }[]; // 이번 업로드로 '재고 확인 필요'가 된 재료
  };
}

export interface CSVUploadColumns {
  date_column: string;
  menu_column: string;
  quantity_column: string;
  price_column: string;
  external_sale_id_column?: string | null;
}

export interface CSVUploadOptions {
  /** true 시 매장 메뉴에 없는 항목을 카테고리='자동등록'으로 즉시 추가. */
  auto_create_menus?: boolean;
}

export async function uploadSalesCsv(
  file: File,
  columns: CSVUploadColumns,
  options: CSVUploadOptions = {},
): Promise<CSVUploadResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("date_column", columns.date_column);
  form.append("menu_column", columns.menu_column);
  form.append("quantity_column", columns.quantity_column);
  form.append("price_column", columns.price_column);
  if (columns.external_sale_id_column) {
    form.append("external_sale_id_column", columns.external_sale_id_column);
  }
  if (options.auto_create_menus) {
    form.append("auto_create_menus", "true");
  }
  // 업로드는 시간이 걸릴 수 있어 ky 기본 타임아웃(10s)을 늘림.
  return api.post("sales/upload", { body: form, timeout: 120_000 }).json<CSVUploadResponse>();
}

export interface SalesSummary {
  total_revenue: number;
  total_sales_count: number;
  this_month_revenue: number;
  this_month_sales_count: number;
  today_revenue: number;
  today_sales_count: number;
  last_sale_at: string | null;
}

export async function getSalesSummary(): Promise<SalesSummary> {
  return api.get("sales/summary").json<SalesSummary>();
}

export type TrendGroupBy = "day" | "week" | "month";

export interface TrendPoint {
  date: string; // 구간 시작일 (month는 그 달 1일)
  quantity: number;
  revenue: number;
}

export interface SalesTrends {
  menu_id: string | null; // null = 매장 전체 합계
  menu_name: string | null;
  group_by: TrendGroupBy;
  data: TrendPoint[];
}

// 로컬 날짜 그대로 YYYY-MM-DD — toISOString()은 UTC로 바꿔 하루가 밀릴 수 있다
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function getSalesTrends(
  start: Date,
  end: Date,
  groupBy: TrendGroupBy = "day",
): Promise<SalesTrends> {
  return api
    .get("sales/trends", {
      searchParams: { start_date: isoDate(start), end_date: isoDate(end), group_by: groupBy },
    })
    .json<SalesTrends>();
}

export interface TopMenuItem {
  menu_name: string;
  quantity: number;
  revenue: number;
}

export async function getTopMenus(limit = 5): Promise<TopMenuItem[]> {
  return api.get("sales/top-menus", { searchParams: { limit } }).json<TopMenuItem[]>();
}
