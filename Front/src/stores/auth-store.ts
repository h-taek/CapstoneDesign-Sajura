// Auth 메모리 스토어 — 04_fe.md §2 (LocalStorage·Cookie 금지).
import { create } from "zustand";
import type { components } from "../api/types.gen";

export type AuthUser = components["schemas"]["UserMeResponse"];
export type BusinessStatus = AuthUser["business_status"];
export type UserRole = AuthUser["role"];

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  bootstrapped: boolean;
  setAccessToken: (token: string | null) => void;
  setUser: (user: AuthUser | null) => void;
  markBootstrapped: () => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  bootstrapped: false,
  setAccessToken: (token) => set({ accessToken: token }),
  setUser: (user) => set({ user }),
  markBootstrapped: () => set({ bootstrapped: true }),
  clear: () => set({ accessToken: null, user: null }),
}));
