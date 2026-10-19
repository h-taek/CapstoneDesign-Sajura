// 재고 API — 07_api_spec.md §5. 수량은 로트 잔여 수량 합계(total_quantity).
import { api } from "../../lib/api";

export type AlertStatus = "NORMAL" | "LOW" | "EXPIRED_SOON" | "EMPTY" | "NEEDS_CHECK";

export interface InventoryItem {
  item_id: string;
  name: string;
  unit: string;
  total_quantity: number;
  alert_status: AlertStatus;
  low_stock_threshold: number;
  lead_time_days: number | null;
  safety_stock: number | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryItemInput {
  name: string;
  unit: string;
  quantity: number;
  expiry_date: string | null;
  purchase_price: number | null; // quantity > 0이면 필수 — 등록 수량 전체의 구매 금액(원)
  low_stock_threshold: number;
  lead_time_days: number | null;
  safety_stock: number | null;
}

export type InventoryItemPatch = Partial<
  Pick<
    InventoryItemInput,
    "name" | "unit" | "low_stock_threshold" | "lead_time_days" | "safety_stock"
  >
>;

export async function listInventory(): Promise<InventoryItem[]> {
  const res = await api.get("inventory").json<{ items: InventoryItem[] }>();
  return res.items;
}

export async function createInventoryItem(input: InventoryItemInput): Promise<InventoryItem> {
  return api.post("inventory", { json: input }).json<InventoryItem>();
}

export async function updateInventoryItem(
  itemId: string,
  patch: InventoryItemPatch,
): Promise<InventoryItem> {
  return api.patch(`inventory/${itemId}`, { json: patch }).json<InventoryItem>();
}

export async function deleteInventoryItem(itemId: string): Promise<void> {
  await api.delete(`inventory/${itemId}`);
}

export interface Lot {
  lot_id: string;
  item_id: string;
  quantity: number;
  remaining_quantity: number;
  received_at: string;
  expiry_date: string | null;
  purchase_price: number;
}

export interface LotInput {
  quantity: number;
  received_at: string;
  expiry_date: string | null;
  purchase_price: number; // 입고 수량 전체의 구매 금액(원)
}

export type AdjustmentReason = "STOCKTAKE" | "EXPIRY_CORRECTION" | "OTHER";

export interface LotPatch {
  remaining_quantity?: number;
  expiry_date?: string | null;
  reason: AdjustmentReason;
  memo?: string | null;
}

export async function listLots(itemId: string): Promise<Lot[]> {
  const res = await api.get(`inventory/${itemId}/lots`).json<{ lots: Lot[] }>();
  return res.lots;
}

export async function addLot(itemId: string, input: LotInput): Promise<Lot> {
  return api.post(`inventory/${itemId}/lots`, { json: input }).json<Lot>();
}

export async function updateLot(itemId: string, lotId: string, patch: LotPatch): Promise<void> {
  await api.patch(`inventory/${itemId}/lots/${lotId}`, { json: patch });
}

export async function disposeLot(
  itemId: string,
  input: { lot_id: string; quantity: number; reason: string | null },
): Promise<void> {
  await api.post(`inventory/${itemId}/dispose`, { json: input });
}

export interface ReorderSuggestion {
  item_id: string;
  name: string;
  unit: string;
  current_quantity: number; // 로트 잔여 수량 합계
  low_stock_threshold: number;
  safety_stock: number | null;
  suggested_order_quantity: number;
}

export async function getReorderSuggestions(): Promise<ReorderSuggestion[]> {
  return api.get("inventory/reorder-suggestions").json<ReorderSuggestion[]>();
}
