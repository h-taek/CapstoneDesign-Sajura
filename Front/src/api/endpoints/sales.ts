// 판매 데이터 업로드 API — api_spec.md §6.
import { api } from "../../lib/api";

export interface CSVUploadResponse {
  imported: number;
  skipped: number;
  skipped_reasons: string[];
  anomaly_count: number;
  auto_created_menus: number;
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

export interface MonthlyRevenuePoint {
  year_month: string;
  revenue: number;
  sales_count: number;
}

export async function getMonthlyRevenue(months = 6): Promise<MonthlyRevenuePoint[]> {
  return api.get("sales/monthly", { searchParams: { months } }).json<MonthlyRevenuePoint[]>();
}

export interface TopMenuItem {
  menu_name: string;
  quantity: number;
  revenue: number;
}

export async function getTopMenus(limit = 5): Promise<TopMenuItem[]> {
  return api.get("sales/top-menus", { searchParams: { limit } }).json<TopMenuItem[]>();
}

export interface DailyRevenuePoint {
  date: string;
  revenue: number;
  sales_count: number;
}

export async function getDailyRevenue(days = 7): Promise<DailyRevenuePoint[]> {
  return api.get("sales/daily", { searchParams: { days } }).json<DailyRevenuePoint[]>();
}

export async function getDailyRevenueForMonth(yearMonth: string): Promise<DailyRevenuePoint[]> {
  return api
    .get("sales/daily-by-month", { searchParams: { year_month: yearMonth } })
    .json<DailyRevenuePoint[]>();
}

export interface WeeklyRevenuePoint {
  week_label: string;
  revenue: number;
  sales_count: number;
}

export async function getWeeklyRevenueThisMonth(): Promise<WeeklyRevenuePoint[]> {
  return api.get("sales/weekly-this-month").json<WeeklyRevenuePoint[]>();
}
