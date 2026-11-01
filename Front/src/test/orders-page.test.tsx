// 발주 추천 화면 — AI 추천 선택·수량 (02_implementation_design.md §3.7 GET /api/orders/recommend).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as ordersApi from "../api/endpoints/orders";
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
  target_dates: ["2026-10-04", "2026-10-05", "2026-10-06"],
  is_low_confidence: false,
  low_confidence_reason: null,
  menu_forecast: [],
  recommendations: [
    {
      item_id: "bean",
      item_name: "원두",
      unit: "g",
      recommended_quantity: 500,
      expected_stockout_date: "2026-10-05",
      lead_time_days: 2,
      safety_stock: 50,
      config_status: "USER_CONFIGURED",
      recommendation_reason: "근거",
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
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("AI 추천은 추천 수량이 있는 품목만 미리 선택한다", async () => {
    renderPage();
    expect(await screen.findByLabelText("원두 선택")).toBeChecked();
    expect(screen.getByLabelText("시럽 선택")).not.toBeChecked();
    expect(screen.getByText("설정 필요")).toBeInTheDocument();
  });

  it("단가가 있으면 예상 금액을, 없으면 단가 미설정을 보여 준다", async () => {
    renderPage();
    expect(await screen.findByText("단가 28원/g · 예상 14,000원")).toBeInTheDocument();
    expect(screen.getByText("단가 미설정")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("원두 발주 수량"), { target: { value: "300" } });
    expect(screen.getByText("단가 28원/g · 예상 8,400원")).toBeInTheDocument();
  });
});
