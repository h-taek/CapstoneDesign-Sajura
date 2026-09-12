// 추천발주 조회 + 발주 확정 API — 07_api_spec.md §7.
import { api } from "../../lib/api";

export interface OrderConfirmItem {
  item_id: string;
  quantity: number;
}

export interface OrderItem {
  item_id: string;
  name: string;
  unit: string;
  quantity: number;
}

export interface PurchaseOrder {
  order_id: string;
  items: OrderItem[];
  status: string;
  created_at: string;
}

export async function confirmOrder(items: OrderConfirmItem[]): Promise<PurchaseOrder> {
  return api.post("orders/confirm", { json: { items } }).json<PurchaseOrder>();
}

export async function listOrders(): Promise<PurchaseOrder[]> {
  const res = await api.get("orders").json<{ orders: PurchaseOrder[] }>();
  return res.orders;
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
  config_status: string;
  recommendation_reason: string;
}

export interface AIRecommendResponse {
  target_dates: string[];
  is_low_confidence: boolean;
  low_confidence_reason: string | null;
  menu_forecast: MenuForecastItem[];
  recommendations: OrderRecommendation[];
}

export async function getAIRecommend(): Promise<AIRecommendResponse> {
  return api.get("orders/recommend").json<AIRecommendResponse>();
}
