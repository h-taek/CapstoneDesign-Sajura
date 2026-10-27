// 메뉴 관리 — 메뉴명·판매가·카테고리와 레시피(재료 구성)를 한 화면에서 편집한다.
// 메뉴는 /api/menus, 레시피는 GET/PUT /api/menus/{id}/recipe.
// 재고 차감은 레시피(재료 1개 이상)를 저장한 메뉴만 켤 수 있다 (01_basic_design.md §3.2).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HTTPError } from "ky";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { listInventory } from "../api/endpoints/inventory";
import {
  type MenuListItem,
  type RecipeIngredientInput,
  createMenu,
  deleteMenu,
  getRecipe,
  listMenus,
  updateMenu,
  upsertRecipe,
} from "../api/endpoints/menus";
import { DashboardShell } from "../components/dashboard/shell";
import { Button } from "../components/ui/button";
import { formatWon } from "../lib/format";
import { cn } from "../lib/utils";

const NEW = "new";

const inputClass =
  "block h-11 w-full rounded-xl border border-line bg-white px-3 text-base text-ink focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none";

function saveErrorMessage(error: unknown): string {
  if (error instanceof HTTPError && error.response.status === 409) {
    return "같은 이름의 메뉴가 이미 있습니다.";
  }
  return "저장에 실패했습니다. 재고 차감을 켠 메뉴는 재료가 1개 이상 필요합니다.";
}

export default function MenusPage() {
  const { data: menuList } = useQuery({
    queryKey: ["menus-all"],
    queryFn: () => listMenus(100),
  });
  const menus = menuList?.items ?? [];
  // 선택한 메뉴 id, 새 메뉴 작성 중이면 NEW
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId && menus[0]) setSelectedId(menus[0].menu_id);
  }, [menus, selectedId]);

  const selectedMenu = menus.find((m) => m.menu_id === selectedId) ?? null;

  return (
    <DashboardShell active="menus">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="hidden text-[1.75rem] font-bold tracking-tight text-ink lg:block">
            메뉴 관리
          </h1>
          <Button size="lg" onClick={() => setSelectedId(NEW)} className="w-full lg:w-auto">
            <Plus className="size-5" />
            메뉴 추가
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          <section className="space-y-2 rounded-xl border border-line bg-white p-2">
            {selectedId === NEW && (
              <div className="flex w-full items-center justify-between rounded-lg bg-brand-soft px-3 py-2.5 text-sm font-medium text-brand">
                <span>새 메뉴</span>
                <span>—</span>
              </div>
            )}
            {menus.length === 0 && selectedId !== NEW ? (
              <p className="p-4 text-sm text-ink-3">등록된 메뉴가 없습니다.</p>
            ) : (
              menus.map((m) => {
                const on = m.menu_id === selectedId;
                return (
                  <button
                    key={m.menu_id}
                    type="button"
                    onClick={() => setSelectedId(m.menu_id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm",
                      on ? "bg-brand-soft font-medium text-brand" : "text-ink-2 hover:bg-subtle",
                    )}
                  >
                    <span>{m.name}</span>
                    <span className={cn("tabular shrink-0", !on && "text-ink-3")}>
                      {formatWon(m.price)}
                    </span>
                  </button>
                );
              })
            )}
          </section>

          {selectedId === NEW ? (
            <MenuEditor
              key={NEW}
              menu={null}
              onSaved={setSelectedId}
              onClosed={() => setSelectedId(null)}
            />
          ) : selectedMenu ? (
            <MenuEditor
              key={selectedMenu.menu_id}
              menu={selectedMenu}
              onSaved={setSelectedId}
              onClosed={() => setSelectedId(null)}
            />
          ) : (
            <div className="flex items-center justify-center rounded-xl border border-dashed border-line bg-white p-10 text-sm text-ink-3">
              왼쪽에서 메뉴를 선택하세요.
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

/** menu가 null이면 새 메뉴. 저장하면 메뉴 칸과 레시피를 함께 저장한다. */
function MenuEditor({
  menu,
  onSaved,
  onClosed,
}: {
  menu: MenuListItem | null;
  onSaved: (menuId: string) => void;
  onClosed: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: recipe, isLoading } = useQuery({
    queryKey: ["recipe", menu?.menu_id],
    queryFn: () => getRecipe(menu?.menu_id ?? ""),
    enabled: menu !== null,
  });
  const { data: inventory = [] } = useQuery({
    queryKey: ["inventory"],
    queryFn: listInventory,
  });

  const [name, setName] = useState(menu?.name ?? "");
  const [price, setPrice] = useState(menu ? String(menu.price) : "");
  const [category, setCategory] = useState(menu?.category ?? "");
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

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["menus-all"] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const fields = { name: name.trim(), price: Number(price), category: category.trim() || null };
      const saved = menu ? await updateMenu(menu.menu_id, fields) : await createMenu(fields);
      const ingredients = rows.filter((r) => r.item_id);
      // 레시피가 없던 메뉴에 재료도 없으면 레시피를 만들지 않는다
      if (ingredients.length > 0 || menu?.has_recipe) {
        await upsertRecipe(saved.menu_id, ingredients);
      }
      return saved;
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["recipe", saved.menu_id] });
      refresh(); // has_recipe 갱신
      onSaved(saved.menu_id);
    },
  });
  const deductionMutation = useMutation({
    mutationFn: (on: boolean) => updateMenu(menu?.menu_id ?? "", { use_inventory_deduction: on }),
    onSuccess: refresh,
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteMenu(menu?.menu_id ?? ""),
    onSuccess: () => {
      refresh();
      onClosed();
    },
  });

  const valid = name.trim() !== "" && price !== "" && Number(price) >= 0;

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

  if (menu && isLoading) {
    return (
      <div className="rounded-xl border border-line bg-white p-6 text-sm text-ink-3">
        불러오는 중…
      </div>
    );
  }

  return (
    <section className="space-y-5 rounded-xl border border-line bg-white p-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <label className="space-y-1 text-sm font-semibold text-ink-2">
          메뉴명
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 마르게리타"
            maxLength={100}
            className={inputClass}
          />
        </label>
        <label className="space-y-1 text-sm font-semibold text-ink-2">
          판매가 (원)
          <input
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="space-y-1 text-sm font-semibold text-ink-2">
          카테고리 (선택)
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            maxLength={50}
            className={inputClass}
          />
        </label>
      </div>

      <div className="space-y-3 border-t border-line-soft pt-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-ink">레시피</h2>
          <label className="flex shrink-0 items-center gap-2 text-sm text-ink-2">
            <input
              type="checkbox"
              checked={menu?.use_inventory_deduction ?? false}
              disabled={!menu?.has_recipe || deductionMutation.isPending}
              onChange={(e) => deductionMutation.mutate(e.target.checked)}
              className="size-4 accent-brand"
            />
            재고 차감
          </label>
        </div>

        {inventory.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line p-4 text-sm text-ink-3">
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
                  className="h-10 flex-1 rounded-lg border border-line px-2 text-sm"
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
                  className="h-10 w-24 rounded-lg border border-line px-2 text-sm"
                />
                <span className="w-10 text-sm text-ink-3">{row.unit}</span>
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  aria-label="재료 삭제"
                  className="text-ink-3 hover:text-danger"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              onClick={addRow}
              className="h-9 rounded-full border border-line bg-white px-4 text-sm text-ink-2 hover:bg-subtle"
            >
              <Plus className="size-4" /> 재료 추가
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line-soft pt-5">
        {menu ? (
          <button
            type="button"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (window.confirm(`"${menu.name}"을(를) 삭제할까요?`)) deleteMutation.mutate();
            }}
            className="text-sm font-semibold text-danger hover:underline"
          >
            메뉴 삭제
          </button>
        ) : (
          <button
            type="button"
            onClick={onClosed}
            className="text-sm font-semibold text-ink-3 hover:text-ink-2"
          >
            취소
          </button>
        )}
        <Button onClick={() => saveMutation.mutate()} disabled={!valid || saveMutation.isPending}>
          {saveMutation.isPending ? "저장 중…" : "저장"}
        </Button>
      </div>
      {saveMutation.isError && (
        <p className="text-sm text-danger" role="alert">
          {saveErrorMessage(saveMutation.error)}
        </p>
      )}
    </section>
  );
}
