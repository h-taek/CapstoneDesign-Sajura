// 메뉴 관리 순수 계산 로직 (04_fe.md §4.5, §7.0).
import type { MenuListItem } from "../../api/endpoints/menus";

export type MenuFilter = "all" | "no-recipe";

export interface CategoryGroup {
  category: string;
  items: MenuListItem[];
}

/**
 * 검색어와 레시피 여부 보기 필터를 적용하고,
 * 카테고리별로 묶어 정렬한다.
 * - 검색어: 메뉴명에 검색어가 든 메뉴 (공백·대소문자 무시)
 * - 보기: 전체 / 레시피 없음
 * - 카테고리: 가나다순, 없는 메뉴는 맨 뒤 "카테고리 없음"
 * - 카테고리 안: 메뉴명 가나다순
 * - 걸러진 메뉴가 없는 카테고리 묶음은 제외된다.
 */
export function groupAndFilterMenus(
  menus: MenuListItem[],
  query: string,
  filter: MenuFilter,
): {
  groups: CategoryGroup[];
  totalFilteredCount: number;
  totalAllCount: number;
  noRecipeCount: number;
} {
  const normQuery = query.replace(/\s+/g, "").toLowerCase();

  const totalAllCount = menus.length;
  const noRecipeCount = menus.filter((m) => !m.has_recipe).length;

  const filtered = menus.filter((menu) => {
    if (filter === "no-recipe" && menu.has_recipe) {
      return false;
    }
    if (normQuery) {
      const normName = menu.name.replace(/\s+/g, "").toLowerCase();
      if (!normName.includes(normQuery)) {
        return false;
      }
    }
    return true;
  });

  const categoryMap = new Map<string, MenuListItem[]>();

  for (const menu of filtered) {
    const cat = menu.category?.trim() || "";
    const list = categoryMap.get(cat);
    if (list) {
      list.push(menu);
    } else {
      categoryMap.set(cat, [menu]);
    }
  }

  const sortedCategories = Array.from(categoryMap.keys()).sort((a, b) => {
    if (a === "" && b === "") return 0;
    if (a === "") return 1; // "카테고리 없음" 맨 뒤
    if (b === "") return -1;
    return a.localeCompare(b, "ko");
  });

  const groups: CategoryGroup[] = sortedCategories.map((catKey) => {
    const items = categoryMap.get(catKey) ?? [];
    items.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    return {
      category: catKey === "" ? "카테고리 없음" : catKey,
      items,
    };
  });

  return {
    groups,
    totalFilteredCount: filtered.length,
    totalAllCount,
    noRecipeCount,
  };
}
