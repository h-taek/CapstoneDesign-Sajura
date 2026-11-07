// B2 홈 화면 및 계산 함수 Vitest — 04_fe.md §4.3, 10_v2_front.md §2.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import * as dashboardApi from "../api/endpoints/dashboard";
import * as forecastApi from "../api/endpoints/forecast";
import * as inventoryApi from "../api/endpoints/inventory";
import * as ordersApi from "../api/endpoints/orders";
import * as salesApi from "../api/endpoints/sales";
import {
  buildMenuShareSlices,
  selectAlertInventory,
  selectTopPriceTrends,
} from "../components/home/home-utils";
import { MenuShareDonut } from "../components/home/menu-share-donut";
import HomePage from "../routes/home";
import { useAuthStore } from "../stores/auth-store";

describe("B2 홈 순수 계산 함수 (home-utils)", () => {
  describe("selectTopPriceTrends", () => {
    it("유효한 단가 데이터가 2개 이상일 때 기간의 첫 날과 마지막 날로 변화율을 계산한다", () => {
      const items: inventoryApi.PriceTrendItem[] = [
        {
          item_id: "item-1",
          name: "루꼴라",
          unit: "kg",
          points: [
            { date: "2026-09-19", unit_price: 26000 },
            { date: "2026-09-25", unit_price: 27500 },
            { date: "2026-10-19", unit_price: 30000 },
          ],
        },
      ];

      const res = selectTopPriceTrends(items, 4);
      expect(res).toHaveLength(1);
      const first = res[0];
      expect(first?.name).toBe("루꼴라");
      expect(first?.currentPrice).toBe(30000);
      // ((30000 - 26000) / 26000) * 100 = 15.38…% → 소수 첫째 자리
      expect(first?.changeRate).toBe(15.4);
    });

    it("유효한 단가 날짜가 마지막 날 하나뿐이거나 없으면 제외한다", () => {
      const items: inventoryApi.PriceTrendItem[] = [
        {
          item_id: "single-point",
          name: "단일 날짜 재료",
          unit: "kg",
          points: [{ date: "2026-10-19", unit_price: 15000 }],
        },
        {
          item_id: "null-points",
          name: "단가 없는 재료",
          unit: "kg",
          points: [
            { date: "2026-09-19", unit_price: null },
            { date: "2026-10-19", unit_price: 20000 },
          ],
        },
      ];

      const res = selectTopPriceTrends(items, 4);
      expect(res).toHaveLength(0);
    });

    it("첫 유효 단가가 0 이하이면 0으로 나누기를 방지하기 위해 제외한다", () => {
      const items: inventoryApi.PriceTrendItem[] = [
        {
          item_id: "zero-start",
          name: "0원 시작 재료",
          unit: "kg",
          points: [
            { date: "2026-09-19", unit_price: 0 },
            { date: "2026-10-19", unit_price: 10000 },
          ],
        },
      ];

      const res = selectTopPriceTrends(items, 4);
      expect(res).toHaveLength(0);
    });

    it("변화율 절댓값이 큰 순으로 정렬하고 상위 N개만 반환한다", () => {
      const items: inventoryApi.PriceTrendItem[] = [
        {
          item_id: "1",
          name: "A품목 (5% 상승)",
          unit: "kg",
          points: [
            { date: "2026-09-19", unit_price: 10000 },
            { date: "2026-10-19", unit_price: 10500 },
          ],
        },
        {
          item_id: "2",
          name: "B품목 (20% 하락)",
          unit: "kg",
          points: [
            { date: "2026-09-19", unit_price: 10000 },
            { date: "2026-10-19", unit_price: 8000 },
          ],
        },
        {
          item_id: "3",
          name: "C품목 (15% 상승)",
          unit: "kg",
          points: [
            { date: "2026-09-19", unit_price: 10000 },
            { date: "2026-10-19", unit_price: 11500 },
          ],
        },
        {
          item_id: "4",
          name: "D품목 (0% 변동)",
          unit: "kg",
          points: [
            { date: "2026-09-19", unit_price: 10000 },
            { date: "2026-10-19", unit_price: 10000 },
          ],
        },
        {
          item_id: "5",
          name: "E품목 (10% 상승)",
          unit: "kg",
          points: [
            { date: "2026-09-19", unit_price: 10000 },
            { date: "2026-10-19", unit_price: 11000 },
          ],
        },
      ];

      const res = selectTopPriceTrends(items, 3);
      expect(res).toHaveLength(3);
      expect(res[0]?.name).toBe("B품목 (20% 하락)");
      expect(res[1]?.name).toBe("C품목 (15% 상승)");
      expect(res[2]?.name).toBe("E품목 (10% 상승)");
    });
  });

  describe("buildMenuShareSlices", () => {
    it("상위 5개 메뉴와 나머지를 '그 외'로 묶어 비중을 계산한다", () => {
      const forecast = [
        { menu_id: "1", menu_name: "메뉴1", expected_quantity: 30 },
        { menu_id: "2", menu_name: "메뉴2", expected_quantity: 25 },
        { menu_id: "3", menu_name: "메뉴3", expected_quantity: 20 },
        { menu_id: "4", menu_name: "메뉴4", expected_quantity: 15 },
        { menu_id: "5", menu_name: "메뉴5", expected_quantity: 10 },
        { menu_id: "6", menu_name: "메뉴6", expected_quantity: 5 },
        { menu_id: "7", menu_name: "메뉴7", expected_quantity: 5 },
      ];

      const { slices, totalQty } = buildMenuShareSlices(forecast);
      expect(totalQty).toBe(110);
      expect(slices).toHaveLength(6);
      expect(slices[0]?.name).toBe("메뉴1");
      expect(slices[5]?.name).toBe("그 외");
      expect(slices[5]?.isOther).toBe(true);
      expect(slices[5]?.quantity).toBe(10);
    });

    it("메뉴가 비어 있으면 빈 조각을 반환한다", () => {
      const { slices, totalQty } = buildMenuShareSlices([]);
      expect(slices).toHaveLength(0);
      expect(totalQty).toBe(0);
    });
  });

  describe("selectAlertInventory", () => {
    it("확인 필요(소비기한 임박/경과 또는 안전재고 이하) 항목만 거르고 소비기한 순으로 정렬한다", () => {
      const today = new Date(2026, 9, 20); // 2026-10-20
      const items: inventoryApi.InventoryItem[] = [
        {
          item_id: "1",
          name: "안전 재료",
          unit: "kg",
          total_quantity: 100,
          low_stock_threshold: 10,
          nearest_expiry_date: "2026-11-20",
          needs_check: false,
          lead_time_days: null,
          safety_stock: null,
          created_at: "",
          updated_at: "",
          coupang_product: null,
          unit_price: null,
        },
        {
          item_id: "2",
          name: "소비기한 임박 재료",
          unit: "kg",
          total_quantity: 50,
          low_stock_threshold: 10,
          nearest_expiry_date: "2026-10-22", // D-2 (경고)
          needs_check: false,
          lead_time_days: null,
          safety_stock: null,
          created_at: "",
          updated_at: "",
          coupang_product: null,
          unit_price: null,
        },
        {
          item_id: "3",
          name: "재고 부족 재료",
          unit: "kg",
          total_quantity: 5,
          low_stock_threshold: 10,
          nearest_expiry_date: null,
          needs_check: false,
          lead_time_days: null,
          safety_stock: null,
          created_at: "",
          updated_at: "",
          coupang_product: null,
          unit_price: null,
        },
      ];

      const res = selectAlertInventory(items, today);
      expect(res).toHaveLength(2);
      expect(res[0]?.name).toBe("소비기한 임박 재료");
      expect(res[1]?.name).toBe("재고 부족 재료");
    });
  });
});

describe("MenuShareDonut 빈 상태 문구", () => {
  it("예측은 받았는데 메뉴별 수량만 비면 실패가 아니라 '아직 없어요'로 안내한다", () => {
    const { unmount } = render(<MenuShareDonut hasSalesData menuForecast={[]} />);
    expect(screen.getByText("메뉴별 예측이 아직 없어요")).toBeInTheDocument();
    expect(screen.queryByText("오늘 예측을 불러오지 못했어요")).not.toBeInTheDocument();
    unmount();

    // 예측 자체가 없으면(조회 실패) 기존 실패 문구
    render(<MenuShareDonut hasSalesData menuForecast={undefined} />);
    expect(screen.getByText("오늘 예측을 불러오지 못했어요")).toBeInTheDocument();
  });
});

describe("HomePage 컴포넌트", () => {
  function renderHome() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/"]}>
          <HomePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().setUser({
      user_id: "u1",
      email: "owner@test.com",
      name: "김사주",
      auth_provider: "LOCAL",
      role: "OWNER",
      store_name: "사주라 피자",
      business_no: "123-45-67890",
      business_status: "VERIFIED",
      onboarding_completed: true,
      created_at: "",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("기본 상태: 판매 및 예측 데이터가 있으면 머리글 KPI와 차트, 도넛이 렌더링된다", async () => {
    vi.spyOn(salesApi, "getSalesSummary").mockResolvedValue({
      total_revenue: 100000000,
      total_sales_count: 500,
      first_sale_at: "2026-08-01T11:00:00",
      last_sale_at: "2026-10-19T21:00:00",
      today_revenue: 1284000,
      today_sales_count: 68,
      this_month_revenue: 22920000,
      this_month_sales_count: 850,
    });

    vi.spyOn(dashboardApi, "getForecastVsActual").mockResolvedValue({
      start_date: "2026-10-13",
      end_date: "2026-10-19",
      data: [
        {
          date: "2026-10-13",
          actual_sales: 1120000,
          predicted_sales: 1100000,
          interval_p10: null,
          interval_p90: null,
          horizon_days: null,
        },
        {
          date: "2026-10-19",
          actual_sales: 1284000,
          predicted_sales: 1210000,
          interval_p10: null,
          interval_p90: null,
          horizon_days: null,
        },
      ],
    });

    vi.spyOn(forecastApi, "getForecastPredict").mockResolvedValue({
      predictions: [
        {
          target_date: "2026-10-20",
          predicted_sales: 1080000,
          horizon_days: 1,
          interval_p10: 950000,
          interval_p90: 1200000,
          is_low_confidence: false,
          low_confidence_reason: null,
          menu_forecast: [{ menu_id: "m1", menu_name: "화덕피자", expected_quantity: 40 }],
          explanation: {
            baseline: "1360000",
            deviation_vs_baseline: -0.21,
            top_factors: [],
            sentence: "평소보다 낮을 것으로 예상",
          },
        },
        {
          target_date: "2026-10-21",
          predicted_sales: 1140000,
          horizon_days: 2,
          interval_p10: 1000000,
          interval_p90: 1250000,
          is_low_confidence: false,
          low_confidence_reason: null,
          menu_forecast: [],
          explanation: {
            baseline: "1360000",
            deviation_vs_baseline: 0,
            top_factors: [],
            sentence: "",
          },
        },
      ],
    });

    vi.spyOn(salesApi, "getSalesTrends").mockResolvedValue({
      menu_id: null,
      menu_name: null,
      group_by: "month",
      data: [{ date: "2026-09-01", quantity: 1000, revenue: 31900000 }],
    });

    vi.spyOn(inventoryApi, "getPriceTrends").mockResolvedValue({
      start_date: "2026-09-19",
      end_date: "2026-10-19",
      items: [
        {
          item_id: "p1",
          name: "루꼴라",
          unit: "kg",
          points: [
            { date: "2026-09-19", unit_price: 26000 },
            { date: "2026-10-19", unit_price: 30000 },
          ],
        },
      ],
    });

    vi.spyOn(ordersApi, "listOrders").mockResolvedValue({
      items: [
        {
          order_id: "ord-1",
          approved_at: "2026-10-16T10:00:00",
          total_estimated_cost: 103000,
          item_count: 3,
        },
      ],
      total: 1,
      page: 1,
      size: 4,
      total_pages: 1,
    });

    vi.spyOn(ordersApi, "getOrder").mockResolvedValue({
      order_id: "ord-1",
      approved_at: "2026-10-16T10:00:00",
      total_estimated_cost: 103000,
      note: null,
      items: [
        {
          order_item_id: "oi-1",
          item_id: "i-1",
          item_name: "모짜렐라 치즈",
          final_quantity: 2,
          unit: "kg",
          unit_price: 16000,
          subtotal: 32000,
          receipt_status: "PENDING",
          coupang_product: null,
        },
        {
          order_item_id: "oi-2",
          item_id: "i-2",
          item_name: "피자 도우",
          final_quantity: 1,
          unit: "kg",
          unit_price: 20000,
          subtotal: 20000,
          receipt_status: "PENDING",
          coupang_product: null,
        },
      ],
    });

    vi.spyOn(inventoryApi, "listInventory").mockResolvedValue([]);

    renderHome();

    // 사용자 이름 확인
    expect(await screen.findByText(/김사주 사장님/)).toBeInTheDocument();

    // 어제 매출 KPI: 128만원, 판매 68건
    expect(await screen.findByText("128만원")).toBeInTheDocument();
    expect(screen.getByText(/어제\(10월 19일\) 매출 · 판매 68건/)).toBeInTheDocument();

    // 내일 예상 KPI: 114만원
    expect(await screen.findByText("114만원")).toBeInTheDocument();

    // 예측 정확도: 94%, 어제 예측 121만원
    expect(await screen.findByText("94%")).toBeInTheDocument();
    expect(screen.getByText(/예측 정확도 · 어제 예측 121만원/)).toBeInTheDocument();

    // 오늘 예상 매출 섹션
    expect(await screen.findByText("108만원")).toBeInTheDocument();
    expect(screen.getByText(/평소보다/)).toBeInTheDocument();
    expect(screen.getByText(/21%/)).toBeInTheDocument();
    expect(screen.getByText(/낮을 것으로 예상/)).toBeInTheDocument();

    // 지난달 매출까지
    expect(screen.getByText("지난달 매출까지")).toBeInTheDocument();
    expect(await screen.findByText("72%")).toBeInTheDocument();

    // 오늘 많이 나갈 메뉴
    expect(screen.getByText("오늘 많이 나갈 메뉴")).toBeInTheDocument();
    expect(await screen.findByText("화덕피자")).toBeInTheDocument();

    // 쿠팡 단가 추세
    expect(screen.getByText("쿠팡 단가 추세")).toBeInTheDocument();
    expect(await screen.findByText("루꼴라")).toBeInTheDocument();

    // 최근 발주
    expect(screen.getByText("최근 발주")).toBeInTheDocument();
    expect(await screen.findByText("모짜렐라 치즈 외 2개")).toBeInTheDocument();
    expect(screen.getByText("입고 대기")).toBeInTheDocument();
  });

  it("예측 없음 / 실패 상태 (aifail): 예측에 기대는 칸만 비우고 안내와 다시 불러오기를 둔다", async () => {
    vi.spyOn(salesApi, "getSalesSummary").mockResolvedValue({
      total_revenue: 100000000,
      total_sales_count: 500,
      first_sale_at: "2026-08-01T11:00:00",
      last_sale_at: "2026-10-19T21:00:00",
      today_revenue: 1284000,
      today_sales_count: 68,
      this_month_revenue: 22920000,
      this_month_sales_count: 850,
    });

    vi.spyOn(dashboardApi, "getForecastVsActual").mockResolvedValue({
      start_date: "2026-10-13",
      end_date: "2026-10-19",
      data: [],
    });

    // 예측 빈 목록 (실패 혹은 미생성)
    vi.spyOn(forecastApi, "getForecastPredict").mockResolvedValue({
      predictions: [],
    });

    vi.spyOn(salesApi, "getSalesTrends").mockResolvedValue({
      menu_id: null,
      menu_name: null,
      group_by: "month",
      data: [],
    });

    vi.spyOn(inventoryApi, "getPriceTrends").mockResolvedValue({
      start_date: "2026-09-19",
      end_date: "2026-10-19",
      items: [],
    });

    vi.spyOn(ordersApi, "listOrders").mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      size: 4,
      total_pages: 0,
    });

    vi.spyOn(inventoryApi, "listInventory").mockResolvedValue([]);

    renderHome();

    // 내일 예상 칸 비움: "—", "내일 예상 · 불러오지 못했어요"
    expect(await screen.findByText("내일 예상 · 불러오지 못했어요")).toBeInTheDocument();

    // 오늘 예상 매출 및 메뉴 도넛 자리에 안내 문구
    const failTexts = await screen.findAllByText("오늘 예측을 불러오지 못했어요");
    expect(failTexts).toHaveLength(2);
    expect(screen.getByRole("button", { name: "다시 불러오기" })).toBeInTheDocument();

    // 어제 매출은 그대로 표시
    expect(screen.getByText("128만원")).toBeInTheDocument();
  });

  it("매출 데이터 없음 상태 (empty): 머리글 0원 및 첫 매출 올리기 안내가 표시된다", async () => {
    vi.spyOn(salesApi, "getSalesSummary").mockResolvedValue({
      total_revenue: 0,
      total_sales_count: 0,
      first_sale_at: null,
      last_sale_at: null,
      today_revenue: 0,
      today_sales_count: 0,
      this_month_revenue: 0,
      this_month_sales_count: 0,
    });

    vi.spyOn(inventoryApi, "getPriceTrends").mockResolvedValue({
      start_date: "2026-09-19",
      end_date: "2026-10-19",
      items: [],
    });

    vi.spyOn(ordersApi, "listOrders").mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      size: 4,
      total_pages: 0,
    });

    vi.spyOn(inventoryApi, "listInventory").mockResolvedValue([]);

    renderHome();

    // 머리글 KPI 비어 있음
    expect(await screen.findByText("0원")).toBeInTheDocument();
    expect(screen.getByText("어제 매출")).toBeInTheDocument();
    expect(screen.getByText("내일 예상 · 예측 전")).toBeInTheDocument();
    expect(screen.getByText("예측 정확도 · 예측 전")).toBeInTheDocument();

    // 오늘 예상 매출 자리에 첫 매출 안내 및 업로드 링크
    expect(screen.getByText("첫 매출을 올려 주세요")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /매출 올리기/ })).toHaveAttribute(
      "href",
      "/settings/pos/upload",
    );
    expect(screen.getByText("매출을 올리면 그려져요")).toBeInTheDocument();

    // 지난달 매출 안내
    expect(screen.getByText("매출을 올리면 지난달과 견줘 보여 드려요")).toBeInTheDocument();

    // 많이 나갈 메뉴 안내
    expect(screen.getByText("예측이 나오면 보여 드려요")).toBeInTheDocument();

    // 쿠팡 단가 추세 안내
    expect(screen.getByText("쿠팡 단가 추세")).toBeInTheDocument();
    expect(screen.getByText("쿠팡 담기를 하면 재료 단가가 쌓여요")).toBeInTheDocument();

    // 최근 발주 빈 상태
    expect(screen.getByText("아직 확정한 발주가 없어요")).toBeInTheDocument();
  });

  it("판매 요약 조회가 실패하면 위에 실패 안내와 다시 시도를 띄운다", async () => {
    vi.spyOn(salesApi, "getSalesSummary").mockRejectedValue(new Error("down"));
    vi.spyOn(inventoryApi, "getPriceTrends").mockResolvedValue({
      start_date: "2026-09-19",
      end_date: "2026-10-19",
      items: [],
    });
    vi.spyOn(ordersApi, "listOrders").mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      size: 4,
      total_pages: 0,
    });
    vi.spyOn(inventoryApi, "listInventory").mockResolvedValue([]);

    renderHome();

    expect(await screen.findByText("불러오지 못했어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
    // 판매가 있는지 모르므로 신규 매장 안내('0원'·'첫 매출')를 띄우지 않는다
    expect(screen.queryByText("0원")).not.toBeInTheDocument();
    expect(screen.queryByText("첫 매출을 올려 주세요")).not.toBeInTheDocument();
    expect(screen.queryByText("내일 예상 · 예측 전")).not.toBeInTheDocument();
    expect(screen.getByText("쿠팡 단가 추세")).toBeInTheDocument();
  });

  it("재고 칸 소비기한 경고는 마지막 판매일이 아니라 오늘 기준이다", async () => {
    // 마지막 판매 10/19, 오늘 11/7 — 11/9 소비기한은 오늘 기준 D-2라 경고, 판매일 기준이면 빠진다
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 7, 9, 0));
    onTestFinished(() => {
      vi.useRealTimers();
    });
    vi.spyOn(salesApi, "getSalesSummary").mockResolvedValue({
      total_revenue: 1_000_000,
      total_sales_count: 10,
      first_sale_at: "2026-10-01T10:00:00",
      last_sale_at: "2026-10-19T21:00:00",
      today_revenue: 100_000,
      today_sales_count: 5,
      this_month_revenue: 0,
      this_month_sales_count: 0,
    });
    vi.spyOn(inventoryApi, "listInventory").mockResolvedValue([
      {
        item_id: "soon",
        name: "고추장",
        unit: "병",
        total_quantity: 50,
        low_stock_threshold: 10,
        nearest_expiry_date: "2026-11-09",
        needs_check: false,
        lead_time_days: null,
        safety_stock: null,
        created_at: "",
        updated_at: "",
        coupang_product: null,
        unit_price: null,
      },
    ]);

    renderHome();

    expect(await screen.findByText("확인 필요 1")).toBeInTheDocument();
    expect(screen.getByText("고추장")).toBeInTheDocument();
    expect(screen.getByText("D-2")).toHaveClass("text-danger");
  });

  it("재고 칸: 확인 필요 재료는 웹에서 모두 그리고(칸 안 스크롤), 앱에서는 앞 8개만 보인다", async () => {
    vi.spyOn(inventoryApi, "listInventory").mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        item_id: `low-${i}`,
        name: `부족 재료 ${i + 1}`,
        unit: "kg",
        total_quantity: 1,
        low_stock_threshold: 10,
        nearest_expiry_date: null,
        needs_check: false,
        lead_time_days: null,
        safety_stock: null,
        created_at: "",
        updated_at: "",
        coupang_product: null,
        unit_price: null,
      })),
    );

    renderHome();

    expect(await screen.findByText("확인 필요 10")).toBeInTheDocument();
    const list = screen.getByText("부족 재료 1").closest("ul");
    expect(list).toHaveClass("lg:overflow-y-auto");
    const rows = list?.querySelectorAll("li") ?? [];
    expect(rows).toHaveLength(10);
    expect(rows[7]).not.toHaveClass("hidden");
    expect(rows[8]).toHaveClass("hidden", "lg:grid");
    expect(rows[9]).toHaveClass("hidden", "lg:grid");
  });
});
