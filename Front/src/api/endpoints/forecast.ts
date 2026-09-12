// AI 수요예측·발주추천 API — api_spec.md §8 (BE 프록시, /api/forecast/*).
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
  return api.get("forecast/predict").json<ForecastPredictResponse>();
}

export interface MenuForecastItem {
  menu_id: string;
  menu_name: string;
  expected_quantity: number;
}

export interface OrderRecommendation {
  item_id: string;
  item_name: string;
  unit: string;
  recommended_quantity: number;
  expected_stockout_date: string | null;
  lead_time_days: number;
  safety_stock: number;
  config_status: string;
  recommendation_reason: string;
}

export interface AIRecommendResponse {
  target_dates: string[];
  is_low_confidence: boolean;
  low_confidence_reason: string | null;
  menu_forecast: MenuForecastItem[];
  recommendations: OrderRecommendation[];
}

export async function getAIRecommend(): Promise<AIRecommendResponse> {
  return api.get("forecast/recommend").json<AIRecommendResponse>();
}
