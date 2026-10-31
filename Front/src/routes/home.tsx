// 홈 화면 — 리디자인 v2.
// 맨 위 "오늘 할 일" 한 줄 → 큰 숫자 KPI → 그래프·인기 메뉴 → 재고 순서.
// 전부 실제 GET /api/sales/{summary,trends,top-menus} · /api/inventory · /api/orders/recommend
// 데이터로 렌더링하며,
// 시스템에 없는 값(신규 고객·추천 공급처 등)은 가짜로 채우지 않는다.
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Receipt,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { listInventory } from "../api/endpoints/inventory";
import { getAIRecommend } from "../api/endpoints/orders";
import { getSalesSummary, getSalesTrends, getTopMenus } from "../api/endpoints/sales";
import { RevenueBarChart } from "../components/dashboard/revenue-chart";
import { DashboardShell } from "../components/dashboard/shell";
import { AlertBadge } from "../components/inventory/alert-badge";
import { stockStatus } from "../components/inventory/stock-status";
import { InstallBanner } from "../components/pwa/install-banner";
import {
  Card,
  EmptyState,
  MoreLink,
  PageHeader,
  SectionTitle,
  Segmented,
  StatCard,
} from "../components/ui/card";
import { formatQty, formatWon, formatWonShort } from "../lib/format";
import { cn } from "../lib/utils";

export default function HomePage() {
  const { data: summary } = useQuery({
    queryKey: ["sales-summary"],
    queryFn: getSalesSummary,
    staleTime: 60_000,
  });
  // "이번 달"·"최근 7일"은 실제 오늘이 아니라 이 매장의 마지막 판매일 기준 — 과거 구간
  // 시연/테스트 데이터를 올려도 항상 실데이터가 채워지게 한다. summary가 와야 기간이 정해진다.
  const ref = summary?.last_sale_at ? new Date(summary.last_sale_at) : new Date();
  const refDay = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const trendsEnabled = summary !== undefined;
  const { data: weeklyTrend } = useQuery({
    queryKey: ["sales-trends", "this-month-weekly", refDay.getTime()],
    queryFn: () =>
      getSalesTrends(new Date(refDay.getFullYear(), refDay.getMonth(), 1), refDay, "week"),
    enabled: trendsEnabled,
    staleTime: 60_000,
  });
  const { data: dailyTrend } = useQuery({
    queryKey: ["sales-trends", "last-7-days", refDay.getTime()],
    queryFn: () =>
      getSalesTrends(
        new Date(refDay.getFullYear(), refDay.getMonth(), refDay.getDate() - 6),
        refDay,
        "day",
      ),
    enabled: trendsEnabled,
    staleTime: 60_000,
  });
  const weekly = (weeklyTrend?.data ?? []).map((p, i) => ({
    week_label: `${i + 1}주차`,
    revenue: p.revenue,
  }));
  const daily = dailyTrend?.data ?? [];
  const { data: topMenus = [] } = useQuery({
    queryKey: ["top-menus"],
    queryFn: () => getTopMenus(4),
    staleTime: 60_000,
  });
  const { data: inventory = [] } = useQuery({
    queryKey: ["inventory"],
    queryFn: listInventory,
    staleTime: 30_000,
  });
  // 오늘 할 일 — AI 발주 추천 중 수량이 0보다 큰 재료 수 (예측이 없으면 재고 경고로 대신 안내)
  const { data: aiRecommend } = useQuery({
    queryKey: ["ai-orders-recommend"],
    queryFn: getAIRecommend,
    staleTime: 60_000,
    retry: false,
  });
  const { data: monthlyTrend } = useQuery({
    queryKey: ["sales-trends", "36-months", refDay.getTime()],
    queryFn: () =>
      getSalesTrends(new Date(refDay.getFullYear(), refDay.getMonth() - 35, 1), refDay, "month"),
    enabled: trendsEnabled,
    staleTime: 60_000,
  });
  const revenueHistory = monthlyTrend?.data ?? [];

  const [revenuePeriod, setRevenuePeriod] = useState<"month" | "year">("month");
  const monthlyChartData = revenueHistory
    .slice(-12)
    .map((m) => ({ label: m.date.slice(0, 7), revenue: m.revenue }));
  const yearlyChartData = Object.entries(
    revenueHistory.reduce<Record<string, number>>((acc, m) => {
      const year = m.date.slice(0, 4);
      acc[year] = (acc[year] ?? 0) + m.revenue;
      return acc;
    }, {}),
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, revenue]) => ({ label: `${year}년`, revenue }));

  const today = new Date();
  const alerting = (i: (typeof inventory)[number]) => stockStatus(i, today) !== "NORMAL";
  const lowStockCount = inventory.filter(alerting).length;
  const inventoryPreview = [...inventory]
    .sort((a, b) => Number(alerting(b)) - Number(alerting(a)))
    .slice(0, 5);
  const orderCount = aiRecommend?.recommendations.filter((r) => r.recommended_quantity > 0).length;
  const hasSalesData = (summary?.total_sales_count ?? 0) > 0;
  const lastSale = summary?.last_sale_at ? new Date(summary.last_sale_at) : null;
  const topMenuMax = Math.max(1, ...topMenus.map((m) => m.revenue));

  return (
    <DashboardShell active="home">
      <div className="space-y-6 lg:space-y-8">
        <PageHeader
          title="오늘의 매장 현황"
          description={
            lastSale ? (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-4" />
                마지막 판매 {lastSale.toLocaleDateString("ko-KR")} 기준
              </span>
            ) : (
              "매출을 올리면 오늘의 현황이 채워집니다."
            )
          }
          actions={
            <>
              <Link
                to="/settings/pos"
                className="inline-flex h-11 items-center rounded-xl border border-line bg-white px-4 text-[0.95rem] font-semibold text-ink-2 hover:bg-subtle"
              >
                POS 연동 설정
              </Link>
              <Link
                to="/sales/upload"
                className="inline-flex h-11 items-center rounded-xl bg-brand px-4 text-[0.95rem] font-semibold text-white hover:bg-brand-strong lg:hidden"
              >
                매출 CSV 업로드
              </Link>
            </>
          }
        />

        <TodoBanner orderCount={orderCount} alertCount={lowStockCount} />

        <InstallBanner />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <StatCard
            label="오늘 매출"
            value={formatWonShort(summary?.today_revenue ?? 0)}
            sub={formatWon(summary?.today_revenue ?? 0)}
            icon={Wallet}
            tone="brand"
          />
          <StatCard
            label="오늘 판매건수"
            value={`${summary?.today_sales_count ?? 0}건`}
            icon={Receipt}
          />
          <StatCard
            label="이번 달 누적"
            value={formatWonShort(summary?.this_month_revenue ?? 0)}
            sub={`판매 ${summary?.this_month_sales_count ?? 0}건`}
            icon={CalendarDays}
          />
          <StatCard
            label="재고 경고 품목"
            value={`${lowStockCount}개`}
            icon={AlertTriangle}
            tone={lowStockCount > 0 ? "warn" : "default"}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card as="section" className="space-y-4 p-5 lg:col-span-2 lg:p-6">
            <SectionTitle title="이번 달 매출 그래프" description="주차별 매출" />
            <RevenueBarChart data={weekly} xKey="week_label" variant="bar" />
          </Card>

          <Card as="section" className="space-y-4 p-5 lg:p-6">
            <SectionTitle title="인기 메뉴" description="매출 상위 4개" />
            {topMenus.length === 0 ? (
              <EmptyState>판매 데이터가 연결되면 표시됩니다.</EmptyState>
            ) : (
              <ol className="space-y-4">
                {topMenus.map((m, i) => (
                  <li key={m.menu_name} className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                          i === 0 ? "bg-brand text-white" : "bg-brand-soft text-brand",
                        )}
                      >
                        {i + 1}
                      </span>
                      <p className="min-w-0 flex-1 truncate text-base font-semibold text-ink">
                        {m.menu_name}
                      </p>
                      <p className="tabular text-sm font-semibold text-ink-2">
                        {formatWon(m.revenue)}
                      </p>
                    </div>
                    <div className="ml-10 flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-subtle">
                        <div
                          className="h-full rounded-full bg-brand"
                          style={{ width: `${(m.revenue / topMenuMax) * 100}%` }}
                        />
                      </div>
                      <span className="w-14 text-right text-sm text-ink-3">{m.quantity}개</span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card as="section" className="space-y-4 p-5 lg:p-6">
            <SectionTitle
              title="재고 현황"
              description="부족한 재료가 위에 보여요"
              action={<MoreLink to="/inventory" />}
            />
            {inventoryPreview.length === 0 ? (
              <EmptyState>등록된 재료가 없습니다.</EmptyState>
            ) : (
              <ul className="divide-y divide-line-soft">
                {inventoryPreview.map((item) => (
                  <li key={item.item_id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-ink">{item.name}</p>
                      <p className="text-sm text-ink-3">
                        기준 {formatQty(item.low_stock_threshold)}
                        {item.unit}
                        <span className="hidden sm:inline">
                          {" "}
                          · {new Date(item.updated_at).toLocaleDateString("ko-KR")} 수정
                        </span>
                      </p>
                    </div>
                    <p className="tabular text-base font-bold text-ink">
                      {formatQty(item.total_quantity)}
                      <span className="ml-0.5 text-sm font-medium text-ink-3">{item.unit}</span>
                    </p>
                    <AlertBadge status={stockStatus(item, today)} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card as="section" className="hidden space-y-4 p-5 lg:block lg:p-6">
            <SectionTitle title="일간 매출 추이" description="최근 7일" />
            <RevenueBarChart data={daily} xKey="date" variant="area" />
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card as="section" className="hidden space-y-4 p-5 lg:block lg:p-6">
            <SectionTitle
              title="누적 매출"
              action={
                hasSalesData ? (
                  <Segmented
                    label="누적 매출 기간"
                    value={revenuePeriod}
                    onChange={setRevenuePeriod}
                    options={[
                      { value: "month", label: "월별" },
                      { value: "year", label: "연도별" },
                    ]}
                  />
                ) : null
              }
            />
            {hasSalesData ? (
              <>
                <p className="tabular text-[1.65rem] font-bold tracking-tight text-ink">
                  {formatWon(summary?.total_revenue ?? 0)}
                </p>
                <RevenueBarChart
                  data={revenuePeriod === "month" ? monthlyChartData : yearlyChartData}
                  xKey="label"
                  variant="bar"
                  height={220}
                />
              </>
            ) : (
              <EmptyState>매출 데이터가 연결되면 표시됩니다.</EmptyState>
            )}
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}

/** 오늘 할 일 — 화면 맨 위에서 다음 행동 하나만 크게 알려준다. */
function TodoBanner({
  orderCount,
  alertCount,
}: {
  orderCount: number | undefined;
  alertCount: number;
}) {
  const todo =
    orderCount !== undefined && orderCount > 0
      ? { to: "/orders", text: `발주가 필요한 재료가 ${orderCount}개 있어요`, cta: "발주하러 가기" }
      : alertCount > 0
        ? {
            to: "/inventory",
            text: `확인이 필요한 재료가 ${alertCount}개 있어요`,
            cta: "재고 보러 가기",
          }
        : null;
  if (todo === null) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-5 shadow-card">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ok-soft text-ok">
          <CheckCircle2 className="size-6" />
        </span>
        <p className="text-base font-semibold text-ink lg:text-lg">
          오늘은 급하게 발주할 재료가 없어요.
        </p>
      </div>
    );
  }
  return (
    <Link
      to={todo.to}
      className="group flex flex-col gap-4 rounded-2xl bg-brand p-5 text-white shadow-pop sm:flex-row sm:items-center lg:p-6"
    >
      <div className="flex flex-1 items-center gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/15">
          <AlertTriangle className="size-6" />
        </span>
        <div>
          <p className="text-sm font-medium text-white/80">오늘 할 일</p>
          <p className="text-lg font-bold lg:text-xl">{todo.text}</p>
        </div>
      </div>
      <span className="inline-flex h-12 items-center justify-center gap-1.5 rounded-xl bg-white px-5 text-base font-bold text-brand-strong group-hover:bg-brand-soft">
        {todo.cta} <ArrowRight className="size-5" />
      </span>
    </Link>
  );
}
