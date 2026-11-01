// 지난달 매출까지 진행률 도넛 — 06_home.html.
import { formatWonShort } from "../../lib/format";

interface MonthProgressDonutProps {
  hasSalesData: boolean;
  thisMonthRevenue: number;
  prevMonthRevenue: number;
}

const CIRCUMFERENCE = 326.7;

export function MonthProgressDonut({
  hasSalesData,
  thisMonthRevenue,
  prevMonthRevenue,
}: MonthProgressDonutProps) {
  const pct = prevMonthRevenue > 0 ? Math.round((thisMonthRevenue / prevMonthRevenue) * 100) : 0;

  const dashLen = ((Math.min(pct, 100) / 100) * CIRCUMFERENCE).toFixed(1);

  return (
    <section className="flex flex-col rounded-2xl p-5 text-white glass-brand lg:col-span-3">
      <h2 className="text-base font-bold">지난달 매출까지</h2>
      {hasSalesData ? (
        <>
          <div className="relative mx-auto mt-3 size-32">
            <svg viewBox="0 0 132 132" className="size-full -rotate-90" aria-hidden="true">
              <circle
                cx="66"
                cy="66"
                r="52"
                fill="none"
                stroke="rgb(255 255 255 / .25)"
                strokeWidth="14"
              />
              <circle
                cx="66"
                cy="66"
                r="52"
                fill="none"
                stroke="#fff"
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={`${dashLen} ${CIRCUMFERENCE}`}
              />
            </svg>
            <p className="tabular absolute inset-0 flex items-center justify-center text-[1.65rem] font-bold">
              {pct}%
            </p>
          </div>
          <p className="tabular mt-auto pt-3 text-center text-sm text-white/85">
            {formatWonShort(thisMonthRevenue)} / 지난달 {formatWonShort(prevMonthRevenue)}
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm text-white/85">매출을 올리면 지난달과 견줘 보여 드려요</p>
      )}
    </section>
  );
}
