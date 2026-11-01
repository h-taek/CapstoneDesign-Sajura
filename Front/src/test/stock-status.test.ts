// 재고 경고 판정·정렬 — 04_fe.md §4.6.
import { describe, expect, it } from "vitest";
import type { InventoryItem } from "../api/endpoints/inventory";
import {
  filterInventoryBySearch,
  formatExpiryDisplay,
  isExpiryWarning,
  isStockWarning,
  sortInventory,
  sortInventoryByOption,
  stockStatus,
} from "../components/inventory/stock-status";
import { calculatePriceChange } from "../lib/price-trend";

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
    coupang_product: null,
    unit_price: null,
    created_at: "2026-01-01T00:00:00",
    updated_at: "2026-01-01T00:00:00",
    ...patch,
  };
}

describe("재고 화면 경고", () => {
  it.each([
    ["2026-10-20", true], // 지남
    ["2026-10-28", true], // D-3
    ["2026-10-29", false], // D-4
  ])("소비기한 %s → 기한 글씨 경고 %s", (expiry, warn) => {
    expect(isExpiryWarning(item("a", { nearest_expiry_date: expiry }), TODAY)).toBe(warn);
  });

  it("소비기한이 없으면 기한 경고가 없다", () => {
    expect(isExpiryWarning(item("a"), TODAY)).toBe(false);
  });

  it("재고 없음·기준 이하·확인 필요면 수량 경고", () => {
    expect(isStockWarning(item("a", { total_quantity: 0 }))).toBe(true);
    expect(isStockWarning(item("a", { total_quantity: 100 }))).toBe(true);
    expect(isStockWarning(item("a", { needs_check: true }))).toBe(true);
    expect(isStockWarning(item("a", { total_quantity: 101 }))).toBe(false);
  });
});

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

describe("sortInventoryByOption", () => {
  const items = [
    item("다시마", { nearest_expiry_date: null, total_quantity: 500 }),
    item("가지", { nearest_expiry_date: "2026-11-30", total_quantity: 100 }),
    item("나물", { nearest_expiry_date: "2026-10-26", total_quantity: 300 }),
    item("감자", { nearest_expiry_date: "2026-10-26", total_quantity: 200 }),
  ];
  const names = (list: InventoryItem[]) => list.map((i) => i.name);

  it("소비기한 빠른순 (EXPIRY_ASC): 빠른 날짜 먼저, null은 맨 뒤, 날짜 같으면 이름순", () => {
    expect(names(sortInventoryByOption(items, "EXPIRY_ASC"))).toEqual([
      "감자",
      "나물",
      "가지",
      "다시마",
    ]);
  });

  it("소비기한 늦은순 (EXPIRY_DESC): 늦은 날짜 먼저, null은 맨 뒤, 날짜 같으면 이름순", () => {
    expect(names(sortInventoryByOption(items, "EXPIRY_DESC"))).toEqual([
      "가지",
      "감자",
      "나물",
      "다시마",
    ]);
  });

  it("이름순 (NAME_ASC) / 이름 역순 (NAME_DESC)", () => {
    expect(names(sortInventoryByOption(items, "NAME_ASC"))).toEqual([
      "가지",
      "감자",
      "나물",
      "다시마",
    ]);
    expect(names(sortInventoryByOption(items, "NAME_DESC"))).toEqual([
      "다시마",
      "나물",
      "감자",
      "가지",
    ]);
  });

  it("수량 적은순 (QUANTITY_ASC) / 수량 많은순 (QUANTITY_DESC)", () => {
    expect(names(sortInventoryByOption(items, "QUANTITY_ASC"))).toEqual([
      "가지",
      "감자",
      "나물",
      "다시마",
    ]);
    expect(names(sortInventoryByOption(items, "QUANTITY_DESC"))).toEqual([
      "다시마",
      "나물",
      "감자",
      "가지",
    ]);
  });
});

describe("filterInventoryBySearch", () => {
  const items = [
    item("서울우유 1L"),
    item("매일우유"),
    item("콜롬비아 원두"),
    item("에티오피아 원두"),
  ];
  const names = (list: InventoryItem[]) => list.map((i) => i.name);

  it("공백 및 대소문자 무시하고 검색어를 포함하는 항목을 거른다", () => {
    expect(names(filterInventoryBySearch(items, "우유"))).toEqual(["서울우유 1L", "매일우유"]);
    expect(names(filterInventoryBySearch(items, "서울 우유"))).toEqual(["서울우유 1L"]);
    expect(names(filterInventoryBySearch(items, "1l"))).toEqual(["서울우유 1L"]);
    expect(names(filterInventoryBySearch(items, "원두"))).toEqual([
      "콜롬비아 원두",
      "에티오피아 원두",
    ]);
  });

  it("검색어가 비어있거나 공백뿐이면 전체 반환", () => {
    expect(names(filterInventoryBySearch(items, ""))).toEqual(names(items));
    expect(names(filterInventoryBySearch(items, "   "))).toEqual(names(items));
  });
});

describe("formatExpiryDisplay", () => {
  it("null이면 null 반환", () => {
    expect(formatExpiryDisplay(null, TODAY)).toBeNull();
  });

  it("D-Day 및 남은 일수 계산", () => {
    expect(formatExpiryDisplay("2026-10-25", TODAY)).toEqual({
      dday: "D-Day",
      dateText: "10월 25일",
    });
    expect(formatExpiryDisplay("2026-10-28", TODAY)).toEqual({
      dday: "D-3",
      dateText: "10월 28일",
    });
    expect(formatExpiryDisplay("2026-10-22", TODAY)).toEqual({
      dday: "3일 지남",
      dateText: "10월 22일",
    });
  });
});

describe("calculatePriceChange", () => {
  it("유효한 데이터 포인트가 2개 미만이면 null", () => {
    expect(calculatePriceChange([])).toBeNull();
    expect(calculatePriceChange([{ date: "2026-10-01", unit_price: 1000 }])).toBeNull();
  });

  it("가격 상승률 계산", () => {
    const res = calculatePriceChange([
      { date: "2026-09-20", unit_price: 10000 },
      { date: "2026-10-20", unit_price: 11000 },
    ]);
    expect(res).toEqual({
      rate: 10,
      direction: "up",
      startPrice: 10000,
      endPrice: 11000,
    });
  });

  it("가격 하락률 계산", () => {
    const res = calculatePriceChange([
      { date: "2026-09-20", unit_price: 10000 },
      { date: "2026-10-20", unit_price: 9500 },
    ]);
    expect(res).toEqual({
      rate: 5,
      direction: "down",
      startPrice: 10000,
      endPrice: 9500,
    });
  });

  it("가격 변동 없음 (flat)", () => {
    const res = calculatePriceChange([
      { date: "2026-09-20", unit_price: 10000 },
      { date: "2026-10-20", unit_price: 10000 },
    ]);
    expect(res).toEqual({
      rate: 0,
      direction: "flat",
      startPrice: 10000,
      endPrice: 10000,
    });
  });
});
