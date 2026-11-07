// 홈 화면 — 리디자인 v2 (docs/plan/mockup/v2/06_home.html, docs/spec/04_fe.md §4.3).
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  ChevronRight,
  Target,
  Upload,
  Wallet,
} from "lucide-react";
import { Link } from "react-router";
import { getForecastVsActual } from "../api/endpoints/dashboard";
import { getForecastPredict } from "../api/endpoints/forecast";
import { getPriceTrends, listInventory } from "../api/endpoints/inventory";
import { listOrders } from "../api/endpoints/orders";
import { getSalesSummary, getSalesTrends } from "../api/endpoints/sales";
import { HomeAreaChart } from "../components/home/home-area-chart";
import {
  formatExpiryDday,
  selectAlertInventory,
  selectTopPriceTrends,
} from "../components/home/home-utils";
import { MenuShareDonut } from "../components/home/menu-share-donut";
import { MiniPriceChart } from "../components/home/mini-price-chart";
import { MonthProgressDonut } from "../components/home/month-progress-donut";
import { RecentOrderTile } from "../components/home/recent-order-tile";
import { isExpiryWarning, isStockWarning } from "../components/inventory/stock-status";
import { InstallBanner } from "../components/pwa/install-banner";
import { MainShell } from "../components/shell";
import { LoadError } from "../components/ui/load-error";
import { accuracyRatio } from "../lib/accuracy";
import {
  formatMonthDay,
  formatMonthDayDow,
  formatQty,
  formatSlashDate,
  formatWonShort,
  parseLocalDate,
  toIsoDate,
} from "../lib/format";
import { useAuthStore } from "../stores/auth-store";

// 앱에서 홈 재고 칸에 보이는 확인 필요 재료 수. 웹은 칸 높이만큼 보이고 나머지는 칸 안에서 스크롤 (04_fe.md §4.3)
const ALERT_INVENTORY_APP_LIMIT = 8;

export default function HomePage() {
  const user = useAuthStore((s) => s.user);

  // 1. 판매 요약
  const {
    data: summary,
    isError: isSummaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ["sales-summary"],
    queryFn: getSalesSummary,
    staleTime: 60_000,
  });

  const hasSalesData = (summary?.total_sales_count ?? 0) > 0 && Boolean(summary?.last_sale_at);
  // 판매 요약을 못 받았으면 판매가 있는지 모른다 — 신규 매장 안내('0원'·'첫 매출')를 띄우지 않는다
  const summaryFailed = isSummaryError && !summary;

  // 기준일: 판매 기록이 있으면 마지막 판매일, 없으면 오늘
  const refDate = summary?.last_sale_at ? parseLocalDate(summary.last_sale_at) : new Date();

  // 2. 대시보드 예측 vs 실제 매출 (마지막 판매일 포함 최근 7일)
  const sevenDaysAgo = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() - 6);
  const { data: forecastVsActual } = useQuery({
    queryKey: ["dashboard-forecast-vs-actual", toIsoDate(sevenDaysAgo), toIsoDate(refDate)],
    queryFn: () => getForecastVsActual(toIsoDate(sevenDaysAgo), toIsoDate(refDate)),
    enabled: hasSalesData,
    staleTime: 60_000,
  });

  // 3. AI 수요예측
  const { data: forecastData, refetch: refetchForecast } = useQuery({
    queryKey: ["forecast-predict"],
    queryFn: () => getForecastPredict(),
    enabled: hasSalesData,
    staleTime: 60_000,
  });

  // 4. 지난달 총매출 (이번 달 누적과 비교용)
  const firstDayLastMonth = new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1);
  const lastDayLastMonth = new Date(refDate.getFullYear(), refDate.getMonth(), 0);
  const { data: lastMonthTrends } = useQuery({
    queryKey: [
      "sales-trends-prev-month",
      toIsoDate(firstDayLastMonth),
      toIsoDate(lastDayLastMonth),
    ],
    queryFn: () =>
      getSalesTrends(toIsoDate(firstDayLastMonth), toIsoDate(lastDayLastMonth), "month"),
    enabled: hasSalesData,
    staleTime: 300_000,
  });

  // 5. 쿠팡 단가 추세 (30일)
  const { data: priceTrendsData } = useQuery({
    queryKey: ["inventory-price-trends", 30],
    queryFn: () => getPriceTrends(30),
    staleTime: 300_000,
  });

  // 6. 최근 발주 4건
  const { data: ordersData } = useQuery({
    queryKey: ["recent-orders-home"],
    queryFn: () => listOrders(1, 4),
    staleTime: 60_000,
  });

  // 7. 재고 목록
  const { data: inventoryData } = useQuery({
    queryKey: ["inventory-list-home"],
    queryFn: listInventory,
    staleTime: 60_000,
  });

  // 예측 데이터 정제
  const predictions = forecastData?.predictions ?? [];
  const todayPrediction = predictions.find((p) => p.horizon_days === 1) ?? predictions[0];
  const tomorrowPrediction = predictions.find((p) => p.horizon_days === 2) ?? predictions[1];

  // 어제 예측 및 실제값 비교 (마지막 판매일 기준)
  const fvaData = forecastVsActual?.data ?? [];
  const yesterdayPoint = fvaData.find((p) => p.date === toIsoDate(refDate));
  const yesterdayActual = yesterdayPoint?.actual_sales ?? summary?.today_revenue;
  const yesterdayPredicted = yesterdayPoint?.predicted_sales;
  const ratio = accuracyRatio(yesterdayActual, yesterdayPredicted);
  const accuracy = ratio == null ? null : Math.round(ratio * 100);

  // 최근 7일 실제 매출 및 평소 평균 계산
  const actualValues = fvaData.map((p) => p.actual_sales ?? 0);
  const actualLabels = fvaData.map((p) => formatSlashDate(p.date));
  const baseline =
    actualValues.length > 0
      ? Math.round(actualValues.reduce((a, b) => a + b, 0) / actualValues.length)
      : null;

  // 차트 전달용 라벨 및 값
  const chartLabels = todayPrediction ? [...actualLabels, "오늘"] : actualLabels;
  const chartValues = todayPrediction
    ? [...actualValues, todayPrediction.predicted_sales]
    : actualValues;
  const forecastCount = todayPrediction ? 1 : 0;

  // 평소 대비 증감률
  const deviation = todayPrediction?.explanation?.deviation_vs_baseline;
  const deviationPct = deviation != null ? Math.round(Math.abs(deviation) * 100) : null;

  // 지난달 매출 합계
  const prevMonthRevenue = lastMonthTrends?.data?.reduce((sum, pt) => sum + pt.revenue, 0) ?? 0;
  const thisMonthRevenue = summary?.this_month_revenue ?? 0;

  // 쿠팡 단가 추세 상위 4개
  const topPriceTrends = selectTopPriceTrends(priceTrendsData?.items ?? [], 4);

  // 최근 발주 목록
  const recentOrders = ordersData?.items ?? [];

  // 확인 필요 재고
  const alertInventory = selectAlertInventory(inventoryData ?? [], refDate);

  // 오늘 예상 대상일 텍스트
  const todayTargetDate = todayPrediction?.target_date
    ? parseLocalDate(todayPrediction.target_date)
    : new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() + 1);

  return (
    <MainShell active="home">
      {/* 머리 줄 — 두 줄 인사 + 숫자 셋 */}
      <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-center lg:gap-20">
        <h1 className="shrink-0 text-[1.65rem] leading-tight font-extrabold tracking-tight text-ink lg:text-[2rem]">
          어서 오세요,
          <br />
          {user?.name ? `${user.name} 사장님` : "사장님"}
        </h1>
        <div className="grid grid-cols-2 gap-4 lg:flex lg:items-center lg:gap-10">
          {/* 어제 매출 */}
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-2 glass-bar">
              <Wallet className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="tabular text-xl leading-none font-bold tracking-tight text-ink lg:text-[1.35rem]">
                {hasSalesData
                  ? formatWonShort(summary?.today_revenue ?? 0)
                  : summaryFailed
                    ? "—"
                    : "0원"}
              </p>
              <p className="mt-1 text-xs leading-snug text-ink-2 lg:truncate">
                {hasSalesData
                  ? `어제(${formatMonthDay(refDate)}) 매출 · 판매 ${summary?.today_sales_count ?? 0}건`
                  : "어제 매출"}
              </p>
            </div>
          </div>

          {/* 내일 예상 */}
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-2 glass-bar">
              <CalendarDays className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="tabular text-xl leading-none font-bold tracking-tight text-ink lg:text-[1.35rem]">
                {hasSalesData && tomorrowPrediction
                  ? formatWonShort(tomorrowPrediction.predicted_sales)
                  : "—"}
              </p>
              <p className="mt-1 text-xs leading-snug text-ink-2 lg:truncate">
                {summaryFailed
                  ? "내일 예상"
                  : !hasSalesData
                    ? "내일 예상 · 예측 전"
                    : tomorrowPrediction
                      ? `내일 ${formatMonthDayDow(tomorrowPrediction.target_date)} 예상`
                      : "내일 예상 · 불러오지 못했어요"}
              </p>
            </div>
          </div>

          {/* 예측 정확도 */}
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-2 glass-bar">
              <Target className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="tabular text-xl leading-none font-bold tracking-tight text-ink lg:text-[1.35rem]">
                {hasSalesData && accuracy != null ? `${accuracy}%` : "—"}
              </p>
              <p className="mt-1 text-xs leading-snug text-ink-2 lg:truncate">
                {summaryFailed
                  ? "예측 정확도"
                  : !hasSalesData
                    ? "예측 정확도 · 예측 전"
                    : yesterdayPredicted != null
                      ? `예측 정확도 · 어제 예측 ${formatWonShort(yesterdayPredicted)}`
                      : "예측 정확도 · 어제 예측 —"}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* 판매 요약 실패 — 없으면 아래 칸이 모두 '판매 데이터 없음'처럼 보인다 */}
      {summaryFailed && <LoadError className="mb-4 py-6" onRetry={() => void refetchSummary()} />}

      {/* 설치 안내 배너 */}
      <InstallBanner />

      {/* 웹은 두 열 — 왼쪽 7칸 / 오른쪽 5칸 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div
          className={`grid gap-4 lg:col-span-7 ${
            // 요약 실패로 칸이 쿠팡 단가 하나만 남으면 오른쪽 열 높이만큼 늘어나지 않게 위로 붙인다
            summaryFailed ? "content-start" : ""
          }`}
        >
          {/* 판매 요약에 기대는 칸 — 요약을 못 받았으면 숨긴다 */}
          {!summaryFailed && (
            <>
              {/* 오늘 예상 매출 */}
              <section className="flex flex-col rounded-2xl p-5 glass-card">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-bold text-ink">오늘 예상 매출</h2>
                  <span className="rounded-full bg-white/60 px-2.5 py-1 text-xs font-semibold text-ink-2">
                    {formatMonthDayDow(todayTargetDate)}
                  </span>
                </div>

                {hasSalesData && todayPrediction ? (
                  <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <p className="tabular text-[2.5rem] leading-none font-bold tracking-tight text-ink">
                      {formatWonShort(todayPrediction.predicted_sales)}
                    </p>
                    {deviation != null && deviationPct != null && (
                      <p className="text-sm text-ink-2">
                        평소보다{" "}
                        <span
                          className={`inline-flex items-center gap-0.5 font-bold ${
                            deviation < 0 ? "text-down" : "text-up"
                          }`}
                        >
                          {deviation < 0 ? (
                            <ArrowDown className="size-3" />
                          ) : (
                            <ArrowUp className="size-3" />
                          )}
                          {deviationPct}%
                        </span>{" "}
                        {deviation < 0 ? "낮을" : "높을"} 것으로 예상
                      </p>
                    )}
                  </div>
                ) : hasSalesData ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-bold text-ink">오늘 예측을 불러오지 못했어요</p>
                      <p className="mt-1 text-sm text-ink-3">
                        발주 추천도 예측으로 계산해서 함께 비어 있어요.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => refetchForecast()}
                      className="inline-flex h-11 items-center rounded-full bg-ink px-5 text-[0.95rem] font-semibold text-white"
                    >
                      다시 불러오기
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-bold text-ink">첫 매출을 올려 주세요</p>
                      <p className="mt-1 text-sm text-ink-3">
                        올린 다음 날 아침부터 예상 매출과 발주 추천이 나와요.
                      </p>
                    </div>
                    <Link
                      to="/settings/pos/upload"
                      className="inline-flex h-11 items-center gap-1.5 rounded-full bg-ink px-5 text-[0.95rem] font-semibold text-white"
                    >
                      <Upload className="size-4" />
                      매출 올리기
                    </Link>
                  </div>
                )}

                {hasSalesData && (
                  <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-0.5 w-3.5 rounded-full bg-brand" />
                      실제
                    </span>
                    {todayPrediction && (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-3.5 border-t-2 border-dashed border-brand" />
                        오늘 예상
                      </span>
                    )}
                    {baseline != null && (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-3.5 border-t-2 border-dashed border-ink-3" />
                        평소 · {formatWonShort(baseline)}
                      </span>
                    )}
                  </p>
                )}

                {hasSalesData ? (
                  <HomeAreaChart
                    labels={chartLabels}
                    values={chartValues}
                    forecastCount={forecastCount}
                    refVal={baseline}
                  />
                ) : (
                  <p className="mt-4 flex h-40 items-center justify-center rounded-xl text-sm text-ink-3 glass-card lg:h-56">
                    매출을 올리면 그려져요
                  </p>
                )}
              </section>

              {/* 지난달 매출까지 도넛 + 많이 나갈 메뉴 도넛 */}
              <div className="grid gap-4 lg:grid-cols-7">
                <MonthProgressDonut
                  hasSalesData={hasSalesData}
                  thisMonthRevenue={thisMonthRevenue}
                  prevMonthRevenue={prevMonthRevenue}
                />
                <MenuShareDonut
                  hasSalesData={hasSalesData}
                  menuForecast={todayPrediction?.menu_forecast}
                />
              </div>
            </>
          )}

          {/* 쿠팡 단가 추세 */}
          <section className="flex flex-col rounded-2xl p-5 glass-card">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-ink">쿠팡 단가 추세</h2>
              <span className="text-xs text-ink-3">최근 30일 · 변화 큰 순</span>
            </div>
            {topPriceTrends.length > 0 ? (
              <ul className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {topPriceTrends.map((item) => {
                  const isUp = item.changeRate >= 0;
                  return (
                    <li key={item.itemId} className="flex flex-col rounded-xl p-3.5 glass-card">
                      <span className="truncate text-sm font-semibold text-ink">{item.name}</span>
                      <span className="tabular mt-2 text-lg leading-none font-bold tracking-tight text-ink">
                        {Math.round(item.currentPrice).toLocaleString("ko-KR")}
                        <span className="ml-0.5 text-xs font-medium text-ink-3">
                          원/{item.unit}
                        </span>
                      </span>
                      <span
                        className={`tabular mt-1.5 inline-flex items-center gap-0.5 text-sm font-bold ${
                          isUp ? "text-up" : "text-down"
                        }`}
                      >
                        {isUp ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                        {Math.abs(item.changeRate).toFixed(1)}%
                      </span>
                      <MiniPriceChart values={item.points.map((p) => p.unit_price)} />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-ink-3">쿠팡 담기를 하면 재료 단가가 쌓여요</p>
            )}
          </section>
        </div>

        {/* 오른쪽 5칸 — 최근 발주 · 재고 */}
        <div className="grid gap-4 lg:col-span-5 lg:grid-rows-2">
          {/* 최근 발주 */}
          <section className="flex flex-col rounded-2xl p-5 glass-card">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-ink">최근 발주</h2>
              {recentOrders.length > 0 && (
                <Link
                  to="/orders"
                  className="inline-flex items-center gap-0.5 text-sm font-semibold text-brand hover:text-brand-strong"
                >
                  전체 보기
                  <ChevronRight className="size-4" />
                </Link>
              )}
            </div>
            {recentOrders.length > 0 ? (
              <ul className="mt-4 grid grid-cols-2 gap-3 lg:flex-1 lg:grid-rows-2">
                {recentOrders.map((order) => (
                  <RecentOrderTile key={order.order_id} order={order} />
                ))}
              </ul>
            ) : (
              <p className="mt-4 flex items-center justify-center rounded-xl py-10 text-sm text-ink-3 glass-card">
                아직 확정한 발주가 없어요
              </p>
            )}
          </section>

          {/* 재고 */}
          <section className="flex flex-col rounded-2xl p-5 glass-card">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-ink">
                재고
                <span className="ml-1.5 text-sm font-normal text-ink-3">
                  확인 필요 {alertInventory.length}
                </span>
              </h2>
              <Link
                to="/inventory"
                className="inline-flex items-center gap-0.5 text-sm font-semibold text-brand hover:text-brand-strong"
              >
                전체 보기
                <ChevronRight className="size-4" />
              </Link>
            </div>
            <p className="mt-3 grid grid-cols-[minmax(0,1fr)_5.5rem_4rem] gap-3 text-xs text-ink-3">
              <span>재료</span>
              <span className="text-right">총 수량</span>
              <span className="text-right">소비기한</span>
            </p>
            {/* 웹은 목록을 띄워 칸이 같은 줄 왼쪽 열보다 길어지지 않게 한다 */}
            <div className="mt-1 lg:relative lg:min-h-32 lg:flex-1">
              <ul className="divide-y divide-white/60 lg:absolute lg:inset-0 lg:overflow-y-auto">
                {alertInventory.map((item, idx) => {
                  const isStockWarn = isStockWarning(item);
                  const isExpWarn = isExpiryWarning(item, refDate);
                  return (
                    <li
                      key={item.item_id}
                      className={`${idx < ALERT_INVENTORY_APP_LIMIT ? "grid" : "hidden lg:grid"} ${
                        idx === ALERT_INVENTORY_APP_LIMIT - 1 ? "max-lg:border-b-0" : ""
                      } grid-cols-[minmax(0,1fr)_5.5rem_4rem] items-center gap-3 py-2.5`}
                    >
                      <span className="truncate text-sm font-semibold text-ink">{item.name}</span>
                      <span
                        className={`tabular text-right text-sm ${
                          isStockWarn ? "text-danger" : "text-ink-2"
                        }`}
                      >
                        {formatQty(item.total_quantity)} {item.unit}
                      </span>
                      <span
                        className={`tabular text-right text-sm ${
                          isExpWarn ? "text-danger" : "text-ink-2"
                        }`}
                      >
                        {formatExpiryDday(item.nearest_expiry_date, refDate)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        </div>
      </div>
    </MainShell>
  );
}
