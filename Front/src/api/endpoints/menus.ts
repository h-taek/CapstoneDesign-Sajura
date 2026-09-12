// 메뉴 API — api_spec.md §4.
import { HTTPError } from "ky";
import { api } from "../../lib/api";

export interface MenuInput {
  name: string;
  category: string;
  price: number;
  is_active: boolean;
  use_inventory_deduction: boolean;
}

export interface BulkMenusResponse {
  created: number;
  skipped: number;
  skipped_names: string[];
}

export async function createMenusBulk(menus: MenuInput[]): Promise<BulkMenusResponse> {
  return api.post("menus/bulk", { json: { menus } }).json<BulkMenusResponse>();
}

export interface MenuListItem {
  menu_id: string;
  name: string;
  category: string | null;
  price: number;
  is_active: boolean;
  use_inventory_deduction: boolean;
  is_deleted: boolean;
}

export interface MenuListResponse {
  items: MenuListItem[];
  total: number;
  page: number;
  size: number;
  total_pages: number;
}

export async function listMenus(size = 100): Promise<MenuListResponse> {
  return api.get("menus", { searchParams: { size } }).json<MenuListResponse>();
}

export interface MenuUpdateInput {
  name?: string;
  category?: string;
  price?: number;
  is_active?: boolean;
  use_inventory_deduction?: boolean;
}

export async function updateMenu(menuId: string, patch: MenuUpdateInput): Promise<MenuListItem> {
  return api.patch(`menus/${menuId}`, { json: patch }).json<MenuListItem>();
}

export interface RecipeIngredient {
  item_id: string;
  item_name: string;
  quantity: number;
  unit: string;
}

export interface RecipeResponse {
  menu_id: string;
  ingredients: RecipeIngredient[];
  updated_at: string;
}

export async function getRecipe(menuId: string): Promise<RecipeResponse | null> {
  try {
    return await api.get(`menus/${menuId}/recipe`).json<RecipeResponse>();
  } catch (err) {
    if (err instanceof HTTPError && err.response.status === 404) return null;
    throw err;
  }
}

export interface RecipeIngredientInput {
  item_id: string;
  quantity: number;
  unit: string;
}

export async function upsertRecipe(
  menuId: string,
  ingredients: RecipeIngredientInput[],
): Promise<RecipeResponse> {
  return api.put(`menus/${menuId}/recipe`, { json: { ingredients } }).json<RecipeResponse>();
}
