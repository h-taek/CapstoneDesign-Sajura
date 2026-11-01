// 화면용 API 엔드포인트 단위 시험 — 02_implementation_design.md §3 경로·인자·타임아웃 검증.
import { afterEach, describe, expect, it, vi } from "vitest";
import { getForecastVsActual } from "../api/endpoints/dashboard";
import { getForecastPredict, runForecast } from "../api/endpoints/forecast";
import { getPriceTrends } from "../api/endpoints/inventory";
import {
  finishOrderAutomation,
  startOrderAutomation,
  stepOrderAutomation,
} from "../api/endpoints/orders";
import { getSalesTrends, getTopMenus, listSales } from "../api/endpoints/sales";
import { api } from "../lib/api";

function mockKyJson<T>(data: T) {
  return {
    json: async () => data,
  };
}

describe("API 엔드포인트 함수 (src/api/endpoints/*)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("판매 API: listSales, getSalesTrends(메뉴별), getTopMenus(기간별)가 쿼리 인자를 전달한다", async () => {
    const getSpy = vi.spyOn(api, "get").mockImplementation(
      () =>
        mockKyJson({
          items: [],
          total: 0,
          total_revenue: 0,
          page: 1,
          size: 20,
          total_pages: 0,
        }) as unknown as ReturnType<typeof api.get>,
    );

    await listSales({
      start_date: new Date(2026, 4, 1),
      end_date: "2026-05-31",
      menu_id: "menu-1",
      order: "desc",
      page: 2,
      size: 50,
    });
    expect(getSpy).toHaveBeenCalledWith("sales", {
      searchParams: {
        start_date: "2026-05-01",
        end_date: "2026-05-31",
        menu_id: "menu-1",
        order: "desc",
        page: 2,
        size: 50,
      },
    });

    await getSalesTrends("2026-05-01", "2026-05-07", "day", "menu-1");
    expect(getSpy).toHaveBeenCalledWith("sales/trends", {
      searchParams: {
        start_date: "2026-05-01",
        end_date: "2026-05-07",
        group_by: "day",
        menu_id: "menu-1",
      },
    });

    await getTopMenus(5, { start_date: "2026-05-01", end_date: "2026-05-07" });
    expect(getSpy).toHaveBeenCalledWith("sales/top-menus", {
      searchParams: {
        limit: 5,
        start_date: "2026-05-01",
        end_date: "2026-05-07",
      },
    });
  });

  it("대시보드·예측 API: getForecastVsActual, getForecastPredict, runForecast(120초)를 호출한다", async () => {
    const getSpy = vi.spyOn(api, "get").mockImplementation(
      () =>
        mockKyJson({
          start_date: "2026-05-01",
          end_date: "2026-05-07",
          data: [],
        }) as unknown as ReturnType<typeof api.get>,
    );
    const postSpy = vi
      .spyOn(api, "post")
      .mockImplementation(
        () => mockKyJson({ predictions: [] }) as unknown as ReturnType<typeof api.post>,
      );

    await getForecastVsActual("2026-05-01", "2026-05-07");
    expect(getSpy).toHaveBeenCalledWith("dashboard/forecast-vs-actual", {
      searchParams: { start_date: "2026-05-01", end_date: "2026-05-07" },
    });

    await getForecastPredict("2026-05-08");
    expect(getSpy).toHaveBeenCalledWith("forecast", {
      searchParams: { target_date: "2026-05-08" },
    });

    await runForecast();
    expect(postSpy).toHaveBeenCalledWith("forecast/run", { timeout: 120_000 });
  });

  it("재고 API: getPriceTrends가 경로와 days 쿼리를 전달한다", async () => {
    const getSpy = vi.spyOn(api, "get").mockImplementation(
      () =>
        mockKyJson({
          start_date: "2026-04-01",
          end_date: "2026-05-01",
          items: [],
        }) as unknown as ReturnType<typeof api.get>,
    );

    await getPriceTrends(14);
    expect(getSpy).toHaveBeenCalledWith("inventory/price-trends", {
      searchParams: { days: 14 },
    });
  });

  it("발주 쿠팡 자동화 API: start·step(120초 타임아웃)·finish를 호출한다", async () => {
    const postSpy = vi
      .spyOn(api, "post")
      .mockImplementation(
        () =>
          mockKyJson({ action: { tool: "read_elements", args: {} } }) as unknown as ReturnType<
            typeof api.post
          >,
      );
    await startOrderAutomation({
      recommendation_id: "rec-1",
      items: [{ item_id: "bean", final_quantity: 2000 }],
      note: null,
      coupang_logged_in: true,
    });
    expect(postSpy).toHaveBeenCalledWith("orders/automate/start", {
      json: {
        recommendation_id: "rec-1",
        items: [{ item_id: "bean", final_quantity: 2000 }],
        note: null,
        coupang_logged_in: true,
      },
    });

    await stepOrderAutomation("run-1", {
      target: "bean",
      result: null,
      non_wow_prices: [],
    });
    expect(postSpy).toHaveBeenCalledWith("orders/automate/run-1/step", {
      json: { target: "bean", result: null, non_wow_prices: [] },
      timeout: 120_000,
    });

    await finishOrderAutomation("run-1", { non_wow_prices: [] });
    expect(postSpy).toHaveBeenCalledWith("orders/automate/run-1/finish", {
      json: { non_wow_prices: [] },
    });
  });
});
