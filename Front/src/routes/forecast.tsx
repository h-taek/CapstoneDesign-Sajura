// 매출예측 화면 — 참고 대시보드 목업(예측정확도·오차율·누적매출·전월대비 카드 +
// 이번달/지난달 매출 그래프 + 오차율분석/영향요인) 레이아웃에 맞춰 재구성.
// AI 수요예측(D+1~D+3)은 실제 GET /api/forecast(AI 서버 stateless 서빙)로 렌더링.
// 예측 정확도·평균 오차율(과거 예측 대비 실측 누적 비교 지표)·오차율 분석은 아직 없어
// 정직하게 "준비 중"으로 남기고, 나머지는 실제 GET /api/sales/* 데이터로 렌더링한다.
import { useQuery } from "@tanstack/react-query";
import { HTTPError } from "ky";
import { Activity, AlertTriangle, CalendarDays, Sparkles, Target, TrendingUp } from "lucide-react";
import { useState } from "react";
import { getForecastPredict } from "../api/endpoints/forecast";
import { getSalesSummary, getSalesTrends } from "../api/endpoints/sales";
import { RevenueBarChart } from "../components/dashboard/revenue-chart";
import { DashboardShell } from "../components/dashboard/shell";
import {
  Card,
  EmptyState,
  PageHeader,
  SectionTitle,
  Segmented,
  StatCard,
} from "../components/ui/card";
import { formatWon, formatWonShort } from "../lib/format";
import { cn } from "../lib/utils";

const HORIZON_LABEL: Record<number, string> = { 1: "다음 날", 2: "이틀 뒤", 3: "사흘 뒤" };
const DOW_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function formatTargetDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일(${DOW_LABELS[d.getDay()]})`;
}

function forecastErrorMessage(error: unknown): string {
  if (error instanceof HTTPError && error.response.status === 422) {
    return "AI 예측에 필요한 판매 이력이 부족합니다 (최소 10일 이상 필요).";
  }
  return "AI 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.";
}

function yearMonthOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function ForecastPage() {
  const { data: summary } = useQuery({
    queryKey: ["sales-summary"],
    queryFn: getSalesSummary,
    staleTime: 60_000,
  });

  // "이번 달"은 실제 오늘이 아니라 이 매장의 마지막 판매일 기준 — 과거 구간 시연/테스트
  // 데이터를 올려도 항상 실데이터가 채워지게 한다 (summary 로딩 전엔 실제 오늘로 임시 대체).
  const referenceDate = summary?.last_sale_at ? new Date(summary.last_sale_at) : new Date();
  const thisMonth = yearMonthOf(referenceDate);
  const thisMonthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const thisMonthEnd = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
  const lastMonthDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 1);
  const lastMonthEnd = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 0);
  const lastMonth = yearMonthOf(lastMonthDate);
  const trendsEnabled = summary !== undefined;

  const { data: monthlyTrend } = useQuery({
    queryKey: ["sales-trends", "month", lastMonth, thisMonth],
    queryFn: () => getSalesTrends(lastMonthDate, thisMonthEnd, "month"),
    enabled: trendsEnabled,
    staleTime: 60_000,
  });
  const { data: thisMonthTrend } = useQuery({
    queryKey: ["sales-trends", "day", thisMonth],
    queryFn: () => getSalesTrends(thisMonthStart, thisMonthEnd, "day"),
    enabled: trendsEnabled,
    staleTime: 60_000,
  });
  const { data: lastMonthTrend } = useQuery({
    queryKey: ["sales-trends", "day", lastMonth],
    queryFn: () => getSalesTrends(lastMonthDate, lastMonthEnd, "day"),
    enabled: trendsEnabled,
    staleTime: 60_000,
  });
  const monthly = monthlyTrend?.data ?? [];
  const thisMonthDaily = thisMonthTrend?.data ?? [];
  const lastMonthDaily = lastMonthTrend?.data ?? [];
  const {
    data: forecast,
    isLoading: forecastLoading,
    error: forecastError,
  } = useQuery({
    queryKey: ["ai-forecast-predict"],
    queryFn: getForecastPredict,
    staleTime: 60_000,
    retry: false,
  });

  const prevMonthPoint = monthly.find((m) => m.date.startsWith(lastMonth));
  const thisMonthPoint = monthly.find((m) => m.date.startsWith(thisMonth));
  const momChangePercent =
    prevMonthPoint && prevMonthPoint.revenue > 0 && thisMonthPoint
      ? ((thisMonthPoint.revenue - prevMonthPoint.revenue) / prevMonthPoint.revenue) * 100
      : null;

  const [chartMonth, setChartMonth] = useState<"this" | "last">("this");
  const momLabel =
    momChangePercent === null
      ? "—"
      : `${momChangePercent >= 0 ? "+" : ""}${momChangePercent.toFixed(1)}%`;

  return (
    <DashboardShell active="forecast">
      <div className="space-y-6 lg:space-y-8">
        <PageHeader
          title="매출 예측"
          description="AI가 앞으로 3일 매출을 미리 계산해 드려요. 실제 매출과 함께 비교해 보세요."
        />

        <section className="space-y-4">
          <SectionTitle
            title="앞으로 3일 예상 매출"
            badge={
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-0.5 text-sm font-semibold text-brand">
                <Sparkles className="size-3.5" /> AI
              </span>
            }
          />
          {forecastLoading ? (
            <EmptyState>예측 계산 중…</EmptyState>
          ) : forecastError ? (
            <EmptyState>
              <AlertTriangle className="size-6 text-warn" />
              {forecastErrorMessage(forecastError)}
            </EmptyState>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:gap-4">
              {forecast?.predictions.map((p, i) => (
                <Card
                  key={p.target_date}
                  className={cn(
                    "space-y-3 p-5 lg:p-6",
                    i === 0 && "border-brand ring-2 ring-brand-soft",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-base font-bold text-ink">
                      <CalendarDays className="size-5 text-brand" />
                      {formatTargetDate(p.target_date)}
                    </p>
                    {p.is_low_confidence ? (
                      <span className="rounded-full bg-warn-soft px-2.5 py-0.5 text-sm font-semibold text-warn">
                        신뢰도 낮음
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-sm font-semibold",
                          i === 0 ? "bg-brand text-white" : "bg-subtle text-ink-3",
                        )}
                      >
                        {HORIZON_LABEL[p.horizon_days] ?? `${p.horizon_days}일 뒤`}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="tabular text-[2rem] leading-tight font-bold tracking-tight text-ink">
                      {formatWonShort(p.predicted_sales)}
                    </p>
                    <p className="text-sm text-ink-3">
                      예상 범위 {formatWon(p.interval_p10)} ~ {formatWon(p.interval_p90)}
                    </p>
                  </div>
                  <p className="rounded-xl bg-subtle px-4 py-3 text-[0.95rem] leading-relaxed text-ink-2">
                    {p.explanation.sentence}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </section>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <StatCard
            label="이번 달 누적매출"
            value={formatWonShort(summary?.this_month_revenue ?? 0)}
            sub={`판매 ${summary?.this_month_sales_count ?? 0}건`}
            icon={TrendingUp}
            tone="brand"
          />
          <StatCard
            label="전월 대비"
            value={momLabel}
            sub={
              prevMonthPoint ? `전월 ${formatWonShort(prevMonthPoint.revenue)}` : "전월 데이터 없음"
            }
            icon={CalendarDays}
          />
          <StatCard label="예측 정확도" value="준비 중" sub="데이터가 쌓이면 제공" icon={Target} />
          <StatCard
            label="평균 오차율"
            value="준비 중"
            sub="데이터가 쌓이면 제공"
            icon={Activity}
          />
        </div>

        <Card as="section" className="space-y-4 p-5 lg:p-6">
          <SectionTitle
            title="매출 그래프"
            description={
              chartMonth === "this" ? `${thisMonth} 일별 매출` : `${lastMonth} 일별 매출`
            }
            action={
              <Segmented
                label="그래프 기간"
                value={chartMonth}
                onChange={setChartMonth}
                options={[
                  { value: "this", label: "이번 달" },
                  { value: "last", label: "지난 달" },
                ]}
              />
            }
          />
          <RevenueBarChart
            data={chartMonth === "this" ? thisMonthDaily : lastMonthDaily}
            xKey="date"
            variant="area"
            height={280}
          />
        </Card>

        <Card as="section" className="space-y-2 p-5 lg:p-6">
          <SectionTitle title="오차율 분석 · 영향 요인" />
          <p className="text-[0.95rem] leading-relaxed text-ink-3">
            예측 대비 오차율(정확도 평가)은 과거 예측과 실제 결과를 누적 비교해야 계산되는 지표라,
            예측 자체는 위에서 실시간 제공되지만 이 부분은 운영 데이터가 쌓인 뒤 제공됩니다.
          </p>
        </Card>
      </div>
    </DashboardShell>
  );
}
