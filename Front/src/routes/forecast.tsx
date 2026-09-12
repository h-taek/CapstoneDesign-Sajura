// 매출예측 화면 — 참고 대시보드 목업(예측정확도·오차율·누적매출·전월대비 카드 +
// 이번달/지난달 매출 그래프 + 오차율분석/영향요인) 레이아웃에 맞춰 재구성.
// AI 수요예측(D+1~D+3)은 실제 GET /api/forecast/predict(AI 서버 stateless 서빙)로 렌더링.
// 예측 정확도·평균 오차율(과거 예측 대비 실측 누적 비교 지표)·오차율 분석은 아직 없어
// 정직하게 "준비 중"으로 남기고, 나머지는 실제 GET /api/sales/* 데이터로 렌더링한다.
import { useQuery } from "@tanstack/react-query";
import { HTTPError } from "ky";
import { Activity, AlertTriangle, DollarSign, Target, TrendingUp } from "lucide-react";
import { getForecastPredict } from "../api/endpoints/forecast";
import {
  getDailyRevenueForMonth,
  getMonthlyRevenue,
  getSalesSummary,
} from "../api/endpoints/sales";
import { RevenueBarChart } from "../components/dashboard/revenue-chart";
import { DashboardShell } from "../components/dashboard/shell";

const won = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" });
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
  const lastMonthDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 1);
  const lastMonth = yearMonthOf(lastMonthDate);

  const { data: monthly = [] } = useQuery({
    queryKey: ["sales-monthly", 2],
    queryFn: () => getMonthlyRevenue(2),
    staleTime: 60_000,
  });
  const { data: thisMonthDaily = [] } = useQuery({
    queryKey: ["sales-daily-by-month", thisMonth],
    queryFn: () => getDailyRevenueForMonth(thisMonth),
    staleTime: 60_000,
  });
  const { data: lastMonthDaily = [] } = useQuery({
    queryKey: ["sales-daily-by-month", lastMonth],
    queryFn: () => getDailyRevenueForMonth(lastMonth),
    staleTime: 60_000,
  });
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

  const prevMonthPoint = monthly.find((m) => m.year_month === lastMonth);
  const thisMonthPoint = monthly.find((m) => m.year_month === thisMonth);
  const momChangePercent =
    prevMonthPoint && prevMonthPoint.revenue > 0 && thisMonthPoint
      ? ((thisMonthPoint.revenue - prevMonthPoint.revenue) / prevMonthPoint.revenue) * 100
      : null;

  const STAT_CARDS = [
    {
      label: "예측 정확도",
      value: "준비 중",
      icon: Target,
      sub: "AI 서버 연동 후 제공",
    },
    {
      label: "평균 오차율",
      value: "준비 중",
      icon: Activity,
      sub: "AI 서버 연동 후 제공",
    },
    {
      label: "이번 달 누적매출",
      value: won.format(summary?.this_month_revenue ?? 0),
      icon: DollarSign,
      sub: `판매 ${summary?.this_month_sales_count ?? 0}건`,
    },
    {
      label: "전월 대비",
      value:
        momChangePercent === null
          ? "—"
          : `${momChangePercent >= 0 ? "+" : ""}${momChangePercent.toFixed(1)}%`,
      icon: TrendingUp,
      sub: prevMonthPoint ? `전월 ${won.format(prevMonthPoint.revenue)}` : "전월 데이터 없음",
    },
  ];

  return (
    <DashboardShell active="forecast">
      <div className="space-y-8">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-[#101828]">
            매출 그래프 (예측 매출/실제 매출)
          </h1>
          <p className="text-sm text-[#99a1af]">
            AI 수요예측과 실제 업로드된 매출 데이터를 함께 보여줍니다.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                <p className="text-xs text-[#99a1af]">{card.sub}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[#364153]">이번 달 매출 그래프</h2>
            <RevenueBarChart data={thisMonthDaily} xKey="date" variant="area" />
          </section>
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[#364153]">지난 달 매출 그래프</h2>
            <RevenueBarChart data={lastMonthDaily} xKey="date" variant="area" />
          </section>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-[#364153]">AI 수요예측 (D+1~D+3)</h2>
          {forecastLoading ? (
            <p className="text-sm text-[#99a1af]">예측 계산 중…</p>
          ) : forecastError ? (
            <div className="flex items-start gap-2 rounded-xl border border-dashed border-[#d1d5dc] bg-white p-6">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
              <p className="text-sm text-[#99a1af]">{forecastErrorMessage(forecastError)}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {forecast?.predictions.map((p) => (
                <div
                  key={p.target_date}
                  className="space-y-2 rounded-xl border border-[#d1d5dc] bg-white p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-[#364153]">
                      {formatTargetDate(p.target_date)}
                    </p>
                    {p.is_low_confidence && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">
                        신뢰도 낮음
                      </span>
                    )}
                  </div>
                  <p className="text-xl font-semibold text-[#101828]">
                    {won.format(p.predicted_sales)}
                  </p>
                  <p className="text-xs text-[#99a1af]">
                    예측 범위 {won.format(p.interval_p10)} ~ {won.format(p.interval_p90)}
                  </p>
                  <p className="border-t border-[#eef1f4] pt-2 text-xs text-[#61646b]">
                    {p.explanation.sentence}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-[#364153]">오차율 분석 · 영향 요인</h2>
          <div className="rounded-xl border border-dashed border-[#d1d5dc] bg-white p-6">
            <p className="text-sm text-[#99a1af]">
              예측 대비 오차율(정확도 평가)은 과거 예측과 실제 결과를 누적 비교해야 계산되는 지표라,
              예측 자체는 위에서 실시간 제공되지만 이 부분은 운영 데이터가 쌓인 뒤 제공됩니다.
            </p>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
