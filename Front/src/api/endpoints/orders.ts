// 추천발주 조회 + 발주 확정·내역 API — 02_implementation_design.md §3.7.
import { api } from "../../lib/api";
import type { components } from "../types.gen";

type S = components["schemas"];

export type OrderApproveItem = S["OrderApproveItem"];

export type OrderApproveRequest = S["OrderApproveRequest"];

export type OrderStatus = S["OrderSummary"]["status"];

export type OrderApproveResponse = S["OrderApproveResponse"];

export type OrderSummary = S["OrderSummary"];

export type OrderList = S["OrderListResponse"];

export type OrderDetailItem = S["OrderDetailItem"];

export type OrderDetail = S["OrderDetailResponse"];

export async function approveOrder(body: OrderApproveRequest): Promise<OrderApproveResponse> {
  return api.post("orders/approve", { json: body }).json<OrderApproveResponse>();
}

export async function listOrders(page = 1, size = 20): Promise<OrderList> {
  return api.get("orders", { searchParams: { page, size } }).json<OrderList>();
}

export async function getOrder(orderId: string): Promise<OrderDetail> {
  return api.get(`orders/${orderId}`).json<OrderDetail>();
}

export type MenuForecastItem = S["MenuForecastItem"];

export type OrderRecommendation = S["OrderRecommendation"];

export type AIRecommendResponse = S["AIRecommendResponse"];

export async function getAIRecommend(): Promise<AIRecommendResponse> {
  return api.get("orders/recommend").json<AIRecommendResponse>();
}
