// 라우트 가드 — 04_fe.md §3 (인증 / 사업자 검증 / 온보딩 게이트).
//
// 진입 단계 흐름:
//   미인증                     → /login
//   UNVERIFIED·REJECTED        → /verify-business   (사업자 검증 게이트)
//   PENDING·VERIFIED + 온보딩 미완료 → /onboarding/{현재 스텝}
//   PENDING·VERIFIED + 온보딩 완료   → /  (앱)
//   role !== ADMIN 이 /admin/* 접근  → 본인 단계(온보딩 완료 시 /)
import { type ReactNode, useSyncExternalStore } from "react";
import { Navigate } from "react-router";
import { isMorningTransitioning, subscribeMorningTransition } from "../components/sky/day";
import type { AuthUser } from "../stores/auth-store";
import { useAuthStore } from "../stores/auth-store";
import { useOnboardingStore } from "../stores/onboarding-store";

export type Stage = "verify" | "onboarding" | "app";

/** 온보딩 스토어에 저장된 진행 상태에서 현재 머물러야 할 스텝 번호(1~4)를 구한다. */
export function currentOnboardingStep(): 1 | 2 | 3 | 4 {
  const { store, pos, menus } = useOnboardingStore.getState();
  if (!store) return 1;
  if (!pos) return 2;
  if (menus.length === 0) return 3;
  return 4;
}

/** 인증된 사용자가 현재 머물러야 할 경로. */
export function landingPath(user: AuthUser): string {
  if (user.business_status === "UNVERIFIED" || user.business_status === "REJECTED") {
    return "/verify-business";
  }
  if (!user.onboarding_completed) {
    return `/onboarding/${currentOnboardingStep()}`;
  }
  return "/";
}

function useMorningActive(): boolean {
  return useSyncExternalStore(subscribeMorningTransition, isMorningTransitioning, () => false);
}

export function RequireGuest({ children }: { children: ReactNode }) {
  const bootstrapped = useAuthStore((s) => s.bootstrapped);
  const token = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const morningActive = useMorningActive();
  if (!bootstrapped) return <SplashScreen />;
  if (morningActive) return <>{children}</>;
  if (token && user) return <Navigate to={landingPath(user)} replace />;
  return <>{children}</>;
}

export function isStageAllowed(stage: Stage, user: AuthUser): boolean {
  const verified = user.business_status === "PENDING" || user.business_status === "VERIFIED";
  if (stage === "verify") return !verified;
  if (stage === "onboarding") return verified && !user.onboarding_completed;
  return verified && user.onboarding_completed;
}

/** 인증 필수 + 단계 게이트. 단계 불일치 시 알맞은 곳으로 리다이렉트. */
export function RequireStage({ stage, children }: { stage: Stage; children: ReactNode }) {
  const bootstrapped = useAuthStore((s) => s.bootstrapped);
  const token = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const morningActive = useMorningActive();
  if (!bootstrapped) return <SplashScreen />;
  if (morningActive) return <>{children}</>;
  if (!token || !user) return <Navigate to="/login" replace />;
  if (!isStageAllowed(stage, user)) return <Navigate to={landingPath(user)} replace />;
  return <>{children}</>;
}

/** 관리자 전용 가드 — role=ADMIN만 통과, 그 외 본인 단계로 리다이렉트. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const bootstrapped = useAuthStore((s) => s.bootstrapped);
  const token = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  if (!bootstrapped) return <SplashScreen />;
  if (!token || !user) return <Navigate to="/login" replace />;
  if (user.role !== "ADMIN") return <Navigate to={landingPath(user)} replace />;
  return <>{children}</>;
}

function SplashScreen() {
  return (
    <output className="grid min-h-dvh place-items-center bg-subtle text-ink-3" aria-live="polite">
      <span className="text-sm">로딩 중…</span>
    </output>
  );
}
