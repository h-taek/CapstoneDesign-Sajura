// 매출·판매건수 그래프 — 실제 GET /api/sales/{monthly,weekly-this-month,daily} 데이터로 렌더링.
// variant: 막대(주차별) / 점선 라인(매출예측) / 영역(일간 추이).
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

const won = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" });

interface RevenuePoint {
  revenue: number;
  sales_count?: number;
}

export function RevenueBarChart({
  data,
  metric = "revenue",
  xKey = "year_month",
  emptyLabel = "매출 데이터가 연결되면 표시됩니다.",
  variant = "bar",
}: {
  data: RevenuePoint[];
  metric?: "revenue" | "sales_count";
  xKey?: string;
  emptyLabel?: string;
  variant?: "bar" | "dashed-line" | "area";
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-[#d1d5dc] bg-white text-sm text-[#99a1af]">
        {emptyLabel}
      </div>
    );
  }

  const isRevenue = metric === "revenue";
  const tickFormatter = (v: number) => (isRevenue ? `${Math.round(v / 10000)}만` : `${v}`);
  const tooltipFormatter = (value: number) => (isRevenue ? won.format(value) : `${value}건`);

  return (
    <div className="h-[220px] rounded-xl bg-white p-3">
      <ResponsiveContainer width="100%" height="100%">
        {variant === "dashed-line" ? (
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#eef1f4" />
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 12, fill: "#9ba5b7" }}
              axisLine={{ stroke: "#eef1f4" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#9ba5b7" }}
              axisLine={false}
              tickLine={false}
              width={44}
              tickFormatter={tickFormatter}
            />
            <Tooltip
              formatter={tooltipFormatter}
              contentStyle={{ borderRadius: 8, borderColor: "#eef1f4", fontSize: 12 }}
            />
            <Line
              type="monotone"
              dataKey={metric}
              stroke="#7a5eff"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={{ r: 4, fill: "#7a5eff", strokeWidth: 0 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        ) : variant === "area" ? (
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueAreaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7a5eff" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#7a5eff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#eef1f4" />
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 12, fill: "#9ba5b7" }}
              axisLine={{ stroke: "#eef1f4" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#9ba5b7" }}
              axisLine={false}
              tickLine={false}
              width={44}
              tickFormatter={tickFormatter}
            />
            <Tooltip
              formatter={tooltipFormatter}
              contentStyle={{ borderRadius: 8, borderColor: "#eef1f4", fontSize: 12 }}
            />
            <Area
              type="monotone"
              dataKey={metric}
              stroke="#7a5eff"
              strokeWidth={2}
              fill="url(#revenueAreaFill)"
              dot={{ r: 3, fill: "#7a5eff", strokeWidth: 0 }}
            />
          </AreaChart>
        ) : (
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#eef1f4" />
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 12, fill: "#9ba5b7" }}
              axisLine={{ stroke: "#eef1f4" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#9ba5b7" }}
              axisLine={false}
              tickLine={false}
              width={44}
              tickFormatter={tickFormatter}
            />
            <Tooltip
              formatter={tooltipFormatter}
              contentStyle={{ borderRadius: 8, borderColor: "#eef1f4", fontSize: 12 }}
            />
            <Bar dataKey={metric} fill="#7a5eff" radius={[6, 6, 0, 0]} maxBarSize={40} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
