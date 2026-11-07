// 오늘 많이 나갈 메뉴 비중 도넛 — 06_home.html.
import { CountUp } from "../ui/count-up";
import { type MenuForecastSlice, buildMenuShareSlices } from "./home-utils";

interface MenuShareDonutProps {
  hasSalesData: boolean;
  menuForecast?: MenuForecastSlice[] | null | undefined;
}

const BRAND_COLOR = "#6b4eff";
const CIRCUMFERENCE = 326.7;

export function MenuShareDonut({ hasSalesData, menuForecast }: MenuShareDonutProps) {
  const { slices, totalQty } = menuForecast
    ? buildMenuShareSlices(menuForecast)
    : { slices: [], totalQty: 0 };

  const hasForecast = slices.length > 0;

  return (
    <section className="flex flex-col rounded-2xl p-5 glass-card lg:col-span-4">
      <h2 className="text-base font-bold text-ink">오늘 많이 나갈 메뉴</h2>
      {hasSalesData && hasForecast ? (
        <div className="@container mt-3 flex flex-1 items-center gap-4">
          <ul className="min-w-0 max-w-40 flex-1 space-y-1.5 text-sm @max-[19rem]:text-xs @max-[15rem]:hidden">
            {slices.map((slice) => (
              <li key={slice.name} className="flex items-center gap-2">
                <span
                  className={
                    slice.isOther
                      ? "size-2.5 shrink-0 rounded-sm bg-ink-4/50"
                      : "size-2.5 shrink-0 rounded-sm bg-brand"
                  }
                  style={slice.isOther ? undefined : { opacity: slice.opacity }}
                />
                <span
                  className={
                    slice.isOther
                      ? "min-w-0 flex-1 truncate text-ink-3"
                      : "min-w-0 flex-1 truncate font-semibold text-ink"
                  }
                >
                  {slice.name}
                </span>
                <span className="tabular text-ink-2 @max-[22rem]:hidden">{slice.pct}%</span>
              </li>
            ))}
          </ul>
          <div className="relative mx-auto aspect-square w-40 max-w-full shrink-0">
            <svg viewBox="0 0 132 132" className="size-full -rotate-90" aria-hidden="true">
              {slices.map((slice) => (
                <circle
                  key={slice.name}
                  cx="66"
                  cy="66"
                  r="52"
                  fill="none"
                  stroke={slice.isOther ? undefined : BRAND_COLOR}
                  strokeOpacity={slice.opacity}
                  strokeWidth="20"
                  strokeDasharray={`${slice.dashLen} ${CIRCUMFERENCE}`}
                  strokeDashoffset={slice.dashOffset}
                  className={slice.isOther ? "chart-ring stroke-ink-4" : "chart-ring"}
                />
              ))}
            </svg>
            <p className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="tabular text-2xl leading-none font-bold text-ink">
                <CountUp
                  value={Math.round(totalQty)}
                  format={(v) => `${v.toLocaleString("ko-KR")}개`}
                />
              </span>
              <span className="mt-1 text-xs text-ink-3">예상 판매</span>
            </p>
          </div>
        </div>
      ) : hasSalesData && menuForecast ? (
        // 예측은 받았는데 메뉴별 수량만 빈 날(메뉴 판매 이력 10영업일 미만 등) — 실패가 아니다
        <p className="mt-4 text-sm text-ink-3">메뉴별 예측이 아직 없어요</p>
      ) : hasSalesData ? (
        <p className="mt-4 text-sm text-ink-3">오늘 예측을 불러오지 못했어요</p>
      ) : (
        <p className="mt-4 text-sm text-ink-3">예측이 나오면 보여 드려요</p>
      )}
    </section>
  );
}
