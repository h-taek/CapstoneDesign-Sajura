// B6 추천발주 + 쿠팡 담기 FE 단위 및 통합 시험 — 04_fe.md §4.8·§12, 08_coupang_cart.md §4.
import { act, renderHook } from "@testing-library/react";
import { HTTPError } from "ky";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderRecommendation } from "../api/endpoints/orders";
import * as ordersApi from "../api/endpoints/orders";
import {
  calculateOrderSummary,
  formatOrderCost,
  formatStockoutDate,
  formatTargetPeriod,
  sortRecommendations,
} from "../components/orders/order-calc";
import { useCoupangCart } from "../features/coupang-cart/use-coupang-cart";
import * as extensionLib from "../lib/extension";

describe("b6: order-calc 순수 함수", () => {
  it("sortRecommendations: 소진일 빠른 순 -> 가나다순 -> 소진일 없는 품목 맨 뒤", () => {
    const items: OrderRecommendation[] = [
      {
        item_id: "3",
        item_name: "토마토",
        unit: "g",
        recommended_quantity: 100,
        expected_stockout_date: null,
        lead_time_days: 1,
        safety_stock: 0,
        config_status: "USER_CONFIGURED",
        recommendation_reason: "",
        unit_price: 10,
      },
      {
        item_id: "1",
        item_name: "바질",
        unit: "kg",
        recommended_quantity: 0.35,
        expected_stockout_date: "2026-10-21",
        lead_time_days: 1,
        safety_stock: 0,
        config_status: "USER_CONFIGURED",
        recommendation_reason: "",
        unit_price: null,
      },
      {
        item_id: "2",
        item_name: "모짜렐라 치즈",
        unit: "g",
        recommended_quantity: 3200,
        expected_stockout_date: "2026-10-22",
        lead_time_days: 2,
        safety_stock: 1000,
        config_status: "USER_CONFIGURED",
        recommendation_reason: "",
        unit_price: 16,
      },
      {
        item_id: "4",
        item_name: "페퍼로니",
        unit: "g",
        recommended_quantity: 1000,
        expected_stockout_date: "2026-10-21",
        lead_time_days: 1,
        safety_stock: 0,
        config_status: "USER_CONFIGURED",
        recommendation_reason: "",
        unit_price: 25,
      },
      {
        item_id: "5",
        item_name: "올리브오일",
        unit: "ml",
        recommended_quantity: 0,
        expected_stockout_date: null,
        lead_time_days: 1,
        safety_stock: 0,
        config_status: "USER_CONFIGURED",
        recommendation_reason: "",
        unit_price: 5,
      },
    ];

    const sorted = sortRecommendations(items);
    // 10-21 바질, 10-21 페퍼로니, 10-22 모짜렐라 치즈, null 올리브오일, null 토마토
    expect(sorted.map((i) => i.item_name)).toEqual([
      "바질",
      "페퍼로니",
      "모짜렐라 치즈",
      "올리브오일",
      "토마토",
    ]);
  });

  it("calculateOrderSummary: 단가 미설정 품목은 합계에서 제외되고 안내 문구가 생성된다", () => {
    const items: OrderRecommendation[] = [
      {
        item_id: "basil",
        item_name: "바질",
        unit: "kg",
        recommended_quantity: 0.35,
        expected_stockout_date: "2026-10-21",
        lead_time_days: 1,
        safety_stock: 0,
        config_status: "USER_CONFIGURED",
        recommendation_reason: "",
        unit_price: null,
      },
      {
        item_id: "pepperoni",
        item_name: "페퍼로니",
        unit: "g",
        recommended_quantity: 1000,
        expected_stockout_date: "2026-10-21",
        lead_time_days: 1,
        safety_stock: 0,
        config_status: "USER_CONFIGURED",
        recommendation_reason: "",
        unit_price: 25,
      },
      {
        item_id: "dough",
        item_name: "피자 도우",
        unit: "개",
        recommended_quantity: 60,
        expected_stockout_date: "2026-10-21",
        lead_time_days: 1,
        safety_stock: 0,
        config_status: "USER_CONFIGURED",
        recommendation_reason: "",
        unit_price: 500,
      },
    ];

    const selected = new Set(["basil", "pepperoni", "dough"]);
    const quantities = { basil: "0.35", pepperoni: "1000", dough: "60" };

    const summary = calculateOrderSummary(items, selected, quantities);

    expect(summary.selectedCount).toBe(3);
    // 25 * 1000 + 500 * 60 = 25000 + 30000 = 55000
    expect(summary.estimatedTotal).toBe(55000);
    expect(summary.unpricedCount).toBe(1);
    expect(summary.unpricedNames).toEqual(["바질"]);
    expect(summary.unpricedMessage).toBe("단가 미설정 1개(바질)는 합계에서 빠져요");
  });

  it("formatStockoutDate 및 formatTargetPeriod 포맷 검증", () => {
    expect(formatStockoutDate("2026-10-21")).toBe("10/21");
    expect(formatStockoutDate(null)).toBe("—");

    const targetDates = ["2026-10-20", "2026-10-21", "2026-10-22"];
    const periodStr = formatTargetPeriod(targetDates);
    // 10월 20일 화요일 하루 전은 10월 19일
    expect(periodStr).toContain("10월 19일 판매까지 반영");
    expect(periodStr).toContain("10월 20일 (화)");
    expect(periodStr).toContain("3일분");
  });

  it("formatOrderCost: 단가를 하나도 못 읽어 합계가 0이면 —", () => {
    expect(formatOrderCost(84000)).toBe("84,000원");
    expect(formatOrderCost(0)).toBe("—");
  });
});

describe("b6: useCoupangCart 담기 오케스트레이션", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("확장이 감지되지 않을 때 hasExtension은 false", async () => {
    vi.spyOn(extensionLib, "isExtensionRuntimeAvailable").mockReturnValue(false);
    const { result } = renderHook(() => useCoupangCart({ recommendationId: "rec-1" }));

    await act(async () => {
      await result.current.checkExtension();
    });

    expect(result.current.hasExtension).toBe(false);
  });

  it("정상 담기 플로우: open -> start -> step(action/done) -> finish", async () => {
    vi.spyOn(extensionLib, "isExtensionRuntimeAvailable").mockReturnValue(true);
    vi.spyOn(extensionLib, "pingExtension").mockResolvedValue({ ok: true, version: "1.0.0" });
    vi.spyOn(extensionLib, "openExtension").mockResolvedValue({ ok: true, logged_in: true });
    vi.spyOn(extensionLib, "sendExtensionProgress").mockResolvedValue({ ok: true });
    vi.spyOn(extensionLib, "takeNonWowPrices").mockResolvedValue({ ok: true, non_wow_prices: [] });

    vi.spyOn(ordersApi, "startOrderAutomation").mockResolvedValue({
      run_id: "run-123",
      targets: [{ item_id: "item-1", item_name: "바질" }],
    });

    // 1회차 step: action 반환, 2회차 step: finish_item done 반환, 3회차 step (cart_check): done 반환
    const stepSpy = vi.spyOn(ordersApi, "stepOrderAutomation");
    stepSpy
      .mockResolvedValueOnce({
        action: { tool: "read_elements", args: {} },
      })
      .mockResolvedValueOnce({
        done: { tool: "finish_item", args: { reason: null } },
      })
      .mockResolvedValueOnce({
        done: { tool: "finish_cart_check", args: { items: [{ item_id: "item-1", status: "OK" }] } },
      });

    const runExtensionSpy = vi.spyOn(extensionLib, "runExtension").mockResolvedValue({
      ok: true,
      result: { kind: "elements", url: "https://coupang.com", elements: [] },
      non_wow_prices: [],
    });

    const finishSpy = vi.spyOn(ordersApi, "finishOrderAutomation").mockResolvedValue({
      order_id: "order-999",
      approved_at: "2026-10-20T09:30:00Z",
      total_estimated_cost: 15000,
      manual_guide_url: null,
      items: [{ item_id: "item-1", status: "ADDED", reason: null }],
    });

    const onFinished = vi.fn();
    const { result } = renderHook(() => useCoupangCart({ recommendationId: "rec-1", onFinished }));

    await act(async () => {
      await result.current.startCarting({
        items: [{ item_id: "item-1", final_quantity: 1 }],
      });
    });

    expect(result.current.status).toBe("result");
    expect(result.current.finishResult?.order_id).toBe("order-999");
    expect(runExtensionSpy).toHaveBeenCalled();
    expect(finishSpy).toHaveBeenCalled();
    expect(onFinished).toHaveBeenCalled();
  });

  it("작업 탭을 닫으면 담기를 멈추고 finish를 부르지 않는다", async () => {
    vi.spyOn(extensionLib, "isExtensionRuntimeAvailable").mockReturnValue(true);
    vi.spyOn(extensionLib, "pingExtension").mockResolvedValue({ ok: true, version: "1.0.0" });
    vi.spyOn(extensionLib, "openExtension").mockResolvedValue({ ok: true, logged_in: true });
    vi.spyOn(extensionLib, "sendExtensionProgress").mockResolvedValue({ ok: true });
    vi.spyOn(ordersApi, "startOrderAutomation").mockResolvedValue({
      run_id: "run-1",
      targets: [
        { item_id: "item-1", item_name: "바질" },
        { item_id: "item-2", item_name: "양파" },
      ],
    });
    const stepSpy = vi
      .spyOn(ordersApi, "stepOrderAutomation")
      .mockResolvedValue({ action: { tool: "read_elements", args: {} } });
    vi.spyOn(extensionLib, "runExtension").mockResolvedValue({
      ok: false,
      error: extensionLib.TAB_CLOSED_ERROR,
    });
    const finishSpy = vi.spyOn(ordersApi, "finishOrderAutomation");

    const { result } = renderHook(() => useCoupangCart({ recommendationId: "rec-1" }));
    await act(async () => {
      await result.current.startCarting({ items: [{ item_id: "item-1", final_quantity: 1 }] });
    });

    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toContain("발주는 만들지 않았어요");
    expect(stepSpy).toHaveBeenCalledTimes(1);
    expect(finishSpy).not.toHaveBeenCalled();
  });

  it("진행 패널의 담김은 직전 동작에 담기 결과가 있을 때만 보낸다", async () => {
    vi.spyOn(extensionLib, "isExtensionRuntimeAvailable").mockReturnValue(true);
    vi.spyOn(extensionLib, "pingExtension").mockResolvedValue({ ok: true, version: "1.0.0" });
    vi.spyOn(extensionLib, "openExtension").mockResolvedValue({ ok: true, logged_in: true });
    vi.spyOn(extensionLib, "takeNonWowPrices").mockResolvedValue({ ok: true, non_wow_prices: [] });
    const progressSpy = vi
      .spyOn(extensionLib, "sendExtensionProgress")
      .mockResolvedValue({ ok: true });
    vi.spyOn(ordersApi, "startOrderAutomation").mockResolvedValue({
      run_id: "run-1",
      targets: [
        { item_id: "item-1", item_name: "바질" },
        { item_id: "item-2", item_name: "양파" },
      ],
    });
    const click = { action: { tool: "click", args: { ref: "1" } } } as const;
    const doneNoReason = { done: { tool: "finish_item", args: { reason: null } } } as const;
    vi.spyOn(ordersApi, "stepOrderAutomation")
      .mockResolvedValueOnce(click)
      .mockResolvedValueOnce(doneNoReason)
      .mockResolvedValueOnce(click)
      .mockResolvedValueOnce(doneNoReason)
      .mockResolvedValueOnce({ done: { tool: "finish_cart_check", args: {} } });
    const action = (cartAdded: boolean) => ({
      ok: true as const,
      result: {
        kind: "action" as const,
        ok: true,
        page_changed: false,
        message: null,
        cart_added: cartAdded
          ? { item_id: "c-1", product_id: "p-1", vendor_item_id: null, price: 9900 }
          : null,
      },
      non_wow_prices: [],
    });
    vi.spyOn(extensionLib, "runExtension")
      .mockResolvedValueOnce(action(true))
      .mockResolvedValueOnce(action(false));
    vi.spyOn(ordersApi, "finishOrderAutomation").mockResolvedValue({
      order_id: "o-1",
      approved_at: "2026-10-20T09:30:00Z",
      total_estimated_cost: 9900,
      manual_guide_url: "https://www.coupang.com/",
      items: [
        { item_id: "item-1", status: "ADDED", reason: null },
        { item_id: "item-2", status: "FAILED", reason: null },
      ],
    });

    const { result } = renderHook(() => useCoupangCart({ recommendationId: "rec-1" }));
    await act(async () => {
      await result.current.startCarting({ items: [{ item_id: "item-1", final_quantity: 1 }] });
    });

    const results = progressSpy.mock.calls
      .map(([p]) => p)
      .filter((p) => p.kind === "result")
      .map((p) => (p.kind === "result" ? p.status : null));
    expect(results).toEqual(["ADDED", "FAILED"]);
    expect(result.current.itemProgress).toEqual({ "item-1": "added", "item-2": "failed" });
  });

  it("step 중 422 ORDER_LLM_GUARD_REJECTED 발생 시 notice를 전송하고 다음 대상/finish로 진행한다", async () => {
    vi.spyOn(extensionLib, "isExtensionRuntimeAvailable").mockReturnValue(true);
    vi.spyOn(extensionLib, "pingExtension").mockResolvedValue({ ok: true, version: "1.0.0" });
    vi.spyOn(extensionLib, "openExtension").mockResolvedValue({ ok: true, logged_in: true });
    vi.spyOn(extensionLib, "sendExtensionProgress").mockResolvedValue({ ok: true });
    vi.spyOn(extensionLib, "takeNonWowPrices").mockResolvedValue({ ok: true, non_wow_prices: [] });

    const noticeSpy = vi.spyOn(extensionLib, "sendExtensionNotice").mockResolvedValue({ ok: true });

    vi.spyOn(ordersApi, "startOrderAutomation").mockResolvedValue({
      run_id: "run-422",
      targets: [{ item_id: "item-1", item_name: "이상한요청" }],
    });

    const guardError = new HTTPError(
      new Response(JSON.stringify({ detail: { reason: "프롬프트 주입 감지" } }), { status: 422 }),
      new Request("http://localhost/orders/automate/step"),
      {} as unknown as import("ky").NormalizedOptions,
    );

    const stepSpy = vi.spyOn(ordersApi, "stepOrderAutomation");
    stepSpy
      // item-1에서 422 오류
      .mockRejectedValueOnce(guardError)
      // cart_check에서 완료
      .mockResolvedValueOnce({
        done: { tool: "finish_cart_check", args: { items: [] } },
      });

    vi.spyOn(ordersApi, "finishOrderAutomation").mockResolvedValue({
      order_id: null,
      approved_at: "2026-10-20T09:30:00Z",
      total_estimated_cost: 0,
      manual_guide_url: "https://coupang.com/help",
      items: [{ item_id: "item-1", status: "FAILED", reason: "프롬프트 주입 감지" }],
    });

    const { result } = renderHook(() => useCoupangCart({ recommendationId: "rec-1" }));

    await act(async () => {
      await result.current.startCarting({
        items: [{ item_id: "item-1", final_quantity: 1 }],
      });
    });

    expect(noticeSpy).toHaveBeenCalledWith(extensionLib.GUARD_REJECTED_TITLE, "프롬프트 주입 감지");
    expect(result.current.status).toBe("result");
    expect(result.current.finishResult?.items[0]?.status).toBe("FAILED");
  });
});
