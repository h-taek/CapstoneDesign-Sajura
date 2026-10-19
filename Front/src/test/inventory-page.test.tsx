// 재고 화면 — 로트 목록·입고·수정·폐기 (02_implementation_design.md §3.5).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as inventoryApi from "../api/endpoints/inventory";
import InventoryPage from "../routes/inventory";

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/inventory"]}>
        <InventoryPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// BE는 DECIMAL을 문자열로 보낸다
const bean = {
  item_id: "bean",
  name: "원두",
  unit: "g",
  total_quantity: "2000.000",
  alert_status: "NEEDS_CHECK",
  low_stock_threshold: "500.000",
  lead_time_days: null,
  safety_stock: null,
  created_at: "2026-10-01T00:00:00",
  updated_at: "2026-10-01T00:00:00",
} as unknown as inventoryApi.InventoryItem;

const lot = {
  lot_id: "lot-1",
  item_id: "bean",
  quantity: "5000.000",
  remaining_quantity: "2000.000",
  received_at: "2026-10-01",
  expiry_date: "2026-11-01",
  purchase_price: 28000,
} as unknown as inventoryApi.Lot;

describe("InventoryPage", () => {
  beforeEach(() => {
    vi.spyOn(inventoryApi, "listInventory").mockResolvedValue([bean]);
    vi.spyOn(inventoryApi, "listLots").mockResolvedValue([lot]);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("총 수량과 상태 배지를 보여 주고, 펼치면 로트와 재고 확인 필요 안내가 나온다", async () => {
    renderPage();
    const toggle = await screen.findByRole("button", { name: /원두/ });
    expect(screen.getByText("2,000 g")).toBeInTheDocument();
    expect(screen.getByText("재고 확인 필요")).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(await screen.findByText("28,000원")).toBeInTheDocument();
    expect(screen.getByText(/기록상 재고 없이 판매가 차감됐습니다/)).toBeInTheDocument();
  });

  it("입고를 등록한다", async () => {
    const add = vi.spyOn(inventoryApi, "addLot").mockResolvedValue(lot);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /원두/ }));
    await screen.findByText("28,000원");

    fireEvent.change(screen.getByLabelText(/입고 수량/), { target: { value: "1000" } });
    fireEvent.change(screen.getByLabelText(/입고일/), { target: { value: "2026-10-19" } });
    fireEvent.change(screen.getByLabelText(/구매 금액/), { target: { value: "5600" } });
    fireEvent.click(screen.getByRole("button", { name: "입고 등록" }));

    await waitFor(() => expect(add).toHaveBeenCalledTimes(1));
    expect(add).toHaveBeenCalledWith("bean", {
      quantity: 1000,
      received_at: "2026-10-19",
      expiry_date: null,
      purchase_price: 5600,
    });
  });

  it("로트 수정은 바뀐 필드와 사유만 보낸다", async () => {
    const update = vi.spyOn(inventoryApi, "updateLot").mockResolvedValue();
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /원두/ }));
    fireEvent.click(await screen.findByRole("button", { name: "수정" }));

    fireEvent.change(screen.getByLabelText(/잔여 수량/), { target: { value: "1800" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update).toHaveBeenCalledWith("bean", "lot-1", {
      remaining_quantity: 1800,
      reason: "STOCKTAKE",
      memo: null,
    });
  });

  it("폐기는 잔여 수량을 넘으면 막고, 범위 안이면 로트를 지정해 보낸다", async () => {
    const dispose = vi.spyOn(inventoryApi, "disposeLot").mockResolvedValue();
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /원두/ }));
    const row = (await screen.findByText("28,000원")).closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "폐기" }));

    const input = screen.getByLabelText(/폐기 수량/);
    fireEvent.change(input, { target: { value: "2500" } });
    const submit = screen
      .getAllByRole("button", { name: "폐기" })
      .find((b) => b.getAttribute("type") === "submit") as HTMLElement;
    expect(submit).toBeDisabled();

    fireEvent.change(input, { target: { value: "500" } });
    fireEvent.click(submit);
    await waitFor(() => expect(dispose).toHaveBeenCalledTimes(1));
    expect(dispose).toHaveBeenCalledWith("bean", { lot_id: "lot-1", quantity: 500, reason: null });
  });

  it("재료 추가 시 수량이 있으면 구매 금액을 요구한다", async () => {
    const create = vi.spyOn(inventoryApi, "createInventoryItem").mockResolvedValue(bean);
    renderPage();
    await screen.findByRole("button", { name: /원두/ });
    fireEvent.click(screen.getByRole("button", { name: /재료 추가/ }));

    fireEvent.change(screen.getByLabelText("재료명"), { target: { value: "우유" } });
    fireEvent.change(screen.getByLabelText(/단위/), { target: { value: "ml" } });
    fireEvent.change(screen.getByLabelText("현재 수량"), { target: { value: "1000" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(await screen.findByText("수량이 있으면 구매 금액을 입력하세요.")).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("구매 금액 (원)"), { target: { value: "3000" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "우유",
        unit: "ml",
        quantity: 1000,
        purchase_price: 3000,
        expiry_date: null,
        safety_stock: null,
        lead_time_days: null,
      }),
    );
  });
});
