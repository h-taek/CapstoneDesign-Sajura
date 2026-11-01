// 쿠팡 단가 변화율 — 홈 '쿠팡 단가 추세'와 재고 상세 '쿠팡 상품'이 같이 쓴다 (04_fe.md §4.3·§4.6).
// 기간에서 값 있는 첫 날짜와 마지막 날짜로 계산하고, 값 있는 날짜가 하나뿐이면 null.

export interface PriceChange {
  /** 변화율 절댓값(%), 소수 첫째 자리 */
  rate: number;
  direction: "up" | "down" | "flat";
  startPrice: number;
  endPrice: number;
}

export function calculatePriceChange(
  points: ReadonlyArray<{ date: string; unit_price: number | null }>,
): PriceChange | null {
  const valid = points
    .filter(
      (p): p is { date: string; unit_price: number } => p.unit_price != null && p.unit_price > 0,
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const first = valid[0];
  const last = valid[valid.length - 1];
  if (!first || !last || first.date === last.date) return null;
  const p0 = first.unit_price;
  const p1 = last.unit_price;
  const rate = Math.round((Math.abs(p1 - p0) / p0) * 1000) / 10;
  const direction = p1 > p0 ? "up" : p1 < p0 ? "down" : "flat";
  return { rate, direction, startPrice: p0, endPrice: p1 };
}
