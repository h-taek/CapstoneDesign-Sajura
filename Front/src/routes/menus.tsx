// 메뉴 관리 — 메뉴명·판매가·카테고리와 레시피를 한 화면에서 편집한다 (11_menus.html, 04_fe.md §4.5).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HTTPError } from "ky";
import { ChevronDown, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { type MenuFilter, groupAndFilterMenus } from "../components/menus/menu-logic";
import { FollowPanel } from "../components/shell";
import { MainShell } from "../components/shell";

const NEW = "new";

export default function MenusPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<MenuFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: menuList, isLoading: isMenusLoading } = useQuery({
    queryKey: ["menus-all"],
    queryFn: () => listMenus(100),
  });

  const menus = useMemo(() => menuList?.items ?? [], [menuList]);

  const { groups, totalAllCount, noRecipeCount } = useMemo(
    () => groupAndFilterMenus(menus, searchQuery, filter),
    [menus, searchQuery, filter],
  );

  const selectedMenu = useMemo(
    () => (selectedId === NEW ? null : (menus.find((m) => m.menu_id === selectedId) ?? null)),
    [menus, selectedId],
  );

  const isPanelOpen = selectedId !== null;

  // 웹 판과 카테고리 구분선 높이 겹침 계산 (목업 11_menus.html script)
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const updateRules = () => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const aside = wrap.querySelector(":scope > aside:not([hidden])");
      const list = wrap.querySelector(".menu-list");
      if (!aside || !list || window.innerWidth < 1024) {
        for (const r of wrap.querySelectorAll<HTMLElement>("[data-rule]")) {
          r.style.marginRight = "";
        }
        return;
      }
      const extra = wrap.getBoundingClientRect().right - list.getBoundingClientRect().right;
      const firstCardPanel = aside.firstElementChild as HTMLElement | null;
      const p = firstCardPanel ? firstCardPanel.getBoundingClientRect() : null;
      for (const r of wrap.querySelectorAll<HTMLElement>("[data-rule]")) {
        const y = r.getBoundingClientRect().top;
        if (p && (y < p.top - 16 || y > p.bottom + 16)) {
          r.style.marginRight = `-${Math.round(extra)}px`;
        } else {
          r.style.marginRight = "";
        }
      }
    };

    updateRules();
    window.addEventListener("scroll", updateRules, { passive: true });
    window.addEventListener("resize", updateRules);
    return () => {
      window.removeEventListener("scroll", updateRules);
      window.removeEventListener("resize", updateRules);
    };
  }, []);

  return (
    <MainShell active="menus">
      <div>
        <header className="mb-5 hidden lg:block">
          <h1 className="text-[1.75rem] font-bold tracking-tight text-ink">메뉴 관리</h1>
        </header>

        {/* 1줄: 검색(왼쪽) · 보기(오른쪽) */}
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <label className="relative block w-full lg:w-96">
            <span className="sr-only">메뉴 검색</span>
            <Search className="pointer-events-none absolute top-1/2 z-10 left-3.5 size-5 -translate-y-1/2 text-ink-2" />
            <input
              type="search"
              placeholder="메뉴 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 w-full rounded-full pr-5 pl-11 text-[0.95rem] text-ink placeholder:text-ink-2 glass-card focus:ring-4 focus:ring-brand-soft focus:outline-none"
            />
          </label>
          <div className="flex w-full items-center gap-2 lg:ml-auto lg:w-auto lg:justify-end">
            <div
              role="tablist"
              aria-label="메뉴 보기"
              className="inline-flex shrink-0 rounded-full p-1 glass-card"
            >
              <button
                type="button"
                role="tab"
                aria-selected={filter === "all"}
                onClick={() => setFilter("all")}
                className={`rounded-full px-3.5 py-1.5 whitespace-nowrap lg:px-5 text-sm font-semibold ${
                  filter === "all" ? "bg-brand-soft text-brand" : "text-ink-2 hover:text-ink"
                }`}
              >
                전체 {totalAllCount}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={filter === "no-recipe"}
                onClick={() => setFilter("no-recipe")}
                className={`rounded-full px-3.5 py-1.5 whitespace-nowrap lg:px-5 text-sm font-semibold ${
                  filter === "no-recipe" ? "bg-brand-soft text-brand" : "text-ink-2 hover:text-ink"
                }`}
              >
                레시피 없음 {noRecipeCount}
              </button>
            </div>
          </div>
        </div>

        {/* 2줄: 메뉴 추가 */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setSelectedId(NEW)}
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-brand px-7 text-[0.95rem] font-semibold text-white hover:bg-brand-strong"
          >
            <Plus className="size-5" />
            메뉴 추가
          </button>
        </div>

        {/* 웹 격자 및 편집 판 구조 */}
        <div ref={wrapRef} className="menu-wrap lg:grid lg:grid-cols-4 lg:gap-x-2 xl:grid-cols-5">
          <div
            className={`menu-list flex min-w-0 flex-col gap-6 ${
              isPanelOpen ? "lg:col-span-2 xl:col-span-3" : "lg:col-span-4 xl:col-span-5"
            }`}
          >
            {isMenusLoading ? (
              <p className="rounded-2xl px-5 py-10 text-center text-ink-2 glass-card">
                불러오는 중…
              </p>
            ) : menus.length === 0 ? (
              <div className="rounded-2xl px-5 py-10 text-center glass-card">
                <p className="text-lg font-bold text-ink">등록된 메뉴가 없어요</p>
                <p className="mt-1 text-sm text-ink-2">
                  '메뉴 추가'로 등록하거나 매출을 올리면 판매한 메뉴가 생겨요
                </p>
              </div>
            ) : groups.length === 0 && searchQuery ? (
              <p className="px-5 py-10 text-center text-ink-2">
                '{searchQuery}'가 들어간 메뉴가 없어요
              </p>
            ) : (
              groups.map((group) => (
                <section key={group.category}>
                  <h2 className="mb-3 flex items-center gap-3 px-1 text-base font-bold text-ink">
                    <span className="shrink-0">
                      {group.category}{" "}
                      <span className="tabular font-semibold text-ink-2">{group.items.length}</span>
                    </span>
                    <span
                      aria-hidden="true"
                      data-rule
                      className="h-px flex-1 bg-white/40 transition-[margin] duration-300"
                    />
                  </h2>
                  <ul
                    className={`menu-grid grid grid-cols-2 gap-x-2 gap-y-3 ${
                      isPanelOpen
                        ? "lg:grid-cols-2 lg:gap-y-4 xl:grid-cols-3"
                        : "md:grid-cols-4 lg:gap-y-4 xl:grid-cols-5"
                    }`}
                  >
                    {group.items.map((menu) => {
                      const isSelected = selectedId === menu.menu_id;
                      return (
                        <li key={menu.menu_id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(menu.menu_id)}
                            style={
                              isSelected
                                ? { outline: "2px solid var(--color-brand)", outlineOffset: "-2px" }
                                : undefined
                            }
                            className="flex aspect-[4/3] w-full flex-col justify-between rounded-2xl p-4 text-left glass-card hover:bg-white/50"
                          >
                            <span className="line-clamp-2 text-[0.95rem] font-bold break-keep text-ink">
                              {menu.name}
                            </span>
                            <span>
                              <span className="tabular block text-[1.75rem] leading-none font-bold tracking-tight text-ink">
                                {menu.price.toLocaleString("ko-KR")}
                                <span className="ml-1 text-sm font-semibold text-ink-2">원</span>
                              </span>
                              <span className="mt-2 block truncate text-sm text-ink-2">
                                {!menu.has_recipe ? (
                                  <span className="font-semibold text-warn">레시피 없음</span>
                                ) : !menu.use_inventory_deduction ? (
                                  "재고 차감 꺼짐"
                                ) : (
                                  <>&nbsp;</>
                                )}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))
            )}
          </div>

          {/* 편집 / 추가 옆 판 */}
          {selectedId !== null && (
            <MenuEditorPanel
              key={selectedId}
              menuId={selectedId === NEW ? null : selectedId}
              initialMenu={selectedMenu}
              onClose={() => setSelectedId(null)}
              onSaved={(newMenuId) => {
                setSelectedId(newMenuId);
                queryClient.invalidateQueries({ queryKey: ["menus-all"] });
              }}
              onDeleted={() => {
                setSelectedId(null);
                queryClient.invalidateQueries({ queryKey: ["menus-all"] });
              }}
            />
          )}
        </div>
      </div>
    </MainShell>
  );
}

function MenuEditorPanel({
  menuId,
  initialMenu,
  onClose,
  onSaved,
  onDeleted,
}: {
  menuId: string | null;
  initialMenu: MenuListItem | null;
  onClose: () => void;
  onSaved: (id: string) => void;
  onDeleted: () => void;
}) {
  const isNew = menuId === null;
  const queryClient = useQueryClient();

  const [name, setName] = useState(initialMenu?.name ?? "");
  const [price, setPrice] = useState(initialMenu ? String(initialMenu.price) : "");
  const [category, setCategory] = useState(initialMenu?.category ?? "");
  const [nameError, setNameError] = useState<string | null>(null);

  const { data: recipeData } = useQuery({
    queryKey: ["recipe", menuId],
    queryFn: () => getRecipe(menuId ?? ""),
    enabled: !isNew && menuId !== null,
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ["inventory"],
    queryFn: listInventory,
  });

  const [rows, setRows] = useState<RecipeIngredientInput[]>([]);

  useEffect(() => {
    if (recipeData) {
      setRows(
        recipeData.ingredients.map((i) => ({
          item_id: i.item_id,
          quantity: i.quantity,
          unit: i.unit,
        })),
      );
    } else if (recipeData === null) {
      setRows([]);
    }
  }, [recipeData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      setNameError(null);
      const fields = {
        name: name.trim(),
        price: Number(price),
        category: category.trim() || null,
      };

      const saved = !isNew && menuId ? await updateMenu(menuId, fields) : await createMenu(fields);

      const ingredients = rows.filter((r) => r.item_id);
      if (ingredients.length > 0 || initialMenu?.has_recipe) {
        await upsertRecipe(saved.menu_id, ingredients);
      }
      return saved;
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["recipe", saved.menu_id] });
      onSaved(saved.menu_id);
    },
    onError: (err: unknown) => {
      if (err instanceof HTTPError && err.response.status === 409) {
        setNameError("이미 있는 메뉴 이름이에요");
      } else {
        setNameError("저장에 실패했습니다. 입력을 확인해 주세요.");
      }
    },
  });

  const deductionMutation = useMutation({
    mutationFn: (on: boolean) => updateMenu(menuId ?? "", { use_inventory_deduction: on }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menus-all"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteMenu(menuId ?? ""),
    onSuccess: () => {
      onDeleted();
    },
  });

  const addRow = () => {
    const first = inventory[0];
    if (!first) return;
    setRows((r) => [...r, { item_id: first.item_id, quantity: 1, unit: first.unit }]);
  };

  const updateRow = (idx: number, patch: Partial<RecipeIngredientInput>) => {
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const removeRow = (idx: number) => {
    setRows((r) => r.filter((_, i) => i !== idx));
  };

  const isDeductionOn = initialMenu?.use_inventory_deduction ?? false;
  const deductionDisabled = isNew || !initialMenu?.has_recipe || deductionMutation.isPending;

  const valid = name.trim() !== "" && price !== "" && Number(price) >= 0;

  const panelTitle = isNew ? "새 메뉴" : (initialMenu?.name ?? "메뉴 편집");

  return (
    <FollowPanel
      title={panelTitle}
      onClose={onClose}
      aria-label={isNew ? "새 메뉴" : `${panelTitle} 편집`}
      className="lg:col-span-2 lg:mt-9"
      fit
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) saveMutation.mutate();
        }}
        className="mt-4 grid grid-cols-2 gap-3"
      >
        <label className="col-span-2 flex flex-col gap-1 text-sm font-semibold text-ink-2">
          메뉴명
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameError(null);
            }}
            placeholder={isNew ? "예: 마르게리타" : undefined}
            className={`h-11 w-full rounded-full border bg-[rgb(46_32_120/0.065)] px-4 text-base font-normal text-ink focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none placeholder:text-ink-3 ${
              nameError ? "border-danger" : "border-white/80"
            }`}
          />
          {nameError && (
            <span className="text-xs font-normal text-danger" role="alert">
              {nameError}
            </span>
          )}
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-ink-2">
          판매가 (원)
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="tabular h-11 w-full rounded-full border border-white/80 bg-[rgb(46_32_120/0.065)] px-4 text-base font-normal text-ink focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-ink-2">
          카테고리 (선택)
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="예: 피자"
            className="h-11 w-full rounded-full border border-white/80 bg-[rgb(46_32_120/0.065)] px-4 text-base font-normal text-ink focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none placeholder:text-ink-3"
          />
        </label>

        <section className="col-span-2 mt-6">
          <h3 className="text-sm font-bold text-ink">
            레시피 <span className="font-normal text-ink-2">· 한 개 팔 때 쓰는 양</span>
          </h3>

          {inventory.length === 0 ? (
            <p className="mt-2 text-sm text-ink-2">
              등록된 재료가 없어요. 재고 관리에서 재료를 먼저 등록하세요
            </p>
          ) : rows.length === 0 ? (
            <div>
              <p className="mt-2 text-sm text-ink-2">
                레시피가 없어 추천발주의 재료 계산에서 빠져요
              </p>
              <button
                type="button"
                onClick={addRow}
                className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-full border border-white/80 px-4 text-sm font-semibold text-ink-2 hover:bg-white/30"
              >
                <Plus className="size-4" />
                재료 추가
              </button>
            </div>
          ) : (
            <div>
              <ul className="mt-3 space-y-2">
                {rows.map((row, idx) => {
                  const currentItem = inventory.find((i) => i.item_id === row.item_id);
                  const currentUnit = currentItem?.unit ?? row.unit;
                  const rowId = `recipe-row-${idx}`;

                  return (
                    <li
                      key={rowId}
                      className="grid grid-cols-[minmax(0,1fr)_7rem_2.5rem] items-center gap-2"
                    >
                      <label className="relative block min-w-0">
                        <span className="sr-only">재료</span>
                        <select
                          value={row.item_id}
                          onChange={(e) => {
                            const found = inventory.find((i) => i.item_id === e.target.value);
                            updateRow(idx, {
                              item_id: e.target.value,
                              unit: found?.unit ?? row.unit,
                            });
                          }}
                          className="h-10 w-full appearance-none rounded-full border border-white/80 bg-[rgb(46_32_120/0.065)] pr-9 pl-4 text-[0.95rem] text-ink focus:border-brand focus:outline-none"
                        >
                          {inventory.map((inv) => (
                            <option key={inv.item_id} value={inv.item_id}>
                              {inv.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-2" />
                      </label>
                      <label className="relative block">
                        <span className="sr-only">
                          {currentItem ? `${currentItem.name} 사용량` : "사용량"}
                        </span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          inputMode="decimal"
                          value={row.quantity === 0 ? "" : row.quantity}
                          onChange={(e) => updateRow(idx, { quantity: Number(e.target.value) })}
                          className="tabular h-10 w-full rounded-full border border-white/80 bg-[rgb(46_32_120/0.065)] pr-9 pl-4 text-right text-[0.95rem] font-semibold text-ink focus:border-brand focus:outline-none"
                        />
                        <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-sm text-ink-2">
                          {currentUnit}
                        </span>
                      </label>
                      <button
                        type="button"
                        aria-label={currentItem ? `${currentItem.name} 빼기` : "재료 빼기"}
                        disabled={!isNew && isDeductionOn && rows.length <= 1}
                        onClick={() => removeRow(idx)}
                        className="flex size-10 items-center justify-center rounded-full text-ink-2 hover:bg-white/60 hover:text-danger disabled:opacity-40"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                onClick={addRow}
                className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-full border border-white/80 px-4 text-sm font-semibold text-ink-2 hover:bg-white/30"
              >
                <Plus className="size-4" />
                재료 추가
              </button>
            </div>
          )}
        </section>

        {isNew ? (
          <div className="col-span-2 mt-5 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-11 flex-1 rounded-full border border-white/80 text-[0.95rem] font-semibold text-ink-2 hover:bg-white/30"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!valid || saveMutation.isPending}
              className="h-11 flex-1 rounded-full bg-brand text-[0.95rem] font-semibold text-white hover:bg-brand-strong disabled:opacity-50"
            >
              {saveMutation.isPending ? "저장 중…" : "저장"}
            </button>
          </div>
        ) : (
          <button
            type="submit"
            disabled={!valid || saveMutation.isPending}
            className="col-span-2 mt-5 h-11 w-full rounded-full bg-brand text-[0.95rem] font-semibold text-white hover:bg-brand-strong disabled:opacity-50"
          >
            {saveMutation.isPending ? "저장 중…" : "저장"}
          </button>
        )}

        {!isNew && (
          <section className="col-span-2 mt-6 border-t border-white/70 pt-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-ink">재고 차감</p>
                {deductionDisabled && (
                  <p className="mt-1 text-xs text-ink-2">레시피를 저장하면 켤 수 있어요</p>
                )}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isDeductionOn}
                aria-label="재고 차감"
                disabled={deductionDisabled}
                onClick={() => deductionMutation.mutate(!isDeductionOn)}
                className={`relative h-7 w-12 shrink-0 rounded-full p-1 transition-colors disabled:opacity-50 ${
                  isDeductionOn ? "bg-brand" : "bg-ink-3/40"
                }`}
              >
                <span
                  className={`block size-5 rounded-full bg-white shadow transition-transform ${
                    isDeductionOn ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
            <button
              type="button"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (window.confirm(`"${name || initialMenu?.name}"을(를) 삭제할까요?`)) {
                  deleteMutation.mutate();
                }
              }}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-danger hover:underline disabled:opacity-50"
            >
              <Trash2 className="size-4" />
              메뉴 삭제
            </button>
          </section>
        )}
      </form>
    </FollowPanel>
  );
}
