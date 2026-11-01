// AI 수요예측 API — 02_implementation_design.md §3.7 GET /api/forecast, POST /api/forecast/run.
import { api } from "../../lib/api";
import type { components } from "../types.gen";

type S = components["schemas"];

export type TopFactor = S["TopFactor"];

export type Explanation = S["Explanation"];

export type DailyPrediction = S["DailyPrediction"];

export type ForecastPredictResponse = S["ForecastPredictResponse"];

// GET /api/forecast — 저장된 예측. targetDate(YYYY-MM-DD)를 주면 그 날짜만
export async function getForecastPredict(targetDate?: string): Promise<ForecastPredictResponse> {
  const searchParams = targetDate ? { target_date: targetDate } : undefined;
  return api.get("forecast", { searchParams }).json<ForecastPredictResponse>();
}

// POST /api/forecast/run — 수요예측 수동 실행 (워크플로우 완료까지 대기하므로 타임아웃 120s).
export async function runForecast(): Promise<ForecastPredictResponse> {
  return api.post("forecast/run", { timeout: 120_000 }).json<ForecastPredictResponse>();
}
