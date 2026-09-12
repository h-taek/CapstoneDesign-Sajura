// 매장 API — api_spec.md §3.
import { api } from "../../lib/api";

export type StoreSize = "SMALL" | "MEDIUM" | "LARGE";
export type OperationType = "HALL" | "DELIVERY" | "BOTH";

export type BusinessStatus = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";

export interface Store {
  store_id: string;
  store_name: string | null;
  business_no: string | null;
  business_status: BusinessStatus;
  business_reject_reason: string | null;
  business_type: string | null;
  store_size: StoreSize | null;
  operation_type: OperationType | null;
  address: string | null;
  phone: string | null;
  onboarding_completed: boolean;
  created_at: string;
}

export interface StoreUpdate {
  store_name?: string | undefined;
  business_type?: string | undefined;
  store_size?: StoreSize | undefined;
  operation_type?: OperationType | undefined;
  address?: string | undefined;
  phone?: string | undefined;
}

export async function getStore(): Promise<Store> {
  return api.get("store").json<Store>();
}

export async function patchStore(payload: StoreUpdate): Promise<Store> {
  return api.patch("store", { json: payload }).json<Store>();
}

export async function completeOnboarding(): Promise<{
  onboarding_completed: true;
  store_id: string;
}> {
  return api.post("store/onboarding/complete").json();
}

export type PosType = "UNIONPOS" | "OKPOS" | "POSBANK" | "CSV_ONLY";

export interface PosRegister {
  pos_type: PosType;
  api_key?: string | undefined;
  store_code?: string | undefined;
}

export async function registerPos(payload: PosRegister): Promise<unknown> {
  return api.post("store/pos", { json: payload }).json();
}
