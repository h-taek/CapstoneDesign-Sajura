// 관리자 사업자 검증 심사 큐 정렬·포맷 로직 (04_fe.md §4.10, §7.0).
import type { VerificationItem } from "../../api/endpoints/admin";
import { formatMonthDayTime } from "../../lib/format";

/**
 * 심사 큐 기본 정렬: 신청 일시(submitted_at) 오래된 순 (04_fe.md §4.10).
 * 유효하지 않거나 동일하면 store_id 순.
 */
export function sortVerifications(items: VerificationItem[]): VerificationItem[] {
  return [...items].sort((a, b) => {
    const timeA = new Date(a.submitted_at).getTime();
    const timeB = new Date(b.submitted_at).getTime();
    if (Number.isNaN(timeA) || Number.isNaN(timeB)) {
      return a.submitted_at.localeCompare(b.submitted_at);
    }
    return timeA - timeB || a.store_id.localeCompare(b.store_id);
  });
}

/**
 * 신청 일시 포맷 (예: "10월 17일 14:02").
 */
export function formatSubmittedAt(iso: string): string {
  return Number.isNaN(new Date(iso).getTime()) ? iso : formatMonthDayTime(iso);
}
