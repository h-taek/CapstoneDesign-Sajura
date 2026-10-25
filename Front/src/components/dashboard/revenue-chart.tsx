// 매출·판매건수 그래프 — 실제 GET /api/sales/trends 데이터로 렌더링.
// variant: 막대(주차·월별) / 점선 라인 / 영역(일간 추이). 색은 디자인 토큰(index.css)과 같은 값.
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "../ui/card";

const won = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" });

// recharts는 CSS 변수를 SVG 속성으로 받지 못해 토큰 값을 그대로 쓴다 (index.css @theme와 동일).
export const CHART = {
  brand: "#6b4eff",
  grid: "#eef0f3",
  tick: "#6b7280",
  line: "#e3e6eb",
} as const;

interface RevenuePoint {
  revenue: number;
  sales_count?: number;
}

// "2026-10-23" → "10/23", "2026-10" → "10월"
function shortLabel(v: unknown): string {
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`;
  if (/^\d{4}-\d{2}$/.test(s)) return `${Number(s.slice(5, 7))}월`;
  return s;
}

export function RevenueBarChart({
  data,
  metric = "revenue",
  xKey = "year_month",
  emptyLabel = "매출 데이터가 연결되면 표시됩니다.",
  variant = "bar",
  height = 240,
}: {
  data: RevenuePoint[];
  metric?: "revenue" | "sales_count";
  xKey?: string;
  emptyLabel?: string;
  variant?: "bar" | "dashed-line" | "area";
  height?: number;
}) {
  if (data.length === 0) {
    return <EmptyState className="min-h-[200px]">{emptyLabel}</EmptyState>;
  }

  const isRevenue = metric === "revenue";
  const tickFormatter = (v: number) => (isRevenue ? `${Math.round(v / 10000)}만` : `${v}`);
  const tooltipFormatter = (value: number) => (isRevenue ? won.format(value) : `${value}건`);
  const axis = {
    x: {
      dataKey: xKey,
      tick: { fontSize: 13, fill: CHART.tick },
      axisLine: { stroke: CHART.line },
      tickLine: false,
      tickFormatter: shortLabel,
      minTickGap: 12,
    },
    y: {
      tick: { fontSize: 13, fill: CHART.tick },
      axisLine: false,
      tickLine: false,
      width: 48,
      tickFormatter,
    },
  } as const;
  const tooltip = {
    formatter: tooltipFormatter,
    labelFormatter: shortLabel,
    contentStyle: { borderRadius: 12, borderColor: CHART.line, fontSize: 14 },
  };

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        {variant === "dashed-line" ? (
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis {...axis.x} />
            <YAxis {...axis.y} />
            <Tooltip {...tooltip} />
            <Line
              type="monotone"
              dataKey={metric}
              stroke={CHART.brand}
              strokeWidth={2.5}
              strokeDasharray="6 4"
              dot={{ r: 4, fill: CHART.brand, strokeWidth: 0 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        ) : variant === "area" ? (
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueAreaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART.brand} stopOpacity={0.22} />
                <stop offset="100%" stopColor={CHART.brand} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis {...axis.x} />
            <YAxis {...axis.y} />
            <Tooltip {...tooltip} />
            <Area
              type="monotone"
              dataKey={metric}
              stroke={CHART.brand}
              strokeWidth={2.5}
              fill="url(#revenueAreaFill)"
              dot={false}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        ) : (
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis {...axis.x} />
            <YAxis {...axis.y} />
            <Tooltip {...tooltip} cursor={{ fill: "rgb(107 78 255 / 0.06)" }} />
            <Bar dataKey={metric} fill={CHART.brand} radius={[6, 6, 0, 0]} maxBarSize={36} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
