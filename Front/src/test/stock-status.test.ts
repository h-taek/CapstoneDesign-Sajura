// 재고 경고 판정·정렬 — 04_fe.md §4.6.
import { describe, expect, it } from "vitest";
import type { InventoryItem } from "../api/endpoints/inventory";
import { sortInventory, stockStatus } from "../components/inventory/stock-status";

const TODAY = new Date(2026, 9, 25); // 2026-10-25

function item(name: string, patch: Partial<InventoryItem> = {}): InventoryItem {
  return {
    item_id: name,
    name,
    unit: "g",
    total_quantity: 1000,
    nearest_expiry_date: null,
    needs_check: false,
    low_stock_threshold: 100,
    lead_time_days: null,
    safety_stock: null,
    created_at: "2026-01-01T00:00:00",
    updated_at: "2026-01-01T00:00:00",
    ...patch,
  };
}

describe("stockStatus", () => {
  it.each([
    ["2026-10-24", "EXPIRED"],
    ["2026-10-25", "URGENT"],
    ["2026-10-26", "URGENT"],
    ["2026-10-27", "SOON"],
    ["2026-10-28", "SOON"],
    ["2026-10-29", "NORMAL"],
  ] as const)("소비기한 %s → %s", (expiry, status) => {
    expect(stockStatus(item("a", { nearest_expiry_date: expiry }), TODAY)).toBe(status);
  });

  it("여러 조건이면 확인 필요 > 없음 > 소비기한 > 부족 순", () => {
    const soonAndLow = { nearest_expiry_date: "2026-10-27", total_quantity: 50 };
    expect(stockStatus(item("a", { ...soonAndLow, needs_check: true }), TODAY)).toBe("NEEDS_CHECK");
    expect(stockStatus(item("a", { total_quantity: 0 }), TODAY)).toBe("EMPTY");
    expect(stockStatus(item("a", soonAndLow), TODAY)).toBe("SOON");
    expect(stockStatus(item("a", { total_quantity: 100 }), TODAY)).toBe("LOW");
  });
});

describe("sortInventory", () => {
  const items = [
    item("다시마", { nearest_expiry_date: null }),
    item("가지", { nearest_expiry_date: "2026-11-30" }),
    item("나물", { nearest_expiry_date: "2026-10-26" }),
  ];
  const names = (list: InventoryItem[]) => list.map((i) => i.name);

  it("소비기한 없는 재료는 오름·내림 모두 맨 뒤", () => {
    expect(names(sortInventory(items, "expiry", "asc", TODAY))).toEqual(["나물", "가지", "다시마"]);
    expect(names(sortInventory(items, "expiry", "desc", TODAY))).toEqual([
      "가지",
      "나물",
      "다시마",
    ]);
  });

  it("상태순은 경고가 심한 쪽부터, 같으면 재료명순", () => {
    expect(names(sortInventory(items, "status", "asc", TODAY))).toEqual(["나물", "가지", "다시마"]);
  });

  it("재료명 내림차순", () => {
    expect(names(sortInventory(items, "name", "desc", TODAY))).toEqual(["다시마", "나물", "가지"]);
  });
});
