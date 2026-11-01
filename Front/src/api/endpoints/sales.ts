// 판매 데이터 업로드 및 조회 API — 02_implementation_design.md §3.6.
import { api } from "../../lib/api";
import type { components } from "../types.gen";

type S = components["schemas"];

export type NeedsCheckItem = S["NeedsCheckItem"];
export type InventoryDeduction = S["InventoryDeduction"];
export type CSVUploadResponse = S["CSVUploadResponse"];

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

// 로컬 날짜 그대로 YYYY-MM-DD — toISOString()은 UTC로 바꿔 하루가 밀릴 수 있다
function isoDate(d: Date | string): string {
  if (typeof d === "string") return d;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type SaleListItem = S["SaleListItem"];

export type SalesListResponse = S["SalesListResponse"];

export interface SalesListParams {
  start_date: Date | string;
  end_date: Date | string;
  menu_id?: string | null;
  order?: "asc" | "desc";
  page?: number;
  size?: number;
}

// GET /api/sales — 판매 내역 목록 조회 (기간 합계 포함).
export async function listSales(params: SalesListParams): Promise<SalesListResponse> {
  const searchParams: Record<string, string | number> = {
    start_date: isoDate(params.start_date),
    end_date: isoDate(params.end_date),
  };
  if (params.menu_id) searchParams.menu_id = params.menu_id;
  if (params.order) searchParams.order = params.order;
  if (params.page !== undefined) searchParams.page = params.page;
  if (params.size !== undefined) searchParams.size = params.size;
  return api.get("sales", { searchParams }).json<SalesListResponse>();
}

export type SalesSummary = S["SalesSummaryResponse"];

export async function getSalesSummary(): Promise<SalesSummary> {
  return api.get("sales/summary").json<SalesSummary>();
}

export type TrendGroupBy = S["SalesTrendsResponse"]["group_by"];

export type TrendPoint = S["TrendPoint"];

export type SalesTrends = S["SalesTrendsResponse"];

export async function getSalesTrends(
  start: Date | string,
  end: Date | string,
  groupBy: TrendGroupBy = "day",
  menuId?: string | null,
): Promise<SalesTrends> {
  const searchParams: Record<string, string> = {
    start_date: isoDate(start),
    end_date: isoDate(end),
    group_by: groupBy,
  };
  if (menuId) searchParams.menu_id = menuId;
  return api.get("sales/trends", { searchParams }).json<SalesTrends>();
}

export type TopMenuItem = S["TopMenuItem"];

export interface TopMenusRange {
  start_date?: Date | string;
  end_date?: Date | string;
}

export async function getTopMenus(limit = 5, range?: TopMenusRange): Promise<TopMenuItem[]> {
  const searchParams: Record<string, string | number> = { limit };
  if (range?.start_date && range?.end_date) {
    searchParams.start_date = isoDate(range.start_date);
    searchParams.end_date = isoDate(range.end_date);
  }
  return api.get("sales/top-menus", { searchParams }).json<TopMenuItem[]>();
}
