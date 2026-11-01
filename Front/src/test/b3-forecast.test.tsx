// B3 매출 예측 화면 및 순수 로직 단위 테스트.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HTTPError } from "ky";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as dashboardApi from "../api/endpoints/dashboard";
import * as forecastApi from "../api/endpoints/forecast";
import * as salesApi from "../api/endpoints/sales";
import {
  type MenuForecastItem,
  buildMenuShareItems,
  buildPeriodView,
  calcBucketAccuracy,
  calcYesterdayAccuracy,
  forecastErrorMessage,
  formatIntervalRange,
  getPeriodBounds,
  horizonDayLabel,
  lowConfidenceTooltip,
} from "../components/forecast/forecast-logic";
import ForecastPage from "../routes/forecast";

describe("매출 예측 순수 계산 함수 (forecast-logic)", () => {
  describe("날짜 및 라벨 포맷", () => {
    it("horizonDayLabel: 1~3은 오늘/내일/모레로 변환한다", () => {
      expect(horizonDayLabel(1, 0)).toBe("오늘");
      expect(horizonDayLabel(2, 1)).toBe("내일");
      expect(horizonDayLabel(3, 2)).toBe("모레");
      expect(horizonDayLabel(4, 3)).toBe("4일 뒤");
    });

    it("formatIntervalRange: P10~P90 범위를 포맷한다", () => {
      expect(formatIntervalRange(860_000, 1_300_000)).toBe("86만~130만원");
      expect(formatIntervalRange(1_200_000, 2_500_000)).toBe("120만~250만원");
    });

    it("lowConfidenceTooltip: 사유 코드에 맞는 안내 문구를 반환한다", () => {
      expect(lowConfidenceTooltip("SHORT_HISTORY")).toContain("판매 이력이 짧아");
      expect(lowConfidenceTooltip("LONG_HORIZON")).toContain("사흘 뒤 예측이라");
      expect(lowConfidenceTooltip(null)).toBe("신뢰도 낮음");
    });

    it("forecastErrorMessage: 422는 이력 부족, 그 외는 서버 연결 실패 문구를 반환한다", () => {
      const mock422 = new HTTPError(
        new Response(null, { status: 422 }),
        new Request("http://localhost/api/forecast"),
        {} as never,
      );
      expect(forecastErrorMessage(mock422)).toBe(
        "AI 예측에 필요한 판매 이력이 부족합니다 (최소 10일 이상 필요).",
      );

      const mock500 = new Error("Network error");
      expect(forecastErrorMessage(mock500)).toBe(
        "AI 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.",
      );
    });
  });

  describe("getPeriodBounds & 넘김 범위", () => {
    const ref = new Date(2026, 9, 20); // 2026-10-20

    it("주(week) 단위: 7일 구간과 직전 7일 비교 구간을 반환한다", () => {
      const bounds = getPeriodBounds("week", 0, ref);
      expect(bounds.unit).toBe("일별 매출");
      expect(bounds.latest).toBe(true);
      expect(bounds.prevName).toBe("직전 7일");
      // start는 end(10/20) - 6일 = 10/14
      expect(bounds.start.getDate()).toBe(14);
      expect(bounds.end.getDate()).toBe(20);
    });

    it("주(week) back=1: 직전 주간 범위를 반환한다", () => {
      const bounds = getPeriodBounds("week", 1, ref);
      expect(bounds.latest).toBe(false);
      expect(bounds.end.getDate()).toBe(13);
      expect(bounds.start.getDate()).toBe(7);
    });

    it("월(month) 단위: 1일부터 기준일까지(back=0) 구간을 반환한다", () => {
      const bounds = getPeriodBounds("month", 0, ref);
      expect(bounds.unit).toBe("일별 매출");
      expect(bounds.latest).toBe(true);
      expect(bounds.label).toBe("2026년 10월");
      expect(bounds.prevName).toBe("9월");
      expect(bounds.start.getDate()).toBe(1);
      expect(bounds.end.getDate()).toBe(20);
    });

    it("연(year) 단위: 12개월 구간을 반환한다", () => {
      const bounds = getPeriodBounds("year", 0, ref);
      expect(bounds.unit).toBe("월별 매출");
      expect(bounds.latest).toBe(false);
      expect(bounds.label).toContain("2025년 11월 ~ 2026년 10월");
    });
  });

  describe("년 보기 (buildPeriodView year)", () => {
    const ref = new Date(2026, 9, 19);
    it("정확도는 예측이 있는 날끼리만 달마다 비교한다", () => {
      const view = buildPeriodView("year", 0, ref, [
        { date: "2026-10-01", actual_sales: 1000, predicted_sales: null },
        { date: "2026-10-02", actual_sales: 100, predicted_sales: 90 },
      ] as never);
      expect(view.values.at(-1)).toBe(1100);
      expect(view.accuracy).toBe(90);
    });
    it("앞 12개월에 판매가 있으면 이전 기간으로 넘길 수 있다", () => {
      const bounds = getPeriodBounds("year", 0, ref);
      expect(bounds.queryStart).toEqual(new Date(2024, 10, 1));
      const view = buildPeriodView("year", 0, ref, [
        { date: "2025-03-05", actual_sales: 500, predicted_sales: null },
      ] as never);
      expect(view.canBack).toBe(true);
    });
  });

  describe("정확도 계산 (calcBucketAccuracy)", () => {
    it("1 - |예측 - 실제| / 실제 의 평균 백분율을 반환한다", () => {
      // 실제 100, 예측 90 -> 1 - 10/100 = 0.90 (90%)
      // 실제 200, 예측 220 -> 1 - 20/200 = 0.90 (90%)
      const acc = calcBucketAccuracy([100, 200], [90, 220]);
      expect(acc).toBe(90);
    });

    it("실제 매출이 0이거나 예측이 null인 날은 제외한다", () => {
      const acc = calcBucketAccuracy([0, 100], [null, 95]);
      expect(acc).toBe(95);
    });

    it("유효한 데이터가 없으면 null을 반환한다", () => {
      expect(calcBucketAccuracy([], [])).toBeNull();
      expect(calcBucketAccuracy([0, 0], [null, null])).toBeNull();
    });
  });

  describe("어제 정확도 (calcYesterdayAccuracy)", () => {
    it("마지막 판매일의 정확도(%)와 마우스오버 텍스트를 계산한다", () => {
      const point = {
        date: "2026-10-19",
        actual_sales: 1_280_000,
        predicted_sales: 1_210_000,
        interval_p10: 1_000_000,
        interval_p90: 1_500_000,
        horizon_days: 1,
      };
      const res = calcYesterdayAccuracy(point);
      expect(res).not.toBeNull();
      // 1 - |121 - 128| / 128 = 1 - 7/128 = 0.9453 -> 95%
      expect(res?.pct).toBe(95);
      expect(res?.title).toContain("어제 예측 121만원, 실제 128만원");
    });

    it("actual_sales 또는 predicted_sales가 없으면 null을 반환한다", () => {
      expect(calcYesterdayAccuracy(undefined)).toBeNull();
      expect(
        calcYesterdayAccuracy({
          date: "2026-10-19",
          actual_sales: 0,
          predicted_sales: 100,
          interval_p10: null,
          interval_p90: null,
          horizon_days: null,
        }),
      ).toBeNull();
    });
  });

  describe("메뉴별 비중 및 도넛 차트 (buildMenuShareItems)", () => {
    const rawItems: MenuForecastItem[] = [
      { menu_id: "m1", menu_name: "루꼴라 화덕피자", expected_quantity: 24 },
      { menu_id: "m2", menu_name: "페페로니 화덕피자", expected_quantity: 16 },
      { menu_id: "m3", menu_name: "콜라", expected_quantity: 10 },
    ];

    it("수량 내림차순 정렬, 순위 부여, 비중(%)을 계산한다", () => {
      const items = buildMenuShareItems(rawItems);
      expect(items[0]?.menu_id).toBe("m1");
      expect(items[0]?.rank).toBe(1);
      // 총 50개 중 24개 = 48%
      expect(items[0]?.sharePct).toBe(48);

      expect(items[1]?.menu_id).toBe("m2");
      expect(items[1]?.rank).toBe(2);
      // 50개 중 16개 = 32%
      expect(items[1]?.sharePct).toBe(32);

      expect(items[2]?.menu_id).toBe("m3");
      expect(items[2]?.rank).toBe(3);
      // 50개 중 10개 = 20%
      expect(items[2]?.sharePct).toBe(20);
    });

    it("도넛 둘레(226.2)에 맞춘 strokeDasharray를 생성한다", () => {
      const items = buildMenuShareItems(rawItems);
      // 48% * 226.2 = 108.6
      expect(items[0]?.strokeDasharray).toContain("226.2");
      expect(items[0]?.strokeDasharray).toBe("108.6 226.2");
    });
  });

  describe("기간 매출 뷰 빌더 (buildPeriodView)", () => {
    const ref = new Date(2026, 9, 20);
    const mockPoints = [
      {
        date: "2026-10-14",
        actual_sales: 100_000,
        predicted_sales: 90_000,
        interval_p10: null,
        interval_p90: null,
        horizon_days: null,
      },
      {
        date: "2026-10-15",
        actual_sales: 120_000,
        predicted_sales: 110_000,
        interval_p10: null,
        interval_p90: null,
        horizon_days: null,
      },
      {
        date: "2026-10-19",
        actual_sales: 150_000,
        predicted_sales: 140_000,
        interval_p10: null,
        interval_p90: null,
        horizon_days: null,
      },
    ];

    it("일별 포인트로부터 주간 합계 및 라벨을 구성한다", () => {
      const view = buildPeriodView("week", 0, ref, mockPoints);
      expect(view.unit).toBe("일별 매출");
      expect(view.labels).toHaveLength(7);
      expect(view.total).toBe(370_000);
      expect(view.latest).toBe(true);
    });
  });
});

describe("ForecastPage 화면 렌더링 및 인터랙션", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // 기본 mock 데이터 설정
    vi.spyOn(salesApi, "getSalesSummary").mockResolvedValue({
      total_revenue: 15_000_000,
      total_sales_count: 650,
      this_month_revenue: 12_000_000,
      this_month_sales_count: 500,
      today_revenue: 1_280_000,
      today_sales_count: 45,
      last_sale_at: "2026-10-19T22:00:00",
    });

    vi.spyOn(dashboardApi, "getForecastVsActual").mockResolvedValue({
      start_date: "2026-10-01",
      end_date: "2026-10-19",
      data: [
        {
          date: "2026-10-18",
          actual_sales: 1_100_000,
          predicted_sales: 1_050_000,
          interval_p10: 900_000,
          interval_p90: 1_300_000,
          horizon_days: 1,
        },
        {
          date: "2026-10-19",
          actual_sales: 1_280_000,
          predicted_sales: 1_210_000,
          interval_p10: 1_000_000,
          interval_p90: 1_500_000,
          horizon_days: 1,
        },
      ],
    });

    vi.spyOn(forecastApi, "getForecastPredict").mockResolvedValue({
      predictions: [
        {
          target_date: "2026-10-20",
          horizon_days: 1,
          predicted_sales: 1_080_000,
          interval_p10: 860_000,
          interval_p90: 1_300_000,
          is_low_confidence: false,
          low_confidence_reason: null,
          explanation: {
            baseline: "136만원",
            deviation_vs_baseline: -0.21,
            top_factors: [
              { feature: "day_tue", label: "화요일 효과", pct: -0.14 },
              { feature: "recent_avg", label: "최근 같은 요일 평균", pct: -0.06 },
            ],
            sentence: "10월 20일(화)은 평소보다 약 21% 낮을 것으로 예상됩니다.",
          },
          menu_forecast: [
            { menu_id: "m1", menu_name: "불새우 루꼴라 화덕피자", expected_quantity: 22 },
            { menu_id: "m2", menu_name: "페페로니 듬뿍 화덕피자", expected_quantity: 19 },
          ],
        },
        {
          target_date: "2026-10-21",
          horizon_days: 2,
          predicted_sales: 1_140_000,
          interval_p10: 920_000,
          interval_p90: 1_370_000,
          is_low_confidence: false,
          low_confidence_reason: null,
          explanation: {
            baseline: "136만원",
            deviation_vs_baseline: -0.16,
            top_factors: [{ feature: "day_wed", label: "수요일 효과", pct: -0.09 }],
            sentence: "10월 21일(수)은 평소보다 약 16% 낮을 것으로 예상됩니다.",
          },
          menu_forecast: [
            { menu_id: "m1", menu_name: "불새우 루꼴라 화덕피자", expected_quantity: 23 },
            { menu_id: "m2", menu_name: "페페로니 듬뿍 화덕피자", expected_quantity: 20 },
          ],
        },
        {
          target_date: "2026-10-22",
          horizon_days: 3,
          predicted_sales: 1_210_000,
          interval_p10: 700_000,
          interval_p90: 1_730_000,
          is_low_confidence: true,
          low_confidence_reason: "LONG_HORIZON",
          explanation: {
            baseline: "136만원",
            deviation_vs_baseline: -0.11,
            top_factors: [{ feature: "day_thu", label: "목요일 효과", pct: -0.07 }],
            sentence: "10월 22일(목)은 평소보다 약 11% 낮을 것으로 예상됩니다.",
          },
          menu_forecast: [
            { menu_id: "m2", menu_name: "페페로니 듬뿍 화덕피자", expected_quantity: 24 },
            { menu_id: "m1", menu_name: "불새우 루꼴라 화덕피자", expected_quantity: 23 },
          ],
        },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderForecastPage() {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    return render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/forecast"]}>
          <ForecastPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it("화면 로드 시 헤더의 반영 기준일과 '앞으로 3일 예상 매출' 섹션을 표시한다", async () => {
    renderForecastPage();

    await waitFor(() => {
      // 10월 19일 판매까지 반영했어요
      expect(screen.getByText(/10월 19일 판매까지 반영했어요/)).toBeInTheDocument();
    });

    // 3일 예상 목록의 '오늘', '내일', '모레' 버튼 항목
    expect(screen.getByRole("button", { name: /오늘/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /내일/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /모레/ })).toBeInTheDocument();

    // 신뢰도 낮음 뱃지 (모레 항목)
    expect(screen.getByText("신뢰도 낮음")).toBeInTheDocument();

    // 편차·요인은 비율(−0.21·−0.14)을 %로 보인다
    expect(screen.getByText(/평소보다 21% 낮음/)).toBeInTheDocument();
    expect(screen.getByText(/화요일 효과 -14%/)).toBeInTheDocument();

    // 첫 날 메뉴별 예상 판매 목록
    expect(screen.getByText(/10월 20일 \(화\) 메뉴별 예상 판매/)).toBeInTheDocument();
    expect(screen.getByText("불새우 루꼴라 화덕피자")).toBeInTheDocument();
    expect(screen.getByText("페페로니 듬뿍 화덕피자")).toBeInTheDocument();
  });

  it("내일(D+2) 줄을 누르면 하단 메뉴 제목과 목록이 내일 예측으로 변경된다", async () => {
    renderForecastPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /오늘/ })).toBeInTheDocument();
    });

    // '내일' 버튼 클릭
    const tomorrowBtn = screen.getByRole("button", { name: /내일/ });
    fireEvent.click(tomorrowBtn);

    // 하단 메뉴 제목이 10월 21일 (수) 메뉴별 예상 판매로 바뀜
    await waitFor(() => {
      expect(screen.getByText(/10월 21일 \(수\) 메뉴별 예상 판매/)).toBeInTheDocument();
    });
  });

  it("주/월/년 탭 클릭 시 탭 상태가 전환된다", async () => {
    renderForecastPage();

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "주" })).toBeInTheDocument();
    });

    const weekTab = screen.getByRole("tab", { name: "주" });
    fireEvent.click(weekTab);
    expect(weekTab).toHaveAttribute("aria-selected", "true");

    const yearTab = screen.getByRole("tab", { name: "년" });
    fireEvent.click(yearTab);
    expect(yearTab).toHaveAttribute("aria-selected", "true");
  });

  it("AI 예측 422 실패 시 이력 부족 에러 문구를 표시한다", async () => {
    const error422 = new HTTPError(
      new Response(null, { status: 422 }),
      new Request("http://localhost/api/forecast"),
      {} as never,
    );
    vi.spyOn(forecastApi, "getForecastPredict").mockRejectedValue(error422);

    renderForecastPage();

    await waitFor(() => {
      expect(screen.getByText(/AI 예측에 필요한 판매 이력이 부족합니다/)).toBeInTheDocument();
    });

    // 하단 메뉴 영역 대체 문구
    expect(screen.getByText("메뉴별 예측도 함께 기다리고 있어요")).toBeInTheDocument();
  });
});
