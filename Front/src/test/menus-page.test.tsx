// 메뉴 관리 — 메뉴 칸과 레시피를 한 번에 저장, 메뉴 추가·삭제 (02_implementation_design.md §3.4).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as inventoryApi from "../api/endpoints/inventory";
import * as menusApi from "../api/endpoints/menus";
import MenusPage from "../routes/menus";

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/menus"]}>
        <MenusPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const pizza: menusApi.MenuListItem = {
  menu_id: "m-1",
  name: "마르게리타",
  category: "피자",
  price: 15900,
  is_active: true,
  use_inventory_deduction: true,
  has_recipe: true,
  is_deleted: false,
};

const dough: inventoryApi.InventoryItem = {
  item_id: "dough",
  name: "피자 도우",
  unit: "개",
  total_quantity: 10,
  nearest_expiry_date: null,
  needs_check: false,
  low_stock_threshold: 0,
  lead_time_days: null,
  safety_stock: null,
  created_at: "2026-10-01T00:00:00",
  updated_at: "2026-10-01T00:00:00",
};

describe("MenusPage", () => {
  beforeEach(() => {
    vi.spyOn(menusApi, "listMenus").mockResolvedValue({
      items: [pizza],
      total: 1,
      page: 1,
      size: 100,
      total_pages: 1,
    });
    vi.spyOn(menusApi, "getRecipe").mockResolvedValue({
      menu_id: "m-1",
      ingredients: [{ item_id: "dough", item_name: "피자 도우", quantity: 1, unit: "개" }],
      updated_at: "2026-10-01T00:00:00",
    });
    vi.spyOn(inventoryApi, "listInventory").mockResolvedValue([dough]);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("목록에 판매가를 보여 주고, 저장하면 메뉴 칸과 레시피를 함께 저장한다", async () => {
    const update = vi.spyOn(menusApi, "updateMenu").mockResolvedValue(pizza);
    const upsert = vi
      .spyOn(menusApi, "upsertRecipe")
      .mockResolvedValue({} as menusApi.RecipeResponse);
    renderPage();
    expect(await screen.findByText("15,900원")).toBeInTheDocument();
    const priceInput = await screen.findByLabelText(/판매가/);
    await waitFor(() => expect(screen.getByDisplayValue("1")).toBeInTheDocument()); // 레시피 행

    fireEvent.change(priceInput, { target: { value: "16500" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(upsert).toHaveBeenCalledTimes(1));
    expect(update).toHaveBeenCalledWith("m-1", {
      name: "마르게리타",
      price: 16500,
      category: "피자",
    });
    expect(upsert).toHaveBeenCalledWith("m-1", [{ item_id: "dough", quantity: 1, unit: "개" }]);
  });

  it("새 메뉴는 등록만 하고, 재료가 없으면 레시피를 만들지 않는다", async () => {
    const create = vi.spyOn(menusApi, "createMenu").mockResolvedValue({
      ...pizza,
      menu_id: "m-2",
      name: "제로콜라",
      has_recipe: false,
    });
    const upsert = vi.spyOn(menusApi, "upsertRecipe");
    renderPage();
    await screen.findByText("15,900원");

    fireEvent.click(screen.getByRole("button", { name: /메뉴 추가/ }));
    expect(screen.getByText("새 메뉴")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/메뉴명/), { target: { value: "제로콜라" } });
    fireEvent.change(screen.getByLabelText(/판매가/), { target: { value: "3000" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledWith({ name: "제로콜라", price: 3000, category: null });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("메뉴를 삭제한다", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const del = vi.spyOn(menusApi, "deleteMenu").mockResolvedValue();
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "메뉴 삭제" }));
    await waitFor(() => expect(del).toHaveBeenCalledWith("m-1"));
  });
});
