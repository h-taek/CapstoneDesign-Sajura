// 예측 정확도 — 04_fe.md §4.3·§4.4.
import { describe, expect, it } from "vitest";
import { accuracyRatio } from "../lib/accuracy";

describe("accuracyRatio", () => {
  it("1 − |예측 − 실제| ÷ 실제", () => {
    expect(Math.round((accuracyRatio(1284000, 1210000) ?? 0) * 100)).toBe(94);
    expect(accuracyRatio(1000000, 1000000)).toBe(1);
    // 실제의 두 배 넘게 빗나가면 0 아래로 내려간다 — 자르지 않는다
    expect(accuracyRatio(100, 250)).toBeCloseTo(-0.5);
  });

  it("실제가 0 이하이거나 값이 없으면 null", () => {
    expect(accuracyRatio(0, 1000000)).toBeNull();
    expect(accuracyRatio(-500, 1000000)).toBeNull();
    expect(accuracyRatio(1000000, null)).toBeNull();
    expect(accuracyRatio(null, 1000000)).toBeNull();
  });
});
