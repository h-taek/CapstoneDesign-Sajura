// B4 판매 데이터 단위 및 통합 시험 (04_fe.md §4.7, 10_v2_front.md §2).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SaleListItem, TrendPoint } from "../api/endpoints/sales";
import * as salesApi from "../api/endpoints/sales";
import {
  aggregateDaySales,
  buildContinuousDailySales,
  formatDayDisplay,
  formatSaleTime,
  getDaysDiffInclusive,
  isRangeExceeded,
} from "../components/sales/calculations";
import SalesPage from "../routes/sales/index";

describe("B4 판매 데이터 순수 계산 로직 (calculations.ts)", () => {
  it("판매 없는 날 0 채우기 (buildContinuousDailySales): 구간 내 빈 날짜도 0으로 채우고 최신순 정렬한다", () => {
    const trends: TrendPoint[] = [
      { date: "2026-10-13", quantity: 83, revenue: 1120000 },
      { date: "2026-10-15", quantity: 92, revenue: 1240000 },
      { date: "2026-10-19", quantity: 95, revenue: 1284000 },
    ];

    const result = buildContinuousDailySales("2026-10-13", "2026-10-19", trends);

    expect(result).toHaveLength(7);
    expect(result[0]?.date).toBe("2026-10-19");
    expect(result[0]?.quantity).toBe(95);
    expect(result[0]?.revenue).toBe(1284000);

    // 10월 14일은 비어있었으므로 0으로 채워짐
    const day14 = result.find((d) => d.date === "2026-10-14");
    expect(day14).toBeDefined();
    expect(day14?.quantity).toBe(0);
    expect(day14?.revenue).toBe(0);

    // 10월 13일이 마지막
    expect(result[6]?.date).toBe("2026-10-13");
    expect(result[6]?.quantity).toBe(83);
  });

  it("1년 초과 검사 (isRangeExceeded, getDaysDiffInclusive): 366일까지 허용하고 367일부터 초과로 판단한다", () => {
    expect(getDaysDiffInclusive("2026-10-13", "2026-10-19")).toBe(7);
    expect(isRangeExceeded("2026-10-13", "2026-10-19")).toBe(false);

    // 윤년 포함 366일
    expect(isRangeExceeded("2026-01-01", "2027-01-01")).toBe(false);
    expect(getDaysDiffInclusive("2026-01-01", "2027-01-01")).toBe(366);

    // 367일 (1년 초과)
    expect(isRangeExceeded("2026-01-01", "2027-01-02")).toBe(true);
    expect(getDaysDiffInclusive("2026-01-01", "2027-01-02")).toBe(367);
  });

  it("하루 묶기 (aggregateDaySales): 시간대별 매출과 메뉴별 판매 수량/매출을 집계한다", () => {
    const mockSales: SaleListItem[] = [
      {
        sale_id: "s1",
        menu_id: "m-shrimp",
        menu_name: "불새우 루꼴라 화덕피자",
        quantity: 2,
        total_price: 38000,
        sold_at: "2026-10-19T20:58:00",
      },
      {
        sale_id: "s2",
        menu_id: "m-highball",
        menu_name: "레몬 하이볼",
        quantity: 1,
        total_price: 7000,
        sold_at: "2026-10-19T20:02:00",
      },
      {
        sale_id: "s3",
        menu_id: "m-shrimp",
        menu_name: "불새우 루꼴라 화덕피자",
        quantity: 1,
        total_price: 19000,
        sold_at: "2026-10-19T13:05:00",
      },
    ];

    const agg = aggregateDaySales(mockSales);

    expect(agg.totalQuantity).toBe(4);
    expect(agg.totalRevenue).toBe(64000);

    // 메뉴별 집계: 수량 많은 순 (피자 3개 > 하이볼 1개)
    expect(agg.menuItems).toHaveLength(2);
    expect(agg.menuItems[0]?.menu_id).toBe("m-shrimp");
    expect(agg.menuItems[0]?.quantity).toBe(3);
    expect(agg.menuItems[0]?.revenue).toBe(57000);
    expect(agg.menuItems[1]?.menu_id).toBe("m-highball");
    expect(agg.menuItems[1]?.quantity).toBe(1);

    // 시간대별 매출 (13시: 19000, 20시: 45000)
    const h13 = agg.hourly.find((h) => h.hour === 13);
    const h20 = agg.hourly.find((h) => h.hour === 20);
    expect(h13?.revenue).toBe(19000);
    expect(h20?.revenue).toBe(45000);

    // 최신순 정렬 확인
    expect(agg.allSales[0]?.sale_id).toBe("s1");
    expect(agg.allSales[1]?.sale_id).toBe("s2");
    expect(agg.allSales[2]?.sale_id).toBe("s3");
  });

  it("날짜 및 시간 포맷팅 헬퍼", () => {
    const formatted = formatDayDisplay("2026-10-19");
    expect(formatted.dayLabel).toBe("10월 19일 (월)");
    expect(formatted.shortDate).toBe("10월 19일");
    expect(formatted.dayOfWeek).toBe("(월)");

    expect(formatSaleTime("2026-10-19T21:52:00")).toBe("21:52");
    expect(formatSaleTime("2026-10-19 13:05:00")).toBe("13:05");
  });
});

describe("B4 판매 데이터 화면 (SalesPage)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    vi.spyOn(salesApi, "getSalesSummary").mockResolvedValue({
      total_revenue: 9534000,
      total_sales_count: 706,
      this_month_revenue: 9534000,
      this_month_sales_count: 706,
      today_revenue: 1284000,
      today_sales_count: 95,
      first_sale_at: "2026-08-01T11:00:00",
      last_sale_at: "2026-10-19T22:41:00",
    });

    vi.spyOn(salesApi, "getSalesTrends").mockResolvedValue({
      menu_id: null,
      menu_name: null,
      group_by: "day",
      data: [
        { date: "2026-10-13", quantity: 83, revenue: 1120000 },
        { date: "2026-10-14", quantity: 73, revenue: 980000 },
        { date: "2026-10-15", quantity: 92, revenue: 1240000 },
        { date: "2026-10-16", quantity: 97, revenue: 1310000 },
        { date: "2026-10-17", quantity: 124, revenue: 1680000 },
        { date: "2026-10-18", quantity: 142, revenue: 1920000 },
        { date: "2026-10-19", quantity: 95, revenue: 1284000 },
      ],
    });

    vi.spyOn(salesApi, "listSales").mockResolvedValue({
      items: [
        {
          sale_id: "sale-1",
          menu_id: "m-shrimp",
          menu_name: "불새우 루꼴라 화덕피자",
          quantity: 2,
          total_price: 38000,
          sold_at: "2026-10-19T20:58:00",
        },
        {
          sale_id: "sale-2",
          menu_id: "m-highball",
          menu_name: "레몬 하이볼",
          quantity: 1,
          total_price: 7000,
          sold_at: "2026-10-19T20:02:00",
        },
      ],
      total: 2,
      total_revenue: 45000,
      page: 1,
      size: 100,
      total_pages: 1,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderPage() {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/sales"]}>
          <SalesPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it("기간 합계와 날짜별 표를 렌더링한다", async () => {
    renderPage();

    // 기간 합계 (706개 · 9,534,000원)
    expect(await screen.findByText(/706개/)).toBeInTheDocument();
    expect(screen.getByText(/9,534,000원/)).toBeInTheDocument();

    // 표 헤더 및 날짜 행
    expect(screen.getByText("판매 수량")).toBeInTheDocument();
    expect(screen.getByText(/10월 19일/)).toBeInTheDocument();
    expect(screen.getByText(/1,284,000원/)).toBeInTheDocument();
  });

  it("날짜를 누르면 날짜 판이 열리고 시간대별 및 메뉴별 목록을 표시한다", async () => {
    renderPage();

    const row19 = await screen.findByRole("button", { name: /10월 19일/ });
    fireEvent.click(row19);

    // 날짜 판 열림
    const dayAside = await screen.findByRole("complementary", { name: "10월 19일 (월)" });
    expect(dayAside).toBeInTheDocument();
    expect(screen.getByText("시간대별 매출")).toBeInTheDocument();
    expect(screen.getByText("메뉴별 판매")).toBeInTheDocument();
    expect(await within(dayAside).findByText("불새우 루꼴라 화덕피자")).toBeInTheDocument();
  });

  it("하루 판매가 한 쪽(100건)을 넘으면 마지막 쪽까지 받아 묶는다", async () => {
    const sale = (id: string, menu: string, name: string) => ({
      sale_id: id,
      menu_id: menu,
      menu_name: name,
      quantity: 1,
      total_price: 7000,
      sold_at: "2026-10-19T12:00:00",
    });
    const spy = vi.spyOn(salesApi, "listSales").mockImplementation(async ({ page = 1 }) => ({
      items: [page === 1 ? sale("s-1", "m-1", "첫 쪽 메뉴") : sale("s-2", "m-2", "둘째 쪽 메뉴")],
      total: 101,
      total_revenue: 14000,
      page,
      size: 100,
      total_pages: 2,
    }));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /10월 19일/ }));
    const dayAside = await screen.findByRole("complementary", { name: "10월 19일 (월)" });
    expect(await within(dayAside).findByText("둘째 쪽 메뉴")).toBeInTheDocument();
    expect(within(dayAside).getByText("첫 쪽 메뉴")).toBeInTheDocument();
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
  });

  it("날짜 판에서 메뉴를 누르면 메뉴 판이 열린다", async () => {
    renderPage();

    // 10월 19일 클릭
    const row19 = await screen.findByRole("button", { name: /10월 19일/ });
    fireEvent.click(row19);

    const dayAside = await screen.findByRole("complementary", { name: "10월 19일 (월)" });
    const pizzaBtn = await within(dayAside).findByRole("button", {
      name: /불새우 루꼴라 화덕피자/,
    });
    fireEvent.click(pizzaBtn);

    // 메뉴 판 확인
    const menuAside = await screen.findByRole("complementary", {
      name: "10월 19일 불새우 루꼴라 화덕피자",
    });
    expect(menuAside).toBeInTheDocument();
    expect(screen.getByText("판매 기록")).toBeInTheDocument();
    expect(screen.getByText("20:58")).toBeInTheDocument();
  });

  it("날짜 판에서 '전체 판매 기록'을 누르면 전체 기록 판이 열린다", async () => {
    renderPage();

    // 10월 19일 클릭
    const row19 = await screen.findByRole("button", { name: /10월 19일/ });
    fireEvent.click(row19);

    // 전체 판매 기록 클릭
    const allBtn = await screen.findByRole("button", { name: /전체 판매 기록/ });
    fireEvent.click(allBtn);

    // 전체 기록 판 확인
    const allAside = await screen.findByRole("complementary", {
      name: "10월 19일 판매 기록",
    });
    expect(allAside).toBeInTheDocument();
    expect(within(allAside).getByText("레몬 하이볼")).toBeInTheDocument();
  });

  it("1년 초과 시 경고 문구를 표시한다", async () => {
    renderPage();

    await screen.findByText(/706개/);

    // 종료일 입력값을 1년 초과(2027-10-20)로 변경
    const dateInputs = screen.getAllByLabelText(/종료일/);
    const nativeDateInput = dateInputs.find((el) => el.tagName === "INPUT");
    if (nativeDateInput) {
      fireEvent.change(nativeDateInput, { target: { value: "2027-10-20" } });
    }

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("기간은 1년까지 고를 수 있어요");
    });
  });
});
