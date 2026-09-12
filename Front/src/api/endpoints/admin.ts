// 관리자 사업자 검증 심사 API — 07_api_spec.md §3 (role=ADMIN 전용).
import { api } from "../../lib/api";

export interface VerificationItem {
  store_id: string;
  user_email: string;
  business_no: string | null;
  business_status: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
  cert_url: string | null;
  submitted_at: string;
}

export interface VerificationList {
  items: VerificationItem[];
  total: number;
  page: number;
  size: number;
  total_pages: number;
}

export async function listVerifications(): Promise<VerificationList> {
  return api.get("admin/verifications", { searchParams: { size: 100 } }).json<VerificationList>();
}

export async function approveVerification(storeId: string): Promise<void> {
  await api.post(`admin/verifications/${storeId}/approve`);
}

export async function rejectVerification(storeId: string, reason: string): Promise<void> {
  await api.post(`admin/verifications/${storeId}/reject`, { json: { reason } });
}

export interface CertObject {
  url: string;
  mime: string;
}

/** 등록증 파일 — Bearer 인증이 필요하므로 blob으로 받아 objectURL을 만든다.
 * 호출자는 unmount 시 URL.revokeObjectURL(url)로 반드시 해제해야 한다. */
export async function fetchCertObjectUrl(storeId: string): Promise<CertObject> {
  const blob = await api.get(`admin/verifications/${storeId}/cert`).blob();
  return { url: URL.createObjectURL(blob), mime: blob.type || "application/octet-stream" };
}
