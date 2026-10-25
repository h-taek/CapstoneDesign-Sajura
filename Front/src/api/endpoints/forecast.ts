// AI 수요예측 API — 02_implementation_design.md §3.7 GET /api/forecast (BE가 §3.8 AI 계약을 프록시).
import { api } from "../../lib/api";
import type { components } from "../types.gen";

type S = components["schemas"];

export type TopFactor = S["TopFactor"];

export type Explanation = S["Explanation"];

export type DailyPrediction = S["DailyPrediction"];

export type ForecastPredictResponse = S["ForecastPredictResponse"];

export async function getForecastPredict(): Promise<ForecastPredictResponse> {
  return api.get("forecast").json<ForecastPredictResponse>();
}
