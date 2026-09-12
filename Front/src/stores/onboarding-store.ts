// 온보딩 단계 간 입력 캐싱 — 메모리 only (10_frontend_design.md §4.1).
import { create } from "zustand";
import type {
  MenusStepValues,
  PosStepValues,
  StoreStepValues,
} from "../schemas/onboarding";

interface OnboardingState {
  store: StoreStepValues | null;
  pos: PosStepValues | null;
  menus: MenusStepValues["menus"];
  setStore: (v: StoreStepValues) => void;
  setPos: (v: PosStepValues) => void;
  setMenus: (v: MenusStepValues["menus"]) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  store: null,
  pos: null,
  menus: [],
  setStore: (v) => set({ store: v }),
  setPos: (v) => set({ pos: v }),
  setMenus: (v) => set({ menus: v }),
  reset: () => set({ store: null, pos: null, menus: [] }),
}));
