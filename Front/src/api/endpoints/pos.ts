// POS 연동 상태 API — 07_api_spec.md §3.
import { api } from "../../lib/api";

export type PosStatusCode = "CONNECTED" | "ERROR" | "CSV_MODE" | "DISCONNECTED";

export interface PosStatus {
  status: PosStatusCode;
  last_synced_at: string | null;
  error_message: string | null;
}

export async function getPosStatus(): Promise<PosStatus> {
  return api.get("store/pos/status").json<PosStatus>();
}
