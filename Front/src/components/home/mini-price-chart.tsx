// 쿠팡 단가 추세 30일 미니 곡선 그래프 — mockup.js renderChart auto/noX/noY 대응.
import { useId } from "react";

const BRAND_COLOR = "#6b4eff";
const LINE_COLOR = "#e3e6eb";

interface MiniPriceChartProps {
  values: number[];
}

interface Point {
  x: number;
  y: number;
}

export function MiniPriceChart({ values }: MiniPriceChartProps) {
  const gradId = useId();

  if (values.length < 2) return null;

  const W = 160;
  const H = 72;
  const B = 2;
  const L = 0;
  const R = 2;

  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const span = maxVal - minVal || maxVal * 0.1 || 1;
  const lo = minVal - span * 0.35;
  const hi = maxVal + span * 0.25;

  const getX = (i: number) => 2 + ((W - 4) / (values.length - 1)) * i;
  const getY = (v: number) => 8 + (H - B - 8) * (1 - (v - lo) / (hi - lo));

  const pts: Point[] = values.map((v, i) => ({ x: getX(i), y: getY(v) }));

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

  const linePath = smoothLine(pts);

  return (
    <div className="mt-3 h-20 w-full">
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

        <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke={LINE_COLOR} />

        <path
          d={`${linePath} L${getX(values.length - 1)},${H - B} L${getX(0)},${H - B}Z`}
          fill={`url(#${gradId})`}
        />
        <path d={linePath} fill="none" stroke={BRAND_COLOR} strokeWidth="2" />
      </svg>
    </div>
  );
}
