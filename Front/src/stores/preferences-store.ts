// 사용자 환경설정(정렬 등) — LocalStorage persist (04_fe.md §5.1).
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { InventorySortKey, SortDir } from "../components/inventory/stock-status";

interface PreferencesState {
  inventorySort: { key: InventorySortKey; dir: SortDir };
  setInventorySort: (sort: { key: InventorySortKey; dir: SortDir }) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      inventorySort: { key: "expiry", dir: "asc" },
      setInventorySort: (inventorySort) => set({ inventorySort }),
    }),
    { name: "sajura-preferences" },
  ),
);
