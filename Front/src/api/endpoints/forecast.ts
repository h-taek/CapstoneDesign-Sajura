// AI 수요예측 API — 07_api_spec.md §7 GET /api/forecast (BE가 §8 AI 계약을 프록시).
import { api } from "../../lib/api";

export interface TopFactor {
  feature: string;
  label: string;
  pct: number;
}

export interface Explanation {
  baseline: string;
  deviation_vs_baseline: number;
  top_factors: TopFactor[];
  sentence: string;
}

export interface DailyPrediction {
  target_date: string;
  horizon_days: number;
  predicted_sales: number;
  interval_p10: number;
  interval_p90: number;
  is_low_confidence: boolean;
  low_confidence_reason: string | null;
  explanation: Explanation;
}

export interface ForecastPredictResponse {
  predictions: DailyPrediction[];
}

export async function getForecastPredict(): Promise<ForecastPredictResponse> {
  return api.get("forecast").json<ForecastPredictResponse>();
}
