// POS 연동 및 상태 API — 02_implementation_design.md §3.3.
import { api } from "../../lib/api";
import type { components } from "../types.gen";

type S = components["schemas"];

export type PosType = S["PosCreateRequest"]["pos_type"];

export type PosResponse = S["PosResponse"];

export type PosCreateRequest = S["PosCreateRequest"];

export type PosUpdateRequest = S["PosUpdateRequest"];

export type PosSyncResponse = S["PosSyncResponse"];

export type PosStatusCode = S["PosStatusResponse"]["status"];

export type PosStatus = S["PosStatusResponse"];

export async function getPos(): Promise<PosResponse> {
  return api.get("store/pos").json<PosResponse>();
}

export async function createPos(payload: PosCreateRequest): Promise<PosResponse> {
  return api.post("store/pos", { json: payload }).json<PosResponse>();
}

export async function updatePos(payload: PosUpdateRequest): Promise<PosResponse> {
  return api.patch("store/pos", { json: payload }).json<PosResponse>();
}

// 첫 동기화 전이면 전체 이력을 받아 오래 걸린다 — CSV 업로드와 같은 제한 시간
export async function syncPos(): Promise<PosSyncResponse> {
  return api.post("store/pos/sync", { timeout: 120_000 }).json<PosSyncResponse>();
}

export async function getPosStatus(): Promise<PosStatus> {
  return api.get("store/pos/status").json<PosStatus>();
}
