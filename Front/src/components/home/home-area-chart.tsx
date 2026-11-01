// 오늘 예상 매출 7일 실제 + 오늘 예상 곡선 그래프 — mockup.js renderChart 대응.
import { useId } from "react";

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

  if (values.length === 0) return null;

  const W = 600;
  const H = 220;
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

  const step = Math.ceil(
    labels.length / Math.max(2, Math.min(8, Math.floor((W - L) / ((46 * fs) / 13)))),
  );
  const fromEnd = forecastCount > 0;

  const half = (l: string) =>
    [...l].reduce((w, c) => w + (/[가-힣]/.test(c) ? fs : fs * 0.6), 0) / 2;
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
      const cp1x = b.x + (c.x - a.x) / 6;
      const cp1y = b.y + (c.y - a.y) / 6;
      const cp2x = c.x - (e.x - b.x) / 6;
      const cp2y = c.y - (e.y - b.y) / 6;
      d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${c.x.toFixed(1)},${c.y.toFixed(1)}`;
    }
    return d;
  };

  const realLinePath = smoothLine(realPts);
  const forecastPts = pts.slice(Math.max(0, n - 1));
  const forecastLinePath = smoothLine(forecastPts);

  return (
    <div className="mt-2 h-56 w-full lg:h-auto lg:min-h-56 lg:flex-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        aria-hidden="true"
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
      </svg>
    </div>
  );
}
