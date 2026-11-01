// 사용자 환경설정(정렬 등) — LocalStorage persist (04_fe.md §5.1, §4.6).
import { create } from "zustand";
import { type StateStorage, createJSONStorage, persist } from "zustand/middleware";
import type { InventorySortOption } from "../components/inventory/stock-status";

interface PreferencesState {
  inventorySortOption: InventorySortOption;
  setInventorySortOption: (option: InventorySortOption) => void;
}

const safeLocalStorage: StateStorage = {
  getItem: (name: string) => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(name, value);
    } catch {}
  },
  removeItem: (name: string) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(name);
    } catch {}
  },
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      inventorySortOption: "EXPIRY_ASC",
      setInventorySortOption: (inventorySortOption) => set({ inventorySortOption }),
    }),
    {
      name: "sajura-preferences",
      storage: createJSONStorage(() => safeLocalStorage),
    },
  ),
);
