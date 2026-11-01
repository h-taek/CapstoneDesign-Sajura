// 시간대별 매출 막대 차트 (08_sales.html).
import { useEffect, useRef, useState } from "react";
import type { HourlySalesPoint } from "./calculations";

export interface HourlySalesChartProps {
  data: HourlySalesPoint[];
  height?: number;
}

const CHART_COLOR = {
  brand: "#6b4eff",
  tick: "#6b7280",
  line: "#e3e6eb",
};

export function HourlySalesChart({ data, height = 160 }: HourlySalesChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height });

  useEffect(() => {
    if (!containerRef.current) return;
    if (typeof ResizeObserver === "undefined") {
      setDimensions({ width: 300, height });
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = entry.contentRect.width;
      const h = entry.contentRect.height || height;
      if (w > 0) {
        setDimensions({ width: w, height: h });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [height]);

  if (data.length === 0) {
    return (
      <div
        ref={containerRef}
        style={{ height }}
        className="mt-2 flex w-full items-center justify-center text-xs text-ink-3"
      >
        시간대별 데이터가 없습니다
      </div>
    );
  }

  const values = data.map((d) => d.revenue);
  const labels = data.map((d) => d.label);

  const W = dimensions.width || 300;
  const H = dimensions.height || height;
  const fs = 11; // 11px
  const B = fs + 10; // 하단 레이블 높이
  const maxVal = Math.max(...values, 1) * 1.15;

  const fmt = (v: number) => `${Math.round(v / 10000)}만`;
  const L = Math.max(36, fmt(maxVal).length * 7 + 4);
  const R = 8;
  const bw = Math.min(36, ((W - L - R) / values.length) * 0.6);

  const x = (i: number) => L + ((W - L - R) / values.length) * (i + 0.5);
  const y = (v: number) => 8 + (H - B - 8) * (1 - v / maxVal);

  const ticks = [0, 0.5, 1].map((t) => maxVal * t);
  const step = Math.ceil(labels.length / Math.max(2, Math.min(8, Math.floor((W - L) / 38))));

  return (
    <div ref={containerRef} style={{ height }} className="mt-2 h-40 w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-full w-full overflow-visible"
        aria-label="시간대별 매출 막대 차트"
      >
        <title>시간대별 매출 막대 차트</title>
        {/* Y축 눈금 레이블 */}
        {ticks.map((t) => (
          <text
            key={`tick-${t}`}
            x={L - 6}
            y={y(t) + 4}
            textAnchor="end"
            fontSize={fs}
            fill={CHART_COLOR.tick}
          >
            {fmt(t)}
          </text>
        ))}

        {/* 축 기본 라인 */}
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke={CHART_COLOR.line} />

        {/* X축 레이블 */}
        {labels.map((l, i) =>
          i % step === 0 ? (
            <text
              key={`x-${l}`}
              x={x(i)}
              y={H - 2}
              textAnchor="middle"
              fontSize={fs}
              fill={CHART_COLOR.tick}
            >
              {l}
            </text>
          ) : null,
        )}

        {/* 막대 바 */}
        {values.map((v, i) => {
          const barX = x(i) - bw / 2;
          const barY = y(v);
          const barH = Math.max(0, H - B - barY);
          return (
            <rect
              key={`bar-${data[i]?.label ?? i}`}
              x={barX}
              y={barY}
              width={bw}
              height={barH}
              fill={CHART_COLOR.brand}
              rx={2}
            />
          );
        })}
      </svg>
    </div>
  );
}
