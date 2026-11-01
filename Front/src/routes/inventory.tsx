// 재고관리 화면 v2 — MainShell + 4:3 카드 격자 + 팔로우 패널 (04_fe.md §4.6, 09_inventory.html).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { type InventoryItem, deleteInventoryItem, listInventory } from "../api/endpoints/inventory";
import { InventoryAddFormPanel } from "../components/inventory/inventory-add-form-panel";
import { InventoryCard } from "../components/inventory/inventory-card";
import { InventoryDetailPanel } from "../components/inventory/inventory-detail-panel";
import {
  INVENTORY_SORT_OPTIONS,
  type InventorySortOption,
  SORT_OPTION_LABELS,
  filterInventoryBySearch,
  isExpiryWarning,
  isStockWarning,
  sortInventoryByOption,
} from "../components/inventory/stock-status";
import { MainShell } from "../components/shell/main-shell";
import { usePreferencesStore } from "../stores/preferences-store";

const PAGE_SIZE = 25;

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const today = useMemo(() => new Date(), []);

  // 상태 관리
  const [searchQuery, setSearchQuery] = useState("");
  const [viewFilter, setViewFilter] = useState<"all" | "alert">("all");
  const [page, setPage] = useState(1);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);

  // 정렬 옵션 (preferences store 유지)
  const sortOption = usePreferencesStore((st) => st.inventorySortOption);
  const setSortOption = usePreferencesStore((st) => st.setInventorySortOption);

  // 재고 목록 쿼리
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inventory"],
    queryFn: listInventory,
  });

  // 재료 삭제 뮤테이션
  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => deleteInventoryItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setSelectedItemId(null);
    },
    onError: (err: unknown) => {
      window.alert(
        err instanceof Error && err.message.includes("409")
          ? "레시피나 발주 내역에서 사용 중인 재료는 삭제할 수 없습니다."
          : "삭제에 실패했습니다.",
      );
    },
  });

  // 확인 필요 판정: 소비기한 ≤ 오늘+3일(경고) 또는 needs_check 또는 total_quantity ≤ low_stock_threshold
  const isAlertItem = useCallback(
    (i: InventoryItem) => isExpiryWarning(i, today) || isStockWarning(i),
    [today],
  );
  const alertCount = useMemo(() => items.filter(isAlertItem).length, [items, isAlertItem]);

  // 검색/보기/정렬 적용 (조건 변경 시 1쪽으로 복귀)
  const filteredAndSorted = useMemo(() => {
    let list = items;
    if (viewFilter === "alert") {
      list = list.filter(isAlertItem);
    }
    if (searchQuery.trim()) {
      list = filterInventoryBySearch(list, searchQuery.trim());
    }
    return sortInventoryByOption(list, sortOption);
  }, [items, viewFilter, searchQuery, sortOption, isAlertItem]);

  // 페이지네이션 (한 쪽 25개)
  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredAndSorted.slice(start, start + PAGE_SIZE);
  }, [filteredAndSorted, currentPage]);

  // 필터나 검색어 바뀔 때 1쪽으로
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setPage(1);
  };

  const handleFilterChange = (filter: "all" | "alert") => {
    setViewFilter(filter);
    setPage(1);
  };

  const handleSortChange = (opt: InventorySortOption) => {
    setSortOption(opt);
    setPage(1);
  };

  const selectedItem = items.find((i) => i.item_id === selectedItemId) ?? null;
  const isPanelOpen = isAddFormOpen || selectedItem !== null;

  return (
    <MainShell active="inventory">
      <div>
        {/* 헤더 — 웹에서만 보임 (앱은 상단 바가 제목을 가짐) */}
        <header className="mb-5 hidden lg:block">
          <h1 className="text-[1.75rem] font-bold tracking-tight text-ink">재고 현황</h1>
        </header>

        {/* 1줄: 검색(왼쪽) · 보기·정렬(오른쪽) */}
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <label className="relative block w-full lg:w-96">
            <span className="sr-only">재료 검색</span>
            <Search className="pointer-events-none absolute top-1/2 z-10 left-3.5 size-5 -translate-y-1/2 text-ink-2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="재료 검색"
              className="h-11 w-full rounded-full pr-5 pl-11 text-[0.95rem] text-ink placeholder:text-ink-2 glass-card focus:ring-4 focus:ring-brand-soft focus:outline-none"
            />
          </label>

          <div className="flex w-full items-center justify-between gap-2 lg:ml-auto lg:w-auto lg:justify-end">
            <div
              role="tablist"
              aria-label="재고 보기"
              className="inline-flex shrink-0 rounded-full p-1 glass-card"
            >
              <button
                type="button"
                role="tab"
                aria-selected={viewFilter === "all"}
                onClick={() => handleFilterChange("all")}
                className={`rounded-full px-3.5 py-1.5 whitespace-nowrap lg:px-5 text-sm font-semibold transition-colors ${
                  viewFilter === "all" ? "bg-brand-soft text-brand" : "text-ink-2 hover:text-ink"
                }`}
              >
                전체 {items.length}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewFilter === "alert"}
                onClick={() => handleFilterChange("alert")}
                className={`rounded-full px-3.5 py-1.5 whitespace-nowrap lg:px-5 text-sm font-semibold transition-colors ${
                  viewFilter === "alert" ? "bg-brand-soft text-brand" : "text-ink-2 hover:text-ink"
                }`}
              >
                확인 필요 {alertCount}
              </button>
            </div>

            <span className="relative">
              <select
                aria-label="재고 정렬"
                value={sortOption}
                onChange={(e) => handleSortChange(e.target.value as InventorySortOption)}
                className="h-11 appearance-none rounded-full border border-white/50 bg-white/50 pr-10 pl-5 text-sm font-semibold text-ink focus:outline-none"
              >
                {INVENTORY_SORT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {SORT_OPTION_LABELS[opt]}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-ink-2" />
            </span>
          </div>
        </div>

        {/* 2줄: 재료 추가 버튼 */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => {
              setIsAddFormOpen(true);
              setSelectedItemId(null);
            }}
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-brand px-7 text-[0.95rem] font-semibold text-white hover:bg-brand-strong transition-colors"
          >
            <Plus className="size-5" />
            재료 추가
          </button>
        </div>

        {/* 카드 격자 & 상세 판 (5열 레이아웃) */}
        <div className="inv-wrap lg:grid lg:grid-cols-4 lg:gap-x-2 xl:grid-cols-5">
          <div
            className={`inv-list min-w-0 ${
              isPanelOpen ? "lg:col-span-2 xl:col-span-3" : "lg:col-span-4 xl:col-span-5"
            }`}
          >
            {isLoading ? (
              <p className="rounded-2xl px-5 py-10 text-center text-ink-2 glass-card">
                불러오는 중…
              </p>
            ) : items.length === 0 ? (
              <div className="rounded-2xl px-5 py-10 text-center glass-card">
                <p className="text-lg font-bold text-ink">등록된 재료가 없어요</p>
                <p className="mt-1 text-sm text-ink-2">'재료 추가'로 시작하세요.</p>
              </div>
            ) : filteredAndSorted.length === 0 ? (
              searchQuery.trim() ? (
                <p className="px-5 py-10 text-center text-ink-2">
                  '{searchQuery.trim()}'가 들어간 재료가 없어요
                </p>
              ) : (
                <div className="rounded-2xl px-5 py-10 text-center glass-card">
                  <p className="text-lg font-bold text-ink">확인이 필요한 재료가 없어요</p>
                </div>
              )
            ) : (
              <ul
                className={`inv-grid grid grid-cols-2 gap-x-2 gap-y-3 ${
                  isPanelOpen
                    ? "md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3"
                    : "md:grid-cols-4 lg:gap-y-4 xl:grid-cols-5"
                }`}
              >
                {pageItems.map((item) => (
                  <InventoryCard
                    key={item.item_id}
                    item={item}
                    today={today}
                    isSelected={selectedItemId === item.item_id}
                    onClick={() => {
                      setIsAddFormOpen(false);
                      setSelectedItemId((prev) => (prev === item.item_id ? null : item.item_id));
                    }}
                  />
                ))}
              </ul>
            )}
          </div>

          {/* 재료 추가 판 */}
          {isAddFormOpen && (
            <InventoryAddFormPanel
              onClose={() => setIsAddFormOpen(false)}
              onSuccess={(newItemId) => {
                setIsAddFormOpen(false);
                setSelectedItemId(newItemId);
              }}
            />
          )}

          {/* 재료 상세 판 */}
          {selectedItem && (
            <InventoryDetailPanel
              item={selectedItem}
              isItemExpiredOrUrgent={isExpiryWarning(selectedItem, today)}
              onClose={() => setSelectedItemId(null)}
              onDelete={() => {
                if (window.confirm(`"${selectedItem.name}"을(를) 삭제할까요?`)) {
                  deleteMutation.mutate(selectedItem.item_id);
                }
              }}
            />
          )}
        </div>

        {/* 쪽 이동 (한 쪽에 25개) */}
        {totalPages > 1 && (
          <nav aria-label="쪽 이동" className="mt-5 flex items-center justify-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="이전 쪽"
              className="flex size-10 items-center justify-center rounded-full text-ink-2 hover:bg-white/50 disabled:text-ink-4 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="size-5" />
            </button>

            {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((p) => {
              const isCurrent = p === currentPage;
              return (
                <button
                  key={p}
                  type="button"
                  aria-current={isCurrent ? "page" : undefined}
                  onClick={() => setPage(p)}
                  className={`size-10 rounded-full text-sm font-semibold transition-colors ${
                    isCurrent
                      ? "bg-brand-soft font-bold text-brand"
                      : "text-ink-2 hover:bg-white/50"
                  }`}
                >
                  {p}
                </button>
              );
            })}

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="다음 쪽"
              className="flex size-10 items-center justify-center rounded-full text-ink-2 hover:bg-white/50 disabled:text-ink-4 disabled:hover:bg-transparent"
            >
              <ChevronRight className="size-5" />
            </button>
          </nav>
        )}
      </div>
    </MainShell>
  );
}
