// Auth 메모리 스토어 — 10_frontend_design.md §2 (LocalStorage·Cookie 금지).
import { create } from "zustand";

export type BusinessStatus = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
export type UserRole = "OWNER" | "ADMIN";

export interface AuthUser {
  user_id: string;
  email: string;
  name: string;
  auth_provider: "LOCAL" | "KAKAO" | "GOOGLE";
  role: UserRole;
  store_name: string | null;
  business_no: string | null;
  business_status: BusinessStatus;
  onboarding_completed: boolean;
}

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
