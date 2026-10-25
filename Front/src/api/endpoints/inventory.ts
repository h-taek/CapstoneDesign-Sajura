// 재고 API — 02_implementation_design.md §3.5. 수량은 로트 잔여 수량 합계(total_quantity).
import { api } from "../../lib/api";
import type { components } from "../types.gen";

type S = components["schemas"];

export type AlertStatus = S["InventoryItemResponse"]["alert_status"];

export type InventoryItem = S["InventoryItemResponse"];

export type InventoryItemInput = S["InventoryItemCreateRequest"];

export type InventoryItemPatch = S["InventoryItemUpdateRequest"];

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

export type Lot = S["LotResponse"];

export type LotInput = S["LotCreateRequest"];

export type AdjustmentReason = S["AdjustmentReason"];

export type LotPatch = S["LotUpdateRequest"];

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
