// 발주 확정 API — 발주추천 화면 승인 플로우.
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
