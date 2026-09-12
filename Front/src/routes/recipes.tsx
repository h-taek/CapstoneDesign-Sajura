// 레시피관리 화면 — Figma "레시피 관리"(node 9:1231) 셸 적용.
// 메뉴 목록 → 선택한 메뉴의 레시피(재료 구성)를 실제 GET/PUT /api/menus/{id}/recipe로 연결.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { listInventory } from "../api/endpoints/inventory";
import {
  type MenuListItem,
  type RecipeIngredientInput,
  getRecipe,
  listMenus,
  upsertRecipe,
} from "../api/endpoints/menus";
import { DashboardShell } from "../components/dashboard/shell";
import { Button } from "../components/ui/button";

export default function RecipesPage() {
  const { data: menuList } = useQuery({
    queryKey: ["menus-all"],
    queryFn: () => listMenus(100),
  });
  const menus = menuList?.items ?? [];
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedMenuId && menus[0]) setSelectedMenuId(menus[0].menu_id);
  }, [menus, selectedMenuId]);

  const selectedMenu = menus.find((m) => m.menu_id === selectedMenuId) ?? null;

  return (
    <DashboardShell active="recipes">
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[#101828]">레시피 관리</h1>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          <section className="space-y-2 rounded-xl border border-[#d1d5dc] bg-white p-2">
            {menus.length === 0 ? (
              <p className="p-4 text-sm text-[#99a1af]">등록된 메뉴가 없습니다.</p>
            ) : (
              menus.map((m) => (
                <button
                  key={m.menu_id}
                  type="button"
                  onClick={() => setSelectedMenuId(m.menu_id)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm ${
                    m.menu_id === selectedMenuId
                      ? "bg-[#7a5eff]/10 font-medium text-[#7a5eff]"
                      : "text-[#364153] hover:bg-[#f3f4f6]"
                  }`}
                >
                  <span>{m.name}</span>
                  <span className="text-xs text-[#99a1af]">{m.category ?? ""}</span>
                </button>
              ))
            )}
          </section>

          {selectedMenu ? (
            <RecipeEditor key={selectedMenu.menu_id} menu={selectedMenu} />
          ) : (
            <div className="flex items-center justify-center rounded-xl border border-dashed border-[#d1d5dc] bg-white p-10 text-sm text-[#99a1af]">
              왼쪽에서 메뉴를 선택하세요.
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

function RecipeEditor({ menu }: { menu: MenuListItem }) {
  const queryClient = useQueryClient();
  const { data: recipe, isLoading } = useQuery({
    queryKey: ["recipe", menu.menu_id],
    queryFn: () => getRecipe(menu.menu_id),
  });
  const { data: inventory = [] } = useQuery({
    queryKey: ["inventory"],
    queryFn: listInventory,
  });

  const [rows, setRows] = useState<RecipeIngredientInput[]>([]);

  useEffect(() => {
    if (recipe) {
      setRows(
        recipe.ingredients.map((i) => ({ item_id: i.item_id, quantity: i.quantity, unit: i.unit })),
      );
    } else if (recipe === null) {
      setRows([]);
    }
  }, [recipe]);

  const saveMutation = useMutation({
    mutationFn: () =>
      upsertRecipe(
        menu.menu_id,
        rows.filter((r) => r.item_id),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recipe", menu.menu_id] }),
  });

  const addRow = () => {
    const first = inventory[0];
    if (!first) return;
    setRows((r) => [...r, { item_id: first.item_id, quantity: 0, unit: first.unit }]);
  };

  const updateRow = (idx: number, patch: Partial<RecipeIngredientInput>) => {
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const removeRow = (idx: number) => {
    setRows((r) => r.filter((_, i) => i !== idx));
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-[#d1d5dc] bg-white p-6 text-sm text-[#99a1af]">
        불러오는 중…
      </div>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-[#d1d5dc] bg-white p-6">
      <div>
        <h2 className="text-lg font-semibold text-[#101828]">{menu.name}</h2>
        <p className="text-sm text-[#99a1af]">
          {menu.use_inventory_deduction ? "재고 차감 사용 — 레시피 등록 필요" : "재고 차감 미사용"}
        </p>
      </div>

      {inventory.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[#d1d5dc] p-4 text-sm text-[#99a1af]">
          먼저 재고관리에서 재료를 등록해야 레시피를 구성할 수 있습니다.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, idx) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: 행 자체가 식별자 없는 로컬 편집 상태
            <div key={idx} className="flex items-center gap-2">
              <select
                value={row.item_id}
                onChange={(e) => {
                  const item = inventory.find((i) => i.item_id === e.target.value);
                  updateRow(idx, { item_id: e.target.value, unit: item?.unit ?? row.unit });
                }}
                className="h-10 flex-1 rounded-lg border border-[#d1d5dc] px-2 text-sm"
              >
                {inventory.map((i) => (
                  <option key={i.item_id} value={i.item_id}>
                    {i.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="any"
                min={0}
                value={row.quantity}
                onChange={(e) => updateRow(idx, { quantity: Number(e.target.value) })}
                className="h-10 w-24 rounded-lg border border-[#d1d5dc] px-2 text-sm"
              />
              <span className="w-10 text-sm text-[#99a1af]">{row.unit}</span>
              <button
                type="button"
                onClick={() => removeRow(idx)}
                aria-label="재료 삭제"
                className="text-[#99a1af] hover:text-red-600"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <Button
            type="button"
            onClick={addRow}
            className="h-9 rounded-full border border-[#d1d5dc] bg-white px-4 text-sm text-[#364153] hover:bg-[#f3f4f6]"
          >
            <Plus className="size-4" /> 재료 추가
          </Button>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="h-10 rounded-full bg-[#7a5eff] px-6 font-semibold hover:bg-[#6a4eef]"
        >
          {saveMutation.isPending ? "저장 중…" : "레시피 저장"}
        </Button>
      </div>
      {saveMutation.isError && (
        <p className="text-sm text-red-600" role="alert">
          저장에 실패했습니다. 재고 차감 사용 메뉴는 재료가 1개 이상 필요합니다.
        </p>
      )}
    </section>
  );
}
