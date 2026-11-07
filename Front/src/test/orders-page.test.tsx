// 발주 추천 화면 — v2 AI 추천 선택·수량·확장 상태 (04_fe.md §4.8, 목업 10_orders.html).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HTTPError } from "ky";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as forecastApi from "../api/endpoints/forecast";
import * as ordersApi from "../api/endpoints/orders";
import * as extensionLib from "../lib/extension";
import OrdersPage from "../routes/orders";

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/orders"]}>
        <OrdersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const aiRecommend: ordersApi.AIRecommendResponse = {
  recommendation_id: "rec-1",
  target_dates: ["2026-10-20", "2026-10-21", "2026-10-22"],
  is_low_confidence: false,
  low_confidence_reason: null,
  menu_forecast: [],
  recommendations: [
    {
      item_id: "bean",
      item_name: "원두",
      unit: "g",
      recommended_quantity: 500,
      expected_stockout_date: "2026-10-21",
      lead_time_days: 2,
      safety_stock: 50,
      config_status: "USER_CONFIGURED",
      recommendation_reason: "3일 소요 450g + 안전재고 50g",
      unit_price: 28,
    },
    {
      item_id: "syrup",
      item_name: "시럽",
      unit: "ml",
      recommended_quantity: 0,
      expected_stockout_date: null,
      lead_time_days: 1,
      safety_stock: 0,
      config_status: "DEFAULT_USED",
      recommendation_reason: "예상 소모 없음",
      unit_price: null,
    },
  ],
};

describe("OrdersPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(ordersApi, "getAIRecommend").mockResolvedValue(aiRecommend);
    vi.spyOn(ordersApi, "listOrders").mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      size: 20,
      total_pages: 0,
    });
    vi.spyOn(extensionLib, "isExtensionRuntimeAvailable").mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("AI 추천은 추천 수량이 있는 품목만 미리 선택하고, 기본값 계산 품목에 경고를 표시한다", async () => {
    renderPage();
    expect(await screen.findByLabelText("원두 선택")).toBeChecked();
    expect(screen.getByLabelText("시럽 선택")).not.toBeChecked();
    expect(screen.getByText("기본값으로 계산")).toBeInTheDocument();
  });

  it("추천 근거는 웹에서만 한 줄로 자르고(마우스오버 전체), 앱에서는 자르지 않는다", async () => {
    renderPage();
    const reason = (await screen.findByText(/3일 소요 450g/)).closest("p");
    expect(reason).toHaveAttribute("title", "3일 소요 450g + 안전재고 50g");
    expect(reason).toHaveClass("lg:truncate");
    expect(reason).not.toHaveClass("truncate");
  });

  it("단가가 있으면 예상 금액을, 없으면 단가 미설정을 보여 준다", async () => {
    renderPage();
    const amounts = await screen.findAllByText("14,000원");
    expect(amounts.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("28원/g")).toBeInTheDocument();
    expect(screen.getByText("단가 미설정")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("원두 발주 수량"), { target: { value: "300" } });
    const newAmounts = await screen.findAllByText("8,400원");
    expect(newAmounts.length).toBeGreaterThanOrEqual(1);
  });

  it("확장이 감지되지 않으면 쿠팡 담기 버튼이 비활성화되고 안내 문구를 표시한다", async () => {
    renderPage();
    const button = await screen.findByRole("button", { name: "쿠팡 담기" });
    expect(button).toBeDisabled();
    expect(screen.getByText("PC 크롬에서 사주라 확장으로 담아 주세요")).toBeInTheDocument();
  });

  it("예측이 없을 때(404) '지금 계산하기' 버튼을 노출하고 클릭 시 runForecast를 실행한다", async () => {
    const errorResponse = new Response(JSON.stringify({ detail: "FORECAST_NOT_FOUND" }), {
      status: 404,
    });
    vi.spyOn(ordersApi, "getAIRecommend").mockRejectedValue(
      new HTTPError(
        errorResponse,
        new Request("http://localhost/orders/recommend"),
        {} as unknown as import("ky").NormalizedOptions,
      ),
    );
    const runSpy = vi.spyOn(forecastApi, "runForecast").mockResolvedValue({
      predictions: [
        {
          target_date: "2026-10-20",
          horizon_days: 1,
          predicted_sales: 100000,
          interval_p10: 90000,
          interval_p90: 110000,
          is_low_confidence: false,
          explanation: {
            baseline: "100000",
            deviation_vs_baseline: 0,
            top_factors: [],
            sentence: "평소와 비슷해요",
          },
          menu_forecast: [],
        },
      ],
    });

    renderPage();
    expect(await screen.findByText("아직 오늘 예측이 없어요")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "지금 계산하기" });
    fireEvent.click(button);
    await waitFor(() => {
      expect(runSpy).toHaveBeenCalled();
    });
  });
});
