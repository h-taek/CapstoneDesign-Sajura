// 발주 추천 화면 — AI 추천 확정 요청 (02_implementation_design.md §3.7 POST /api/orders/approve).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { type MockInstance, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  let approve: MockInstance<typeof ordersApi.approveOrder>;

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
    approve = vi.spyOn(ordersApi, "approveOrder").mockResolvedValue({
      order_id: "o-1",
      approved_at: "2026-10-03T10:00:00",
      total_estimated_cost: 0,
      status: "APPROVED",
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("AI 추천은 추천 수량이 있는 품목만 미리 선택하고 recommendation_id와 함께 확정한다", async () => {
    renderPage();
    const button = await screen.findByRole("button", { name: /AI 추천 발주 확정 \(1\)/ });
    expect(screen.getByText("설정 필요")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("원두 발주 수량"), { target: { value: "300" } });
    fireEvent.click(button);

    await waitFor(() => expect(approve).toHaveBeenCalledTimes(1));
    expect(approve).toHaveBeenCalledWith({
      recommendation_id: "rec-1",
      items: [{ item_id: "bean", final_quantity: 300 }],
    });
  });

  it("체크를 풀면 해당 품목은 확정 요청에서 빠진다", async () => {
    renderPage();
    await screen.findByRole("button", { name: /AI 추천 발주 확정 \(1\)/ });
    fireEvent.click(screen.getByLabelText("시럽 선택"));
    fireEvent.change(screen.getByLabelText("시럽 발주 수량"), { target: { value: "20" } });
    fireEvent.click(screen.getByLabelText("원두 선택"));
    fireEvent.click(screen.getByRole("button", { name: /AI 추천 발주 확정 \(1\)/ }));

    await waitFor(() => expect(approve).toHaveBeenCalledTimes(1));
    expect(approve).toHaveBeenCalledWith({
      recommendation_id: "rec-1",
      items: [{ item_id: "syrup", final_quantity: 20 }],
    });
  });

  it("단가가 있으면 예상 금액을, 없으면 단가 미설정을 보여 준다", async () => {
    renderPage();
    await screen.findByRole("button", { name: /AI 추천 발주 확정 \(1\)/ });
    expect(screen.getByText("단가 28원/g · 예상 14,000원")).toBeInTheDocument();
    expect(screen.getByText("단가 미설정")).toBeInTheDocument();
    expect(screen.getByText("14,000원")).toBeInTheDocument(); // 확정 줄 합계

    fireEvent.change(screen.getByLabelText("원두 발주 수량"), { target: { value: "300" } });
    expect(screen.getByText("단가 28원/g · 예상 8,400원")).toBeInTheDocument();
  });
});
