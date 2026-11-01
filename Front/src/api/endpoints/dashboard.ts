// 대시보드 API — 02_implementation_design.md §3.9.
import { api } from "../../lib/api";
import type { components } from "../types.gen";

type S = components["schemas"];

export type ForecastActualPoint = S["ForecastActualPoint"];

export type ForecastVsActualResponse = S["ForecastVsActualResponse"];

function isoDate(d: Date | string): string {
  if (typeof d === "string") return d;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// GET /api/dashboard/forecast-vs-actual — 날짜별 예측 매출과 실제 매출 비교.
export async function getForecastVsActual(
  startDate: Date | string,
  endDate: Date | string,
): Promise<ForecastVsActualResponse> {
  return api
    .get("dashboard/forecast-vs-actual", {
      searchParams: {
        start_date: isoDate(startDate),
        end_date: isoDate(endDate),
      },
    })
    .json<ForecastVsActualResponse>();
}
