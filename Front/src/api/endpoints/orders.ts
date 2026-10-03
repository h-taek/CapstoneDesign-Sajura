// 추천발주 조회 + 발주 확정·내역 API — 07_api_spec.md §7.
import { api } from "../../lib/api";

export interface OrderApproveItem {
  item_id: string;
  final_quantity: number;
  unit_price?: number;
}

export interface OrderApproveRequest {
  recommendation_id: string | null;
  items: OrderApproveItem[];
  note?: string;
}

export type OrderStatus = "APPROVED" | "AUTOMATED" | "MANUAL_REQUIRED";

export interface OrderApproveResponse {
  order_id: string;
  approved_at: string;
  total_estimated_cost: number;
  status: OrderStatus;
}

export interface OrderSummary extends OrderApproveResponse {
  item_count: number;
}

export interface OrderList {
  items: OrderSummary[];
  total: number;
  page: number;
  size: number;
  total_pages: number;
}

export interface OrderDetailItem {
  item_id: string;
  item_name: string;
  final_quantity: number;
  unit: string;
  unit_price: number;
  subtotal: number;
}

export interface OrderDetail {
  order_id: string;
  approved_at: string;
  status: OrderStatus;
  total_estimated_cost: number;
  note: string | null;
  items: OrderDetailItem[];
}

export async function approveOrder(body: OrderApproveRequest): Promise<OrderApproveResponse> {
  return api.post("orders/approve", { json: body }).json<OrderApproveResponse>();
}

export async function listOrders(page = 1, size = 20): Promise<OrderList> {
  return api.get("orders", { searchParams: { page, size } }).json<OrderList>();
}

export async function getOrder(orderId: string): Promise<OrderDetail> {
  return api.get(`orders/${orderId}`).json<OrderDetail>();
}

export interface MenuForecastItem {
  menu_id: string;
  menu_name: string;
  expected_quantity: number;
}

export interface OrderRecommendation {
  item_id: string;
  item_name: string;
  unit: string;
  recommended_quantity: number;
  expected_stockout_date: string | null;
  lead_time_days: number;
  safety_stock: number;
  config_status: "USER_CONFIGURED" | "DEFAULT_USED";
  recommendation_reason: string;
}

export interface AIRecommendResponse {
  recommendation_id: string;
  target_dates: string[];
  is_low_confidence: boolean;
  low_confidence_reason: string | null;
  menu_forecast: MenuForecastItem[];
  recommendations: OrderRecommendation[];
}

export async function getAIRecommend(): Promise<AIRecommendResponse> {
  return api.get("orders/recommend").json<AIRecommendResponse>();
}
