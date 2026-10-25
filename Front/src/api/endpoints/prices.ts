// 식자재 가격 API — 홈 화면 "실시간 최저가 추천" (KAMIS 연동).
import { api } from "../../lib/api";
import type { components } from "../types.gen";

type S = components["schemas"];

export type IngredientPrice = S["IngredientPriceResponse"];

export async function getIngredientPrices(): Promise<IngredientPrice[]> {
  return api.get("prices/ingredients").json<IngredientPrice[]>();
}
