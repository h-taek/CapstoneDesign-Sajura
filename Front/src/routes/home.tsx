// 홈 화면 — 참고 대시보드 목업(실시간 최저가·주요지표·매출그래프·톱콘텐츠·재고현황·매출분석)
// 레이아웃에 맞춰 재구성. 전부 실제 GET /api/sales/* · /api/inventory · /api/menus · /api/prices
// 데이터로 렌더링하며, 시스템에 없는 값(신규 고객·조회수·추천 공급처)은 가짜로 채우지 않고
// 실제로 있는 값으로 대체하거나 "—"로 표시한다.
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Minus,
  Receipt,
  TrendingDown,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { listInventory } from "../api/endpoints/inventory";
import { listMenus } from "../api/endpoints/menus";
import { getIngredientPrices } from "../api/endpoints/prices";
import {
  getDailyRevenue,
  getMonthlyRevenue,
  getSalesSummary,
  getTopMenus,
  getWeeklyRevenueThisMonth,
} from "../api/endpoints/sales";
import { IngredientIcon } from "../components/dashboard/ingredient-icon";
import { MenuSharePieChart } from "../components/dashboard/menu-share-chart";
import { RevenueBarChart } from "../components/dashboard/revenue-chart";
import { DashboardShell } from "../components/dashboard/shell";

const won = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" });

function previousPrice(price: number, changePercent: number): number {
  if (changePercent === 0) return price;
  return Math.round(price / (1 + changePercent / 100));
}

export default function HomePage() {
  const { data: summary } = useQuery({
    queryKey: ["sales-summary"],
    queryFn: getSalesSummary,
    staleTime: 60_000,
  });
  const { data: weekly = [] } = useQuery({
    queryKey: ["sales-weekly-this-month"],
    queryFn: getWeeklyRevenueThisMonth,
    staleTime: 60_000,
  });
  const { data: daily = [] } = useQuery({
    queryKey: ["sales-daily", 7],
    queryFn: () => getDailyRevenue(7),
    staleTime: 60_000,
  });
  const { data: topMenus = [] } = useQuery({
    queryKey: ["top-menus"],
    queryFn: () => getTopMenus(4),
    staleTime: 60_000,
  });
  const { data: ingredientPrices = [] } = useQuery({
    queryKey: ["ingredient-prices"],
    queryFn: getIngredientPrices,
    staleTime: 5 * 60_000,
  });
  const { data: inventory = [] } = useQuery({
    queryKey: ["inventory"],
    queryFn: listInventory,
    staleTime: 30_000,
  });
  const { data: menus } = useQuery({
    queryKey: ["menus-all"],
    queryFn: () => listMenus(1),
    staleTime: 60_000,
  });
  const { data: revenueHistory = [] } = useQuery({
    queryKey: ["sales-monthly", 36],
    queryFn: () => getMonthlyRevenue(36),
    staleTime: 60_000,
  });

  const [revenuePeriod, setRevenuePeriod] = useState<"month" | "year">("month");
  const monthlyChartData = revenueHistory
    .slice(-12)
    .map((m) => ({ label: m.year_month, revenue: m.revenue }));
  const yearlyChartData = Object.entries(
    revenueHistory.reduce<Record<string, number>>((acc, m) => {
      const year = m.year_month.slice(0, 4);
      acc[year] = (acc[year] ?? 0) + m.revenue;
      return acc;
    }, {}),
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, revenue]) => ({ label: `${year}년`, revenue }));

  const lowStockCount = inventory.filter((i) => i.is_low_stock).length;
  const inventoryPreview = [...inventory]
    .sort((a, b) => Number(b.is_low_stock) - Number(a.is_low_stock))
    .slice(0, 5);
  const hasSalesData = (summary?.total_sales_count ?? 0) > 0;

  const STAT_CARDS = [
    {
      label: "오늘 매출",
      value: won.format(summary?.today_revenue ?? 0),
      icon: Wallet,
    },
    {
      label: "오늘 판매건수",
      value: `${summary?.today_sales_count ?? 0}건`,
      icon: Receipt,
    },
    {
      label: "재고 부족 상품",
      value: `${lowStockCount}개`,
      icon: AlertTriangle,
    },
    {
      label: "등록 메뉴 수",
      value: `${menus?.total ?? 0}개`,
      icon: UtensilsCrossed,
    },
  ];

  return (
    <DashboardShell active="home">
      <div className="space-y-6">
        <nav className="flex flex-wrap gap-3">
          <Link
            to="/settings/pos"
            className="rounded-full bg-[#7a5eff] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#6a4eef]"
          >
            POS 연동 설정
          </Link>
          <Link
            to="/sales/upload"
            className="rounded-full border border-[#d1d5dc] bg-white px-5 py-2.5 text-sm font-medium text-[#364153] hover:bg-[#f3f4f6]"
          >
            매출 CSV 업로드
          </Link>
        </nav>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[#364153]">실시간 최저가 추천</h2>
            <div className="overflow-hidden rounded-xl border border-[#d1d5dc] bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#fafafa] text-[#61646b]">
                  <tr>
                    <th className="px-4 py-3 font-medium">상품명</th>
                    <th className="px-4 py-3 font-medium">현재가</th>
                    <th className="px-4 py-3 font-medium">직전가</th>
                    <th className="px-4 py-3 font-medium">변동률</th>
                    <th className="px-4 py-3 font-medium">추천 공급처</th>
                  </tr>
                </thead>
                <tbody>
                  {ingredientPrices.map((item) => (
                    <tr key={item.item_name} className="border-t border-[#eef1f4]">
                      <td className="px-4 py-3 font-medium text-[#364153]">
                        <span className="flex items-center gap-2">
                          <IngredientIcon itemName={item.item_name} />
                          {item.item_name} ({item.unit})
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#364153]">{won.format(item.price)}</td>
                      <td className="px-4 py-3 text-[#99a1af]">
                        {won.format(previousPrice(item.price, item.change_percent))}
                      </td>
                      <td
                        className={`px-4 py-3 ${
                          item.direction === "UP"
                            ? "text-red-600"
                            : item.direction === "DOWN"
                              ? "text-blue-600"
                              : "text-[#99a1af]"
                        }`}
                      >
                        <span className="flex items-center gap-0.5">
                          {item.direction === "UP" ? (
                            <TrendingUp className="size-3.5" />
                          ) : item.direction === "DOWN" ? (
                            <TrendingDown className="size-3.5" />
                          ) : (
                            <Minus className="size-3.5" />
                          )}
                          {Math.abs(item.change_percent).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#99a1af]">—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-[#99a1af]">
              * KAMIS(한국농수산식품유통공사) 농산물 가격정보 —{" "}
              {ingredientPrices[0] ? "샘플 데이터(실 API 키 연동 전)" : "불러오는 중"}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[#364153]">주요지표</h2>
            <div className="grid grid-cols-2 gap-3">
              {STAT_CARDS.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.label}
                    className="space-y-2 rounded-xl border border-[#d1d5dc] bg-white p-4"
                  >
                    <span className="flex size-9 items-center justify-center rounded-lg bg-[#7a5eff]/10 text-[#7a5eff]">
                      <Icon className="size-4.5" />
                    </span>
                    <p className="text-xs text-[#99a1af]">{card.label}</p>
                    <p className="text-lg font-semibold text-[#101828]">{card.value}</p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[#364153]">이번 달 매출 그래프</h2>
            <RevenueBarChart data={weekly} xKey="week_label" variant="bar" />
          </section>
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[#364153]">일간매출 추이 (최근 7일)</h2>
            <RevenueBarChart data={daily} xKey="date" variant="area" />
          </section>
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[#364153]">인기 메뉴</h2>
            {topMenus.length === 0 ? (
              <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-[#d1d5dc] bg-white text-sm text-[#99a1af]">
                판매 데이터가 연결되면 표시됩니다.
              </div>
            ) : (
              <div className="space-y-2 rounded-xl border border-[#d1d5dc] bg-white p-3">
                {topMenus.map((m, i) => (
                  <div key={m.menu_name} className="flex items-center gap-3 px-1 py-1.5">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#7a5eff]/10 text-xs font-semibold text-[#7a5eff]">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#364153]">{m.menu_name}</p>
                      <p className="text-xs text-[#99a1af]">
                        판매 {m.quantity}개 · {won.format(m.revenue)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#364153]">재고 현황</h2>
              <Link to="/inventory" className="text-sm font-medium text-[#7a5eff] hover:underline">
                전체 보기
              </Link>
            </div>
            {inventoryPreview.length === 0 ? (
              <div className="flex h-[120px] items-center justify-center rounded-xl border border-dashed border-[#d1d5dc] bg-white text-sm text-[#99a1af]">
                등록된 재료가 없습니다.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-[#d1d5dc] bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#fafafa] text-[#61646b]">
                    <tr>
                      <th className="px-4 py-3 font-medium">재료</th>
                      <th className="px-4 py-3 font-medium">현재 수량</th>
                      <th className="px-4 py-3 font-medium">재주문 임계값</th>
                      <th className="px-4 py-3 font-medium">상태</th>
                      <th className="px-4 py-3 font-medium">최근 수정일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryPreview.map((item) => (
                      <tr key={item.item_id} className="border-t border-[#eef1f4]">
                        <td className="px-4 py-3 font-medium text-[#364153]">{item.name}</td>
                        <td className="px-4 py-3 text-[#364153]">
                          {item.current_quantity} {item.unit}
                        </td>
                        <td className="px-4 py-3 text-[#364153]">
                          {item.low_stock_threshold} {item.unit}
                        </td>
                        <td className="px-4 py-3">
                          {item.is_low_stock ? (
                            <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
                              부족
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                              정상
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[#99a1af]">
                          {new Date(item.updated_at).toLocaleDateString("ko-KR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[#364153]">매출분석</h2>
            <div className="space-y-3 rounded-xl border border-[#d1d5dc] bg-white p-4">
              {hasSalesData ? (
                <>
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-[#99a1af]">누적 매출</p>
                      <div className="flex gap-1 rounded-full bg-[#f3f4f6] p-0.5 text-xs">
                        <button
                          type="button"
                          onClick={() => setRevenuePeriod("month")}
                          className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
                            revenuePeriod === "month"
                              ? "bg-white text-[#7a5eff] shadow-sm"
                              : "text-[#99a1af]"
                          }`}
                        >
                          월별
                        </button>
                        <button
                          type="button"
                          onClick={() => setRevenuePeriod("year")}
                          className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
                            revenuePeriod === "year"
                              ? "bg-white text-[#7a5eff] shadow-sm"
                              : "text-[#99a1af]"
                          }`}
                        >
                          연도별
                        </button>
                      </div>
                    </div>
                    <p className="text-lg font-semibold text-[#101828]">
                      {won.format(summary?.total_revenue ?? 0)}
                    </p>
                    <div className="mt-2">
                      <RevenueBarChart
                        data={revenuePeriod === "month" ? monthlyChartData : yearlyChartData}
                        xKey="label"
                        variant="bar"
                      />
                    </div>
                  </div>
                  <div className="border-t border-[#eef1f4] pt-3">
                    <p className="mb-2 text-xs text-[#99a1af]">메뉴별 매출 비중</p>
                    <MenuSharePieChart
                      topMenus={topMenus}
                      totalRevenue={summary?.total_revenue ?? 0}
                    />
                  </div>
                </>
              ) : (
                <p className="text-sm text-[#99a1af]">매출 데이터가 연결되면 표시됩니다.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}
