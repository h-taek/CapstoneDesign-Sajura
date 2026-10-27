// 메뉴 API — 02_implementation_design.md §3.4.
import { HTTPError } from "ky";
import { api } from "../../lib/api";
import type { components } from "../types.gen";

type S = components["schemas"];

export type MenuInput = S["MenuCreateRequest"];

export type BulkMenusResponse = S["BulkMenuResponse"];

export async function createMenusBulk(menus: MenuInput[]): Promise<BulkMenusResponse> {
  return api.post("menus/bulk", { json: { menus } }).json<BulkMenusResponse>();
}

export type MenuListItem = S["MenuListItem"];

export type MenuListResponse = S["MenuListResponse"];

export async function listMenus(size = 100): Promise<MenuListResponse> {
  return api.get("menus", { searchParams: { size } }).json<MenuListResponse>();
}

export async function createMenu(input: MenuInput): Promise<MenuListItem> {
  return api.post("menus", { json: input }).json<MenuListItem>();
}

export async function deleteMenu(menuId: string): Promise<void> {
  await api.delete(`menus/${menuId}`);
}

export type MenuUpdateInput = S["MenuUpdateRequest"];

export async function updateMenu(menuId: string, patch: MenuUpdateInput): Promise<MenuListItem> {
  return api.patch(`menus/${menuId}`, { json: patch }).json<MenuListItem>();
}

export type RecipeIngredient = S["IngredientItemWithName"];

export type RecipeResponse = S["RecipeResponse"];

export async function getRecipe(menuId: string): Promise<RecipeResponse | null> {
  try {
    return await api.get(`menus/${menuId}/recipe`).json<RecipeResponse>();
  } catch (err) {
    if (err instanceof HTTPError && err.response.status === 404) return null;
    throw err;
  }
}

export type RecipeIngredientInput = S["IngredientItem"];

export async function upsertRecipe(
  menuId: string,
  ingredients: RecipeIngredientInput[],
): Promise<RecipeResponse> {
  return api.put(`menus/${menuId}/recipe`, { json: { ingredients } }).json<RecipeResponse>();
}
