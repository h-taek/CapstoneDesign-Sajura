// 재고 화면 — 경고 글씨·입고 대기 카드·로트 목록·입고·수정·폐기 (04_fe.md §4.6, 09_inventory.html).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { HTTPError } from "ky";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as inventoryApi from "../api/endpoints/inventory";
import * as ordersApi from "../api/endpoints/orders";
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

const bean: inventoryApi.InventoryItem = {
  item_id: "bean",
  name: "원두",
  unit: "g",
  total_quantity: 2000,
  nearest_expiry_date: "2026-11-01",
  needs_check: true,
  low_stock_threshold: 500,
  lead_time_days: null,
  safety_stock: null,
  coupang_product: null,
  unit_price: null,
  created_at: "2026-10-01T00:00:00",
  updated_at: "2026-10-01T00:00:00",
};

const lot: inventoryApi.Lot = {
  lot_id: "lot-1",
  item_id: "bean",
  quantity: 5000,
  remaining_quantity: 2000,
  received_at: "2026-10-01",
  expiry_date: "2026-11-01",
  purchase_price: 28000,
};

function lotList(pending: inventoryApi.PendingOrderItem[] = []): inventoryApi.LotList {
  return { item_id: "bean", item_name: "원두", lots: [lot], pending_orders: pending };
}

const pendingOrder: inventoryApi.PendingOrderItem = {
  order_item_id: "oi-1",
  order_id: "o-1",
  approved_at: "2026-10-16T01:12:00",
  final_quantity: 3000,
  subtotal: null,
};

describe("InventoryPage", () => {
  beforeEach(() => {
    vi.spyOn(inventoryApi, "listInventory").mockResolvedValue([bean]);
    vi.spyOn(inventoryApi, "listLots").mockResolvedValue(lotList());
    vi.spyOn(inventoryApi, "getPriceTrends").mockResolvedValue({
      start_date: "2026-09-20",
      end_date: "2026-10-20",
      items: [],
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("확인 필요 재료는 배지 없이 수량 글씨가 빨갛고, 누르면 상세 판(로트와 안내)이 열린다", async () => {
    renderPage();
    const cardBtn = await screen.findByRole("button", { name: /원두/ });
    expect(screen.getByText("2,000")).toHaveClass("text-danger");
    expect(screen.queryByText("재고 확인 필요")).not.toBeInTheDocument();

    fireEvent.click(cardBtn);

    expect(
      await screen.findByText(
        /기록상 재고 없이 판매가 차감됐어요\. 입고를 등록하거나 로트 수정으로 수량을 맞추세요\./,
      ),
    ).toBeInTheDocument();
  });

  it("입고를 등록한다", async () => {
    const add = vi.spyOn(inventoryApi, "addLot").mockResolvedValue(lot);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /원두/ }));
    await screen.findByText(/28,000원/);

    fireEvent.click(screen.getByRole("button", { name: /입고 등록/ }));

    fireEvent.change(screen.getByLabelText(/입고 수량/), { target: { value: "1000" } });
    fireEvent.change(screen.getByLabelText(/입고일/), { target: { value: "2026-10-19" } });
    fireEvent.change(screen.getByLabelText(/구매 금액/), { target: { value: "5600" } });
    fireEvent.click(screen.getByRole("button", { name: "등록" }));

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
    const row = (await screen.findByText(/28,000원/)).closest("li") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "폐기" }));

    const input = screen.getByLabelText(/폐기 수량/);
    fireEvent.change(input, { target: { value: "2500" } });
    const submit = screen
      .getAllByRole("button", { name: "폐기" })
      .find((b) => b.getAttribute("type") === "submit") as HTMLElement;
    expect(submit).toBeDisabled();

    fireEvent.change(input, { target: { value: "500" } });
    expect(submit).not.toBeDisabled();
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

    fireEvent.change(screen.getByLabelText(/구매 금액/), { target: { value: "3000" } });
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

  it("삭제를 누르면 재료를 골라 한 번에 지우고, 사용 중(409)인 재료는 실패 개수를 알린다", async () => {
    const milk = { ...bean, item_id: "milk", name: "우유" };
    const salt = { ...bean, item_id: "salt", name: "소금" };
    vi.spyOn(inventoryApi, "listInventory").mockResolvedValue([bean, milk, salt]);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    const del = vi.spyOn(inventoryApi, "deleteInventoryItem").mockImplementation(async (id) => {
      if (id === "salt") {
        throw new HTTPError(
          new Response("{}", { status: 409 }),
          new Request("http://localhost/api/inventory/salt"),
          {} as never,
        );
      }
    });
    renderPage();
    await screen.findByRole("button", { name: /원두/ });

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    // 고르는 중에는 카드를 눌러도 상세 판이 열리지 않고 선택만 된다
    fireEvent.click(screen.getByRole("button", { name: /원두/ }));
    expect(screen.getByRole("button", { name: /원두/ })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "전체 선택" }));
    for (const name of [/원두/, /우유/, /소금/]) {
      expect(screen.getByRole("button", { name })).toHaveAttribute("aria-pressed", "true");
    }
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => expect(del).toHaveBeenCalledTimes(3));
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(expect.stringContaining("2개를 삭제했어요. 1개는")),
    );
    // 끝나면 보통 줄로 돌아온다
    expect(await screen.findByRole("button", { name: /재료 추가/ })).toBeInTheDocument();
  });

  it("고르기를 취소하면 아무것도 지우지 않는다", async () => {
    const del = vi.spyOn(inventoryApi, "deleteInventoryItem").mockResolvedValue();
    renderPage();
    await screen.findByRole("button", { name: /원두/ });
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    fireEvent.click(screen.getByRole("button", { name: /원두/ }));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(screen.getByRole("button", { name: /재료 추가/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /원두/ })).not.toHaveAttribute("aria-pressed");
    expect(del).not.toHaveBeenCalled();
  });

  it("검색을 바꿔 가며 골라 모으고, 전체 선택·선택 해제는 보이는 재료에만 적용한다", async () => {
    const milk = { ...bean, item_id: "milk", name: "우유" };
    const salt = { ...bean, item_id: "salt", name: "소금" };
    vi.spyOn(inventoryApi, "listInventory").mockResolvedValue([bean, milk, salt]);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const del = vi.spyOn(inventoryApi, "deleteInventoryItem").mockResolvedValue();
    renderPage();
    await screen.findByRole("button", { name: /원두/ });
    const search = screen.getByPlaceholderText("재료 검색");

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    fireEvent.change(search, { target: { value: "원두" } });
    fireEvent.click(screen.getByRole("button", { name: /원두/ }));
    // 다른 검색에서 전체 선택해도 앞서 고른 원두는 남는다
    fireEvent.change(search, { target: { value: "우유" } });
    fireEvent.click(screen.getByRole("button", { name: "전체 선택" }));
    fireEvent.change(search, { target: { value: "소금" } });
    fireEvent.click(screen.getByRole("button", { name: "전체 선택" }));
    // 선택 해제는 보이는 소금만 푼다
    fireEvent.click(screen.getByRole("button", { name: "선택 해제" }));
    fireEvent.change(search, { target: { value: "" } });
    expect(screen.getByRole("button", { name: /원두/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /우유/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /소금/ })).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(del).toHaveBeenCalledTimes(2));
    expect(del).not.toHaveBeenCalledWith("salt");
  });

  it("입고 대기 카드는 확정 수량·오늘이 채워져 있고, 입고 처리·입고 안 함을 보낸다", async () => {
    vi.spyOn(inventoryApi, "listLots").mockResolvedValue(lotList([pendingOrder]));
    const receive = vi.spyOn(ordersApi, "receiveOrderItem").mockResolvedValue(lot);
    const skip = vi.spyOn(ordersApi, "skipOrderItem").mockResolvedValue();
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /원두/ }));

    const card = (await screen.findByText(/10월 16일 확정 발주/)).closest("form") as HTMLElement;
    const today = new Date().toLocaleDateString("sv-SE");
    expect(within(card).getByLabelText(/입고 수량/)).toHaveValue(3000);
    expect(within(card).getByLabelText(/입고일/)).toHaveValue(today);
    expect(within(card).getByLabelText(/소비기한/)).toHaveValue("");
    expect(within(card).getByLabelText(/구매 금액/)).toHaveValue(null); // 단가 미설정 → 빈칸

    fireEvent.change(within(card).getByLabelText(/구매 금액/), { target: { value: "48000" } });
    fireEvent.click(within(card).getByRole("button", { name: "입고 처리" }));
    await waitFor(() => expect(receive).toHaveBeenCalledTimes(1));
    expect(receive).toHaveBeenCalledWith("oi-1", {
      quantity: 3000,
      received_at: today,
      expiry_date: null,
      purchase_price: 48000,
    });

    fireEvent.click(within(card).getByRole("button", { name: "입고 안 함" }));
    await waitFor(() => expect(skip).toHaveBeenCalledWith("oi-1"));
  });
});
