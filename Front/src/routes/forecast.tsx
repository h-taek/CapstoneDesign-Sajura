// 매출 예측 화면 — v2 목업 07_forecast 이식.
// 기간별 매출(주·월·년 막대 + 그날 예측 점선 + 3일 예상 막대) + 앞으로 3일 예상 매출 + 메뉴별 예상 판매.
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { type ForecastActualPoint, getForecastVsActual } from "../api/endpoints/dashboard";
import { type DailyPrediction, getForecastPredict } from "../api/endpoints/forecast";
import { getSalesSummary } from "../api/endpoints/sales";
import { ForecastChart } from "../components/forecast/forecast-chart";
import {
  type MenuShareCardItem,
  type PeriodRange,
  buildMenuShareItems,
  buildPeriodView,
  calcYesterdayAccuracy,
  forecastErrorMessage,
  formatIntervalRange,
  formatMonthDay,
  formatTargetDate,
  getPeriodBounds,
  horizonDayLabel,
  lowConfidenceTooltip,
  parseLocalDate,
} from "../components/forecast/forecast-logic";
import { MainShell } from "../components/shell";
import { formatWonShort } from "../lib/format";

export default function ForecastPage() {
  const [range, setRange] = useState<PeriodRange>("month");
  const [back, setBack] = useState(0);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  // 판매 요약 — 마지막 판매일(last_sale_at)을 기준으로 삼는다.
  const { data: summary } = useQuery({
    queryKey: ["sales-summary"],
    queryFn: getSalesSummary,
    staleTime: 60_000,
  });

  const refDate = useMemo(() => {
    return summary?.last_sale_at ? parseLocalDate(summary.last_sale_at) : new Date();
  }, [summary?.last_sale_at]);

  const bounds = useMemo(() => {
    return getPeriodBounds(range, back, refDate);
  }, [range, back, refDate]);

  // 기간별 예측 vs 실제 매출 조회
  const { data: forecastVsActualData } = useQuery({
    queryKey: [
      "forecast-vs-actual",
      range,
      back,
      bounds.queryStart.toISOString(),
      bounds.queryEnd.toISOString(),
    ],
    queryFn: () => getForecastVsActual(bounds.queryStart, bounds.queryEnd),
    staleTime: 60_000,
  });

  const points: ForecastActualPoint[] = useMemo(() => {
    return forecastVsActualData?.data ?? [];
  }, [forecastVsActualData]);

  // AI 3일 매출 예측 조회
  const {
    data: forecastData,
    isLoading: forecastLoading,
    error: forecastError,
  } = useQuery({
    queryKey: ["ai-forecast-predict"],
    queryFn: () => getForecastPredict(),
    staleTime: 60_000,
    retry: false,
  });

  const predictions: DailyPrediction[] = useMemo(() => {
    return forecastData?.predictions ?? [];
  }, [forecastData]);

  // 기간 매출 뷰 모델
  const periodView = useMemo(() => {
    return buildPeriodView(range, back, refDate, points);
  }, [range, back, refDate, points]);

  // 차트 데이터 구성 (latest인 경우 끝에 오늘·내일·모레 예상 막대 추가)
  const chartProps = useMemo(() => {
    if (periodView.latest && predictions.length > 0) {
      const fcLabels = predictions.map((p, idx) => horizonDayLabel(p.horizon_days, idx));
      const fcValues = predictions.map((p) => p.predicted_sales);
      return {
        labels: [...periodView.labels, ...fcLabels],
        values: [...periodView.values, ...fcValues],
        predicted: [...periodView.predicted, null, null, null],
        forecastCount: fcValues.length,
      };
    }
    return {
      labels: periodView.labels,
      values: periodView.values,
      predicted: periodView.predicted,
      forecastCount: 0,
    };
  }, [periodView, predictions]);

  // 어제 예측 정확도 (points 중 마지막 포인트 기준)
  const yesterdayAccuracy = useMemo(() => {
    const lastPoint = points.length > 0 ? points[points.length - 1] : undefined;
    return calcYesterdayAccuracy(lastPoint);
  }, [points]);

  // 선택된 일자의 메뉴별 예측 카드 목록
  const selectedPrediction: DailyPrediction | undefined =
    predictions[selectedDayIndex] ?? predictions[0];

  const menuShareItems: MenuShareCardItem[] = useMemo(() => {
    if (!selectedPrediction?.menu_forecast) return [];
    return buildMenuShareItems(selectedPrediction.menu_forecast);
  }, [selectedPrediction]);

  // 상단 반영 기준일 문구
  const reflectedDateLabel = useMemo(() => {
    if (summary?.last_sale_at) {
      return `${formatMonthDay(parseLocalDate(summary.last_sale_at))} 판매까지 반영했어요`;
    }
    return `${formatMonthDay(refDate)} 판매까지 반영했어요`;
  }, [summary?.last_sale_at, refDate]);

  const handleRangeChange = (newRange: PeriodRange) => {
    setRange(newRange);
    setBack(0);
  };

  const handleStep = (step: number) => {
    setBack((prev) => Math.max(0, prev + step));
  };

  return (
    <MainShell active="forecast">
      {/* 머리글 — 반영 기준(마지막 판매일) */}
      <header className="mb-3 space-y-1">
        <h1 className="hidden text-xl font-bold tracking-tight text-ink lg:block lg:text-[1.75rem]">
          매출 예측
        </h1>
        <p className="text-[0.95rem] text-ink-2">{reflectedDateLabel}</p>
      </header>

      <div className="grid gap-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* 기간 매출 섹션 (웹 2열) */}
          <section className="flex flex-col rounded-2xl p-4 glass-card lg:col-span-2">
            <div className="flex flex-1 flex-col gap-5 lg:flex-row">
              <div className="flex flex-col lg:w-[38%]">
                <div className="-ml-1.5 flex h-6 items-center gap-0.5">
                  <button
                    type="button"
                    aria-label="이전 기간"
                    disabled={!periodView.canBack}
                    onClick={() => handleStep(1)}
                    className="flex size-6 items-center justify-center rounded-full text-ink-2 hover:bg-white/60 disabled:text-ink-4 disabled:hover:bg-transparent"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <p className="tabular text-sm font-semibold text-ink-2">{periodView.label}</p>
                  <button
                    type="button"
                    aria-label="다음 기간"
                    disabled={back === 0}
                    onClick={() => handleStep(-1)}
                    className="flex size-6 items-center justify-center rounded-full text-ink-2 hover:bg-white/60 disabled:text-ink-4 disabled:hover:bg-transparent"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>

                <p className="tabular mt-2 text-[2.25rem] leading-none font-bold tracking-tight text-ink">
                  {formatWonShort(periodView.total)}
                </p>
                <p className="tabular mt-2.5 text-sm text-ink-3">
                  판매 {Math.round(periodView.total / 22000).toLocaleString()}건
                </p>
                <p
                  title="날짜마다 1 − |예측 − 실제| ÷ 실제의 평균"
                  className="tabular mt-1 text-sm text-ink-2"
                >
                  예측 정확도{" "}
                  {periodView.accuracy !== null ? (
                    <span className="font-semibold text-brand">{periodView.accuracy}%</span>
                  ) : (
                    <span className="text-ink-3">-</span>
                  )}
                </p>

                <div className="mt-6 lg:mt-auto">
                  {periodView.prev !== null && periodView.prev > 0 ? (
                    <>
                      <div className="h-2 rounded-full bg-brand/15">
                        <div
                          className="h-full rounded-full bg-brand"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round((periodView.total / periodView.prev) * 100),
                            )}%`,
                          }}
                        />
                      </div>
                      <p className="tabular mt-2 text-sm text-ink-3">
                        {periodView.prevName} {formatWonShort(periodView.prev)}의{" "}
                        <span className="font-semibold text-brand">
                          {Math.round((periodView.total / periodView.prev) * 100)}%
                        </span>
                      </p>
                    </>
                  ) : (
                    <p className="tabular text-sm text-ink-3">
                      {periodView.avg !== null
                        ? `월 평균 ${formatWonShort(periodView.avg)}`
                        : "비교할 직전 기간이 없어요"}
                    </p>
                  )}
                </div>
              </div>

              {/* 오른쪽 차트 영역 */}
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex h-6 items-center justify-between gap-2 text-xs">
                  <p className="flex items-center gap-3 text-ink-3">
                    <span className="font-semibold text-ink-2">{periodView.unit}</span>
                    <span className="inline-flex items-center gap-1">
                      <span className="size-2.5 rounded-sm bg-brand" />
                      실제
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-3 border-t-2 border-dashed border-ink-3" />
                      그날 예측
                    </span>
                    {periodView.latest && (
                      <span className="inline-flex items-center gap-1">
                        <span className="size-2.5 rounded-sm border border-dashed border-brand bg-brand/20" />
                        예상
                      </span>
                    )}
                  </p>
                  <div
                    role="tablist"
                    aria-label="그래프 기간"
                    className="inline-flex rounded-lg bg-white/50 p-0.5"
                  >
                    {(["week", "month", "year"] as const).map((r) => {
                      const active = range === r;
                      const label = r === "week" ? "주" : r === "month" ? "월" : "년";
                      return (
                        <button
                          key={r}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => handleRangeChange(r)}
                          className={`rounded-md px-2.5 py-0.5 text-xs font-semibold transition-colors ${
                            active ? "bg-brand-soft text-brand" : "text-ink-3 hover:text-ink-2"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-2 h-48 w-full">
                  <ForecastChart
                    labels={chartProps.labels}
                    values={chartProps.values}
                    predicted={chartProps.predicted}
                    forecastCount={chartProps.forecastCount}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* 앞으로 3일 예상 매출 섹션 (웹 1열) */}
          <section className="@container flex flex-col rounded-2xl px-2 pt-4 pb-2 glass-card">
            <div className="flex items-center justify-between gap-2 px-2">
              <h2 className="text-base font-bold text-ink">앞으로 3일 예상 매출</h2>
              {yesterdayAccuracy && (
                <span
                  title={yesterdayAccuracy.title}
                  className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand"
                >
                  어제 정확도 {yesterdayAccuracy.pct}%
                </span>
              )}
            </div>

            {forecastLoading && (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-6 text-center text-sm text-ink-3">
                예측 계산 중…
              </div>
            )}

            {!forecastLoading && forecastError && (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-6 text-center text-sm text-ink-3">
                <AlertTriangle className="size-6 text-warn" />
                {forecastErrorMessage(forecastError)}
              </div>
            )}

            {!forecastLoading && !forecastError && predictions.length > 0 && (
              <ul className="mt-3 flex flex-1 flex-col justify-between gap-1">
                {predictions.map((p, idx) => {
                  const isSelected = selectedDayIndex === idx;
                  const dayName = horizonDayLabel(p.horizon_days, idx);
                  const dateLabel = formatTargetDate(p.target_date);
                  // deviation_vs_baseline·pct는 비율이다(0.12 = 12%) — 02_implementation_design.md §3.7
                  const deviation = p.explanation?.deviation_vs_baseline;
                  const deviationPct = deviation != null ? Math.round(Math.abs(deviation) * 100) : 0;
                  const deviationText =
                    deviation == null
                      ? null
                      : deviationPct === 0
                        ? "평소 수준"
                        : `평소보다 ${deviationPct}% ${deviation > 0 ? "높음" : "낮음"}`;

                  const factorsText = (p.explanation?.top_factors ?? [])
                    .map((f) => {
                      const pct = Math.round(f.pct * 100);
                      return `${f.label} ${pct > 0 ? `+${pct}` : pct}%`;
                    })
                    .join(" · ");

                  return (
                    <li key={p.target_date}>
                      <button
                        type="button"
                        onClick={() => setSelectedDayIndex(idx)}
                        className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors ${
                          isSelected ? "bg-white/60" : "hover:bg-white/40"
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 text-[0.95rem] font-semibold text-ink">
                            {dayName}
                            <span className="font-normal text-ink-3">{dateLabel}</span>
                            {p.low_confidence_reason && (
                              <span
                                title={lowConfidenceTooltip(p.low_confidence_reason)}
                                className="shrink-0"
                              >
                                <span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs font-semibold text-warn @max-[24rem]:hidden">
                                  신뢰도 낮음
                                </span>
                                <span
                                  role="img"
                                  aria-label="신뢰도 낮음"
                                  className="hidden size-2 rounded-full bg-warn @max-[24rem]:block"
                                />
                              </span>
                            )}
                          </span>
                          <span
                            title={p.explanation?.sentence ?? ""}
                            className="mt-0.5 line-clamp-2 text-xs text-ink-3 lg:line-clamp-1"
                          >
                            {deviationText && (
                              <span
                                className={`font-semibold ${
                                  (deviation ?? 0) < 0 ? "text-down" : "text-brand"
                                }`}
                              >
                                {deviationText}
                              </span>
                            )}
                            {deviationText && factorsText && " · "}
                            {factorsText}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="tabular block text-base font-bold text-ink">
                            {formatWonShort(p.predicted_sales)}
                          </span>
                          <span className="tabular block text-xs text-ink-3">
                            {formatIntervalRange(p.interval_p10, p.interval_p90)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* 메뉴별 예상 판매 섹션 */}
        {forecastLoading || forecastError || !selectedPrediction ? (
          <div className="flex min-h-[120px] items-center justify-center rounded-2xl px-6 py-8 text-center text-sm text-ink-3 glass-card">
            메뉴별 예측도 함께 기다리고 있어요
          </div>
        ) : (
          <>
            <h2 className="px-1 text-base font-bold text-ink">
              {formatTargetDate(selectedPrediction.target_date)} 메뉴별 예상 판매
            </h2>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {menuShareItems.map((item) => (
                <li
                  key={item.menu_id}
                  className="flex flex-col items-center rounded-2xl px-4 pt-4 pb-5 text-center glass-card"
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span
                      className={`flex size-7 items-center justify-center rounded-lg text-sm font-bold ${
                        item.rank === 1 ? "bg-brand text-white" : "bg-white/70 text-ink-2"
                      }`}
                    >
                      {item.rank}
                    </span>
                  </div>
                  <div className="relative mt-2 size-24">
                    <svg viewBox="0 0 88 88" className="size-full -rotate-90" aria-hidden="true">
                      <circle
                        cx="44"
                        cy="44"
                        r="36"
                        fill="none"
                        strokeWidth="9"
                        className="stroke-brand/15"
                      />
                      <circle
                        cx="44"
                        cy="44"
                        r="36"
                        fill="none"
                        strokeWidth="9"
                        strokeLinecap="round"
                        strokeDasharray={item.strokeDasharray}
                        className="stroke-brand"
                      />
                    </svg>
                    <span className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="tabular text-lg leading-none font-bold text-ink">
                        {item.sharePct}%
                      </span>
                      <span className="mt-1 text-xs text-ink-3">비중</span>
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 w-full text-[0.95rem] font-semibold break-keep text-ink lg:truncate">
                    {item.menu_name}
                  </p>
                  <p className="tabular mt-0.5 text-sm text-ink-3">
                    예상 {item.expected_quantity}개
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </MainShell>
  );
}
