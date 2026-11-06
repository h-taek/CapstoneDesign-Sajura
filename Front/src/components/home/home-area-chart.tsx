// 오늘 예상 매출 7일 실제 + 오늘 예상 곡선 그래프 — mockup.js renderChart 대응.
import { useEffect, useId, useRef, useState } from "react";
import { ChartTooltip, formatWonFull, useChartHover } from "../charts/chart-hover";

const BRAND_COLOR = "#6b4eff";
const TICK_COLOR = "#6b7280";
const LINE_COLOR = "#e3e6eb";

interface HomeAreaChartProps {
  labels: string[];
  values: number[];
  forecastCount?: number;
  refVal?: number | null;
}

interface Point {
  x: number;
  y: number;
}

export function HomeAreaChart({
  labels,
  values,
  forecastCount = 0,
  refVal = null,
}: HomeAreaChartProps) {
  const gradId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  // viewBox를 실제 렌더 크기와 맞춰 글자가 가로로 찌그러지지 않게 한다 (preserveAspectRatio="none" 제거)
  const [size, setSize] = useState({ w: 600, h: 220 });
  const hasValues = values.length > 0;
  const hover = useChartHover(containerRef);

  // 값이 없으면 컨테이너가 렌더되지 않으므로, 값이 생긴 뒤 다시 측정을 붙인다
  useEffect(() => {
    if (!hasValues) return;
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) {
        setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
      }
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasValues]);

  if (!hasValues) return null;

  const W = size.w;
  const H = size.h;
  const fs = 11;
  const B = fs + 10;

  const maxVal = Math.max(...values, refVal ?? 0) * 1.15 || 1;
  const fmt = (v: number) => `${Math.round(v / 10_000)}만`;

  const L = Math.max(0, (fmt(maxVal).length * 8.5 * fs) / 13 + 8);
  const R = 2;
  const bw = Math.min(36, ((W - L - R) / values.length) * 0.6);

  const getX = (i: number) =>
    values.length > 1
      ? L + 6 + bw / 2 + ((W - R - bw - L - 6) / (values.length - 1)) * i
      : L + (W - L - R) / 2;

  const getY = (v: number) => 8 + (H - B - 8) * (1 - v / maxVal);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => maxVal * t);

  // 글자 폭 추정 — 실측(11px): "10/28" ≈ 28px, "오늘" ≈ 19px
  const half = (l: string) =>
    [...l].reduce((w, c) => w + (/[가-힣]/.test(c) ? fs : fs * 0.52), 0) / 2;

  // 실제 점 간격과 가장 긴 라벨 폭을 비교해, 겹칠 때만 라벨을 건너뛴다
  const spacing = values.length > 1 ? (W - R - bw - L - 6) / (values.length - 1) : W;
  const labelW = Math.max(0, ...labels.map((l) => half(l) * 2)) + 4;
  const step = Math.max(1, Math.ceil(labelW / spacing));
  const fromEnd = forecastCount > 0;
  const lx = (l: string, i: number) => Math.min(Math.max(getX(i), L + half(l)), W - half(l));

  const pts: Point[] = values.map((v, i) => ({ x: getX(i), y: getY(v) }));
  const n = values.length - forecastCount;
  const realPts = pts.slice(0, n);

  const smoothLine = (points: Point[]) => {
    if (points.length < 3) {
      return `M${points.map((p) => `${p.x},${p.y}`).join(" L")}`;
    }
    const first = points[0] ?? { x: 0, y: 0 };
    let d = `M${first.x},${first.y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i - 1] ?? points[i] ?? { x: 0, y: 0 };
      const b = points[i] ?? { x: 0, y: 0 };
      const c = points[i + 1] ?? { x: 0, y: 0 };
      const e = points[i + 2] ?? points[i + 1] ?? { x: 0, y: 0 };
      // 급락 구간에서 곡선이 0선 아래(또는 위쪽 밖)로 튀지 않게 제어점 y를 그래프 영역 안으로 묶는다
      const clampY = (y: number) => Math.min(Math.max(y, 0), H - B);
      const cp1x = b.x + (c.x - a.x) / 6;
      const cp1y = clampY(b.y + (c.y - a.y) / 6);
      const cp2x = c.x - (e.x - b.x) / 6;
      const cp2y = clampY(c.y - (e.y - b.y) / 6);
      d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${c.x.toFixed(1)},${c.y.toFixed(1)}`;
    }
    return d;
  };

  const realLinePath = smoothLine(realPts);
  const forecastPts = pts.slice(Math.max(0, n - 1));
  const forecastLinePath = smoothLine(forecastPts);

  // 호버/터치한 점
  const hi = hover.index != null && hover.index < values.length ? hover.index : null;
  const hiPt = hi != null ? pts[hi] : undefined;
  const hiIsForecast = hi != null && hi >= n;

  return (
    <div ref={containerRef} className="relative mt-2 h-56 w-full lg:h-auto lg:min-h-56 lg:flex-1">
      {/* absolute로 띄워 SVG 크기가 부모 높이 계산에 되먹임되지 않게 한다 */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
        {...hover.bind(values.length, getX)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={BRAND_COLOR} stopOpacity="0.22" />
            <stop offset="1" stopColor={BRAND_COLOR} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Y축 눈금 라벨 */}
        {ticks.map((t) => (
          <text key={t} x={L - 6} y={getY(t) + 4} textAnchor="end" fontSize={fs} fill={TICK_COLOR}>
            {fmt(t)}
          </text>
        ))}

        {/* 가로 기준 축선 */}
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke={LINE_COLOR} />

        {/* X축 라벨 */}
        {labels.map((label, i) => {
          const visible = (fromEnd ? labels.length - 1 - i : i) % step === 0;
          if (!visible) return null;
          return (
            <text
              key={label}
              x={lx(label, i)}
              y={H - 2}
              textAnchor="middle"
              fontSize={fs}
              fill={TICK_COLOR}
            >
              {label}
            </text>
          );
        })}

        {/* 평소 기준선 */}
        {refVal != null && (
          <line
            x1={L}
            x2={W - R}
            y1={getY(refVal)}
            y2={getY(refVal)}
            stroke={TICK_COLOR}
            strokeOpacity="0.7"
            strokeWidth="1.5"
            strokeDasharray="6 5"
          />
        )}

        {/* 실제 매출 영역 채우기 */}
        {realPts.length > 0 && (
          <path
            d={`${realLinePath} L${getX(n - 1)},${H - B} L${getX(0)},${H - B}Z`}
            fill={`url(#${gradId})`}
          />
        )}

        {/* 실제 매출 곡선 실선 */}
        {realPts.length > 0 && (
          <path d={realLinePath} fill="none" stroke={BRAND_COLOR} strokeWidth="2.5" />
        )}

        {/* 오늘 예측 연결 점선 */}
        {forecastCount > 0 && forecastPts.length > 1 && (
          <path
            d={forecastLinePath}
            fill="none"
            stroke={BRAND_COLOR}
            strokeWidth="2.5"
            strokeDasharray="6 4"
          />
        )}

        {/* 호버/터치 표시 — 세로 안내선 + 점 */}
        {hiPt && (
          <g pointerEvents="none">
            <line
              x1={hiPt.x}
              x2={hiPt.x}
              y1={8}
              y2={H - B}
              stroke={TICK_COLOR}
              strokeOpacity="0.5"
              strokeDasharray="3 3"
            />
            <circle
              cx={hiPt.x}
              cy={hiPt.y}
              r={5}
              fill={hiIsForecast ? "#fff" : BRAND_COLOR}
              stroke={BRAND_COLOR}
              strokeWidth={2}
            />
          </g>
        )}
      </svg>

      {hi != null && hiPt && (
        <ChartTooltip
          x={hiPt.x}
          y={hiPt.y}
          containerWidth={W}
          title={labels[hi] ?? ""}
          rows={[
            {
              label: hiIsForecast ? "예상" : "실제",
              value: formatWonFull(values[hi] ?? 0),
            },
            ...(refVal != null
              ? [{ label: "평소", value: formatWonFull(refVal), tone: "muted" as const }]
              : []),
          ]}
        />
      )}
    </div>
  );
}
