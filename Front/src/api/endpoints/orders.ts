// 추천발주 조회 + 발주 내역 + 쿠팡 자동 담기 API — 02_implementation_design.md §3.7.
import { api } from "../../lib/api";
import type { components } from "../types.gen";

type S = components["schemas"];

export type OrderSummary = S["OrderSummary"];

export type OrderList = S["OrderListResponse"];

export type OrderCoupangProduct = S["OrderCoupangProduct"];

export type OrderDetailItem = S["OrderDetailItem"];

export type OrderDetail = S["OrderDetailResponse"];

export async function listOrders(page = 1, size = 20): Promise<OrderList> {
  return api.get("orders", { searchParams: { page, size } }).json<OrderList>();
}

export async function getOrder(orderId: string): Promise<OrderDetail> {
  return api.get(`orders/${orderId}`).json<OrderDetail>();
}

export type ReceiptStatus = OrderDetailItem["receipt_status"];

/** 발주 품목 입고 처리 — 로트를 만들고 입고 완료로 바꾼다 (01_basic_design.md §3.7.5). */
export async function receiveOrderItem(
  orderItemId: string,
  input: S["LotCreateRequest"],
): Promise<S["LotResponse"]> {
  return api.post(`orders/items/${orderItemId}/receive`, { json: input }).json<S["LotResponse"]>();
}

export async function skipOrderItem(orderItemId: string): Promise<void> {
  await api.post(`orders/items/${orderItemId}/skip`);
}

export type MenuForecastItem = S["MenuForecastItem"];

export type OrderRecommendation = S["OrderRecommendation"];

export type AIRecommendResponse = S["AIRecommendResponse"];

export async function getAIRecommend(): Promise<AIRecommendResponse> {
  return api.get("orders/recommend").json<AIRecommendResponse>();
}

export type AutomateItem = S["AutomateItem"];

export type AutomateTarget = S["AutomateTarget"];

export type AutomateStartRequest = S["AutomateStartRequest"];

export type AutomateStartResponse = S["AutomateStartResponse"];

export type PageElement = S["PageElement"];

export type ElementsResult = S["ElementsResult"];

export type CartAdded = S["CartAdded"];

export type ActionResult = S["ActionResult"];

export type StepResult = ElementsResult | ActionResult;

export type NonWowPrice = S["NonWowPrice"];

export interface AgentCall {
  tool: string;
  args: {
    ref?: string;
    text?: string;
    direction?: "up" | "down";
    url?: string;
    reason?: string | null;
    [key: string]: unknown;
  };
}

export type AutomateStepRequest = S["AutomateStepRequest"];

export interface AutomateStepAction {
  action: AgentCall;
  done?: never;
}

export interface AutomateStepDone {
  done: AgentCall;
  action?: never;
}

export type AutomateStepResponse = AutomateStepAction | AutomateStepDone;

export type AutomateItemStatus = S["AutomateItemResult"]["status"];

export type AutomateItemResult = S["AutomateItemResult"];

export type AutomateFinishRequest = S["AutomateFinishRequest"];

export type AutomateFinishResponse = S["AutomateFinishResponse"];

// POST /api/orders/automate/start — 쿠팡 담기 시작.
export async function startOrderAutomation(
  input: AutomateStartRequest,
): Promise<AutomateStartResponse> {
  return api.post("orders/automate/start", { json: input }).json<AutomateStartResponse>();
}

export const automateStart = startOrderAutomation;

// POST /api/orders/automate/{run_id}/step — 담기 에이전트 한 걸음 (04_fe.md §7.2 타임아웃 120초).
export async function stepOrderAutomation(
  runId: string,
  input: AutomateStepRequest,
): Promise<AutomateStepResponse> {
  return api
    .post(`orders/automate/${runId}/step`, { json: input, timeout: 120_000 })
    .json<AutomateStepResponse>();
}

export const automateStep = stepOrderAutomation;

// POST /api/orders/automate/{run_id}/finish — 쿠팡 담기 마침 및 발주 확정.
export async function finishOrderAutomation(
  runId: string,
  input: AutomateFinishRequest = {},
): Promise<AutomateFinishResponse> {
  return api
    .post(`orders/automate/${runId}/finish`, { json: input })
    .json<AutomateFinishResponse>();
}

export const automateFinish = finishOrderAutomation;
