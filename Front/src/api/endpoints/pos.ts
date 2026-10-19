// POS 연동 상태 API — 02_implementation_design.md §3.3.
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
