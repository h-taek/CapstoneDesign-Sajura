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
