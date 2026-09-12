// 재고 품목 API — 재고관리·발주추천 화면.
import { api } from "../../lib/api";

export interface InventoryItem {
  item_id: string;
  name: string;
  unit: string;
  current_quantity: number;
  low_stock_threshold: number;
  lead_time_days: number | null;
  safety_stock: number | null;
  is_low_stock: boolean;
  updated_at: string;
}

export interface InventoryItemInput {
  name: string;
  unit: string;
  current_quantity: number;
  low_stock_threshold: number;
  lead_time_days: number | null;
  safety_stock: number | null;
}

export async function listInventory(): Promise<InventoryItem[]> {
  const res = await api.get("inventory").json<{ items: InventoryItem[] }>();
  return res.items;
}

export async function createInventoryItem(input: InventoryItemInput): Promise<InventoryItem> {
  return api.post("inventory", { json: input }).json<InventoryItem>();
}

export async function updateInventoryItem(
  itemId: string,
  patch: Partial<InventoryItemInput>,
): Promise<InventoryItem> {
  return api.patch(`inventory/${itemId}`, { json: patch }).json<InventoryItem>();
}

export async function deleteInventoryItem(itemId: string): Promise<void> {
  await api.delete(`inventory/${itemId}`);
}

export interface ReorderSuggestion {
  item_id: string;
  name: string;
  unit: string;
  current_quantity: number;
  low_stock_threshold: number;
  safety_stock: number | null;
  suggested_order_quantity: number;
}

export async function getReorderSuggestions(): Promise<ReorderSuggestion[]> {
  return api.get("inventory/reorder-suggestions").json<ReorderSuggestion[]>();
}
