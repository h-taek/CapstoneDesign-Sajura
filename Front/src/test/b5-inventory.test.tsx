// B5 재고 관리 종합 테스트 (04_fe.md §4.6, 09_inventory.html).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InventoryItem, PriceTrendResponse } from "../api/endpoints/inventory";
import * as inventoryApi from "../api/endpoints/inventory";
import InventoryPage from "../routes/inventory";
import { usePreferencesStore } from "../stores/preferences-store";

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/inventory"]}>
        <InventoryPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function makeItem(id: string, name: string, patch: Partial<InventoryItem> = {}): InventoryItem {
  return {
    item_id: id,
    name,
    unit: "g",
    total_quantity: 1000,
    nearest_expiry_date: "2026-11-20",
    needs_check: false,
    low_stock_threshold: 100,
    lead_time_days: null,
    safety_stock: null,
    coupang_product: null,
    unit_price: 15,
    created_at: "2026-01-01T00:00:00",
    updated_at: "2026-01-01T00:00:00",
    ...patch,
  };
}

describe("B5 재고 관리 종합 테스트", () => {
  beforeEach(() => {
    usePreferencesStore.setState({ inventorySortOption: "EXPIRY_ASC" });
    vi.spyOn(inventoryApi, "listLots").mockResolvedValue({
      item_id: "test",
      item_name: "테스트",
      lots: [],
      pending_orders: [],
    });
    vi.spyOn(inventoryApi, "getPriceTrends").mockResolvedValue({
      start_date: "2026-09-20",
      end_date: "2026-10-20",
      items: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("재고가 아예 없으면 '등록된 재료가 없어요' 빈 화면이 나온다", async () => {
    vi.spyOn(inventoryApi, "listInventory").mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("등록된 재료가 없어요")).toBeInTheDocument();
    expect(screen.getByText("'재료 추가'로 시작하세요.")).toBeInTheDocument();
  });

  it("25개 초과 시 페이지네이션(쪽 이동)이 동작한다", async () => {
    // 30개 아이템 생성 (아이템 01 ~ 아이템 30)
    const items: InventoryItem[] = Array.from({ length: 30 }, (_, i) => {
      const idx = String(i + 1).padStart(2, "0");
      return makeItem(`item-${idx}`, `아이템 ${idx}`);
    });
    vi.spyOn(inventoryApi, "listInventory").mockResolvedValue(items);

    renderPage();

    // 1쪽에 첫 번째 아이템 표시, 26번째 아이템은 아직 없음
    expect(await screen.findByText("아이템 01")).toBeInTheDocument();
    expect(screen.getByText("아이템 25")).toBeInTheDocument();
    expect(screen.queryByText("아이템 26")).not.toBeInTheDocument();

    // 쪽 이동 버튼들 확인
    const nextBtn = screen.getByRole("button", { name: "다음 쪽" });
    expect(nextBtn).toBeEnabled();
    const prevBtn = screen.getByRole("button", { name: "이전 쪽" });
    expect(prevBtn).toBeDisabled();

    // 2쪽으로 이동
    const page2Btn = screen.getByRole("button", { name: "2" });
    fireEvent.click(page2Btn);

    // 2쪽에 26~30번 아이템 표시
    expect(await screen.findByText("아이템 26")).toBeInTheDocument();
    expect(screen.getByText("아이템 30")).toBeInTheDocument();
    expect(screen.queryByText("아이템 01")).not.toBeInTheDocument();
    expect(nextBtn).toBeDisabled();
    expect(prevBtn).toBeEnabled();
  });

  it("검색 시 띄어쓰기를 무시하고 검색 결과를 표시하며, 쪽 번호가 1로 돌아간다", async () => {
    const items: InventoryItem[] = Array.from({ length: 30 }, (_, i) => {
      const idx = String(i + 1).padStart(2, "0");
      return makeItem(`item-${idx}`, i === 29 ? "하하 우유" : `아이템 ${idx}`);
    });
    vi.spyOn(inventoryApi, "listInventory").mockResolvedValue(items);

    renderPage();
    await screen.findByText("아이템 01");

    // 2쪽으로 이동
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(await screen.findByText("하하 우유")).toBeInTheDocument();

    // 검색어 입력: "하하우유" (공백 없음)
    const searchInput = screen.getByPlaceholderText("재료 검색");
    fireEvent.change(searchInput, { target: { value: "하하우유" } });

    // 검색 결과로 "하하 우유"만 남고 1쪽으로 리셋
    expect(await screen.findByText("하하 우유")).toBeInTheDocument();
    expect(screen.queryByText("아이템 01")).not.toBeInTheDocument();

    // 검색 결과가 없는 검색어 입력
    fireEvent.change(searchInput, { target: { value: "없는재료" } });
    expect(await screen.findByText("'없는재료'가 들어간 재료가 없어요")).toBeInTheDocument();
  });

  it("보기 탭 전환: '확인 필요' 탭에서는 경고 상태인 재료만 노출된다", async () => {
    const items: InventoryItem[] = [
      makeItem("1", "정상 원두", { total_quantity: 5000, low_stock_threshold: 100 }),
      makeItem("2", "부족 우유", { total_quantity: 50, low_stock_threshold: 100 }),
      makeItem("3", "체크 설탕", { needs_check: true }),
    ];
    vi.spyOn(inventoryApi, "listInventory").mockResolvedValue(items);

    renderPage();
    expect(await screen.findByText("전체 3")).toBeInTheDocument();
    expect(screen.getByText("확인 필요 2")).toBeInTheDocument();
    expect(screen.getByText("정상 원두")).toBeInTheDocument();

    // '확인 필요' 탭 클릭
    fireEvent.click(screen.getByRole("tab", { name: "확인 필요 2" }));

    expect(screen.getByText("부족 우유")).toBeInTheDocument();
    expect(screen.getByText("체크 설탕")).toBeInTheDocument();
    expect(screen.queryByText("정상 원두")).not.toBeInTheDocument();
  });

  it("정렬 옵션 변경 시 store에 저장되고 카드 순서가 바뀐다", async () => {
    const items: InventoryItem[] = [
      makeItem("1", "나 원두", { total_quantity: 500 }),
      makeItem("2", "가 설탕", { total_quantity: 100 }),
      makeItem("3", "다 우유", { total_quantity: 300 }),
    ];
    vi.spyOn(inventoryApi, "listInventory").mockResolvedValue(items);

    renderPage();
    await screen.findByText("가 설탕");

    const sortSelect = screen.getByLabelText("재고 정렬");
    // 수량 많은순 선택
    fireEvent.change(sortSelect, { target: { value: "QUANTITY_DESC" } });

    expect(usePreferencesStore.getState().inventorySortOption).toBe("QUANTITY_DESC");

    const buttons = screen.getAllByRole("button", { name: /원두|설탕|우유/ });
    expect(buttons[0]).toHaveTextContent("나 원두");
    expect(buttons[1]).toHaveTextContent("다 우유");
    expect(buttons[2]).toHaveTextContent("가 설탕");
  });

  it("쿠팡 상품 연결 정보 및 단가 추세와 단가 미설정 표시를 검증한다", async () => {
    const itemWithCoupang = makeItem("c1", "바닐라 시럽", {
      unit_price: null, // 단가 미설정
      coupang_product: {
        item_id: "c1",
        product_id: "p-1",
        product_name: "모닌 바닐라 시럽 1000ml",
        option_name: "1000ml 1개",
        sale_price: 18000,
        content_quantity: 1000,
        content_unit: "ml",
        unit_price: 18,
        updated_at: "2026-10-20T10:00:00",
      },
    });

    const priceTrends: PriceTrendResponse = {
      start_date: "2026-09-20",
      end_date: "2026-10-20",
      items: [
        {
          item_id: "c1",
          name: "바닐라 시럽",
          unit: "ml",
          points: [
            { date: "2026-09-20", unit_price: 20 },
            { date: "2026-10-20", unit_price: 18 },
          ],
        },
      ],
    };

    vi.spyOn(inventoryApi, "listInventory").mockResolvedValue([itemWithCoupang]);
    vi.spyOn(inventoryApi, "getPriceTrends").mockResolvedValue(priceTrends);

    renderPage();
    const card = await screen.findByRole("button", { name: /바닐라 시럽/ });
    fireEvent.click(card);

    // 상세 판 열림 확인
    expect(await screen.findByText("모닌 바닐라 시럽 1000ml")).toBeInTheDocument();
    expect(screen.getByText(/18,000원/)).toBeInTheDocument();
    // 30일 추세 하락률 (20 -> 18 => 10% 하락)
    expect(await screen.findByText("10%")).toBeInTheDocument();
    expect(screen.getByText("30일 전 대비")).toBeInTheDocument();

    // 단가 미설정 확인
    expect(screen.getByText("단가 미설정")).toBeInTheDocument();
  });
});
