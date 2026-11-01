// 숫자·금액 표시 — 사장님이 읽기 쉬운 "원" 표기를 기본으로 한다.

/** 842000 → "842,000원" */
export function formatWon(v: number): string {
  return `${Math.round(v).toLocaleString("ko-KR")}원`;
}

/** 18420000 → "1,842만원", 235662202 → "2억 3,566만원", 8400 → "8,400원" (KPI 카드용) */
export function formatWonShort(v: number): string {
  const n = Math.round(v);
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs < 100_000) return `${sign}${abs.toLocaleString("ko-KR")}원`;
  const eok = Math.floor(abs / 100_000_000);
  const man = Math.floor((abs % 100_000_000) / 10_000);
  if (eok > 0) return `${sign}${eok}억${man > 0 ? ` ${man.toLocaleString("ko-KR")}만` : ""}원`;
  return `${sign}${man.toLocaleString("ko-KR")}만원`;
}

/** DECIMAL 문자열("100.000")까지 받아 소수 셋째 자리까지 표시 */
export function formatQty(v: number | string): string {
  return Number(v).toLocaleString("ko-KR", { maximumFractionDigits: 3 });
}

// 날짜 표시 — BE 날짜는 "YYYY-MM-DD", 일시는 ISO 문자열로 온다.

export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** 날짜("YYYY-MM-DD")는 시간대 밀림 없이 로컬 자정으로, 일시·Date는 로컬 날짜 자정으로 바꾼다. */
export function parseLocalDate(val: Date | string): Date {
  if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [y, m, d] = val.split("-").map(Number);
    return new Date(y!, m! - 1, d!);
  }
  const d = new Date(val);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** 로컬 Date → "YYYY-MM-DD". toISOString()은 UTC로 바꿔 하루가 밀릴 수 있다 */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "10월 19일" */
export function formatMonthDay(val: Date | string): string {
  const d = parseLocalDate(val);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** "10월 20일 (화)" */
export function formatMonthDayDow(val: Date | string): string {
  const d = parseLocalDate(val);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

/** "10/19" */
export function formatSlashDate(val: Date | string): string {
  const d = parseLocalDate(val);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** "10월 17일 14:02" */
export function formatMonthDayTime(val: Date | string): string {
  const d = new Date(val);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
