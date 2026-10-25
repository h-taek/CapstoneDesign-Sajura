// 매장 API — 02_implementation_design.md §3.3.
import { api } from "../../lib/api";
import type { components } from "../types.gen";

type S = components["schemas"];

export type StoreSize = NonNullable<S["StoreResponse"]["store_size"]>;
export type OperationType = NonNullable<S["StoreResponse"]["operation_type"]>;

export type BusinessStatus = S["StoreResponse"]["business_status"];

export type Store = S["StoreResponse"];

export type StoreUpdate = S["StoreUpdateRequest"];

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

// BE pos_type은 아직 아무 문자열이나 받는다 — 지원 POS 종류 정리 전까지 FE 목록 유지
export type PosType = "UNIONPOS" | "OKPOS" | "POSBANK" | "CSV_ONLY";

export type PosRegister = S["PosCreateRequest"];

export async function registerPos(payload: PosRegister): Promise<unknown> {
  return api.post("store/pos", { json: payload }).json();
}
