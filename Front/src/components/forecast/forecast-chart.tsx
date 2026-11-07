// 매출 예측 기간 막대 차트 — 목업 07_forecast / mockup.js의 renderChart(bar) 그대로 이식.
// 실제 매출 막대(보라색) + 그날 예측 점선(회색 점선) + (최신 구간일 때) 오늘·내일·모레 예상 막대(연한 보라 + 점선 테두리).
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { ChartTooltip, formatWonFull, useChartHover } from "../charts/chart-hover";

export interface ForecastChartProps {
  labels: string[];
  values: number[];
  predicted: (number | null)[];
  forecastCount?: number;
  height?: number;
  className?: string;
}

const CHART_COLORS = {
  brand: "#6b4eff",
  grid: "#eef0f3",
  tick: "#6b7280",
  line: "#e3e6eb",
};

function formatTickRevenue(v: number): string {
  if (v <= 0) return "0";
  if (v >= 1e8) {
    const eok = v / 1e8;
    return `${eok % 1 === 0 ? eok.toFixed(0) : eok.toFixed(1)}억`;
  }
  if (v >= 1e4) {
    return `${Math.round(v / 1e4)}만`;
  }
  return v.toLocaleString();
}

export function ForecastChart({
  labels,
  values,
  predicted,
  forecastCount = 0,
  height = 192,
  className = "",
}: ForecastChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const hover = useChartHover(containerRef);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateWidth = () => {
      const w = el.clientWidth;
      if (w > 0) setWidth(w);
    };

    updateWidth();
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      updateWidth();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const W = width;
  const H = height;
  const L = 40;
  const R = 8;
  const T = 12;
  const B = 22;
  const fs = 11;

  // 값의 최댓값 계산
  const validPreds = predicted.filter((v): v is number => v !== null && v !== undefined);
  const allNums = [...values, ...validPreds];
  const maxRaw = allNums.length > 0 ? Math.max(...allNums) : 10;
  const max = Math.max(maxRaw * 1.08, 10);
  const lo = 0;

  const y = (v: number) => H - B - ((v - lo) / (max - lo)) * (H - T - B);
  const stepX = values.length > 0 ? (W - L - R) / values.length : 1;
  const x = (i: number) => L + stepX * (i + 0.5);
  const bw = Math.max(3, Math.min(22, stepX * 0.65));

  // Y축 눈금 (0, 25%, 50%, 75%, 100%)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => lo + (max - lo) * t);

  // X축 라벨 스텝 계산 — mockup.js 식 그대로
  const step = Math.max(
    1,
    Math.ceil(labels.length / Math.max(2, Math.min(8, Math.floor((W - L) / ((46 * fs) / 13))))),
  );
  const fromEnd = forecastCount > 0;

  // 예측 구분 경계 인덱스
  const realCount = values.length - forecastCount;

  // 그날 예측 점선 polyline 세그먼트 생성
  const predRuns: { points: string }[] = [];
  let currentRun: string[] = [];

  for (let i = 0; i < predicted.length; i++) {
    const p = predicted[i];
    if (p != null) {
      currentRun.push(`${x(i)},${y(p)}`);
    } else {
      if (currentRun.length > 1) {
        predRuns.push({ points: currentRun.join(" ") });
      }
      currentRun = [];
    }
  }
  if (currentRun.length > 1) {
    predRuns.push({ points: currentRun.join(" ") });
  }

  // 호버/터치한 막대
  const hi = hover.index != null && hover.index < values.length ? hover.index : null;
  const hiValue = hi != null ? (values[hi] ?? 0) : 0;
  const hiPred = hi != null ? (predicted[hi] ?? null) : null;
  const hiIsForecast = hi != null && hi >= realCount;

  return (
    <div ref={containerRef} className={`relative w-full ${className}`} style={{ height: H }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="100%"
        className="block"
        aria-hidden="true"
        {...hover.bind(values.length, x)}
      >
        {/* 호버/터치한 막대 배경 하이라이트 */}
        {hi != null && (
          <rect
            x={x(hi) - stepX / 2}
            y={T}
            width={stepX}
            height={H - T - B}
            fill={CHART_COLORS.brand}
            fillOpacity={0.08}
            pointerEvents="none"
          />
        )}

        {/* Y축 틱 및 텍스트 */}
        {yTicks.map((t, idx) => (
          <text
            // biome-ignore lint/suspicious/noArrayIndexKey: 고정 5개 틱
            key={`ytick-${idx}`}
            x={L - 6}
            y={y(t) + 4}
            textAnchor="end"
            fontSize={fs}
            fill={CHART_COLORS.tick}
          >
            {formatTickRevenue(t)}
          </text>
        ))}

        {/* X축 기준선 */}
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke={CHART_COLORS.line} strokeWidth={1} />

        {/* X축 라벨 */}
        {labels.map((lbl, i) => {
          const show = (fromEnd ? labels.length - 1 - i : i) % step === 0;
          if (!show) return null;
          return (
            <text
              // biome-ignore lint/suspicious/noArrayIndexKey: 라벨 인덱스
              key={`xlabel-${i}`}
              x={x(i)}
              y={H - 6}
              textAnchor="middle"
              fontSize={fs}
              fill={CHART_COLORS.tick}
            >
              {lbl}
            </text>
          );
        })}

        {/* 매출 막대 */}
        {values.map((v, i) => {
          const isForecastBar = i >= realCount;
          const barY = y(v);
          const barHeight = Math.max(0, H - B - barY);
          const barX = x(i) - bw / 2;

          return (
            <rect
              // biome-ignore lint/suspicious/noArrayIndexKey: 막대 인덱스
              key={`bar-${i}`}
              x={barX}
              y={barY}
              width={bw}
              height={barHeight}
              fill={CHART_COLORS.brand}
              fillOpacity={isForecastBar ? 0.22 : 1}
              stroke={isForecastBar ? CHART_COLORS.brand : "none"}
              strokeWidth={isForecastBar ? 1.5 : 0}
              strokeDasharray={isForecastBar ? "4 3" : undefined}
              className="chart-bar"
              style={{ "--i": i } as CSSProperties}
            />
          );
        })}

        {/* 그날 예측 점선 (회색 점선) */}
        {predRuns.map((run, idx) => (
          <polyline
            // biome-ignore lint/suspicious/noArrayIndexKey: 세그먼트 인덱스
            key={`pred-run-${idx}`}
            points={run.points}
            fill="none"
            stroke={CHART_COLORS.tick}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            className="chart-fade"
          />
        ))}
      </svg>

      {hi != null && (
        <ChartTooltip
          x={x(hi)}
          y={y(Math.max(hiValue, hiPred ?? 0))}
          containerWidth={W}
          title={labels[hi] ?? ""}
          rows={[
            { label: hiIsForecast ? "예상" : "실제", value: formatWonFull(hiValue) },
            ...(hiPred != null
              ? [{ label: "그날 예측", value: formatWonFull(hiPred), tone: "muted" as const }]
              : []),
          ]}
        />
      )}
    </div>
  );
}
