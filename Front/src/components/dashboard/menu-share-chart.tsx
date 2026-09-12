// 매출 비중 원 그래프 — 인기 메뉴별 매출이 전체에서 차지하는 비율을 실제 데이터로 표시.
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { TopMenuItem } from "../../api/endpoints/sales";

const won = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" });
const OTHER_COLOR = "#d1d5dc";

function rainbowColor(index: number, total: number): string {
  const hue = total <= 1 ? 260 : Math.round((index / total) * 320);
  return `hsl(${hue}, 75%, 60%)`;
}

export function MenuSharePieChart({
  topMenus,
  totalRevenue,
}: {
  topMenus: TopMenuItem[];
  totalRevenue: number;
}) {
  const topSum = topMenus.reduce((sum, m) => sum + m.revenue, 0);
  const rest = Math.max(0, totalRevenue - topSum);
  const slices = [
    ...topMenus.map((m) => ({ name: m.menu_name, value: m.revenue })),
    ...(rest > 0 ? [{ name: "기타", value: rest }] : []),
  ];
  const colors = slices.map((s, i) =>
    s.name === "기타" ? OTHER_COLOR : rainbowColor(i, topMenus.length),
  );

  if (slices.length === 0 || totalRevenue === 0) {
    return <p className="text-sm text-[#99a1af]">매출 데이터가 연결되면 비중이 표시됩니다.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius={40}
              outerRadius={72}
              paddingAngle={2}
            >
              {slices.map((s, i) => (
                <Cell key={s.name} fill={colors[i]} stroke="white" />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [
                `${won.format(value)} (${((value / totalRevenue) * 100).toFixed(1)}%)`,
                name,
              ]}
              contentStyle={{ borderRadius: 8, borderColor: "#eef1f4", fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-1">
        {slices.map((s, i) => (
          <li key={s.name} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-[#364153]">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: colors[i] }} />
              {s.name}
            </span>
            <span className="text-[#99a1af]">{((s.value / totalRevenue) * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
