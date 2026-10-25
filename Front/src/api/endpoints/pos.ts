// POS 연동 상태 API — 02_implementation_design.md §3.3.
import { api } from "../../lib/api";
import type { components } from "../types.gen";

type S = components["schemas"];

export type PosStatusCode = S["PosStatusResponse"]["status"];

export type PosStatus = S["PosStatusResponse"];

export async function getPosStatus(): Promise<PosStatus> {
  return api.get("store/pos/status").json<PosStatus>();
}
