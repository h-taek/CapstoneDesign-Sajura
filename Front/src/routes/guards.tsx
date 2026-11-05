// 라우트 가드 — 04_fe.md §3 (인증 / 사업자 검증 / 온보딩 게이트).
//
// 진입 단계 흐름:
//   미인증                     → /login
//   UNVERIFIED·REJECTED        → /verify-business   (사업자 검증 게이트)
//   PENDING·VERIFIED + 온보딩 미완료 → /onboarding/{현재 스텝}
//   PENDING·VERIFIED + 온보딩 완료   → /  (앱)
//   role !== ADMIN 이 /admin/* 접근  → 본인 단계(온보딩 완료 시 /)
import { type ReactNode, useEffect, useState, useSyncExternalStore } from "react";
import { Navigate, useLocation } from "react-router";
import { isMorningTransitioning, subscribeMorningTransition } from "../components/sky/day";
import { signOut } from "../features/auth/sign-out";
import { queryClient } from "../lib/query-client";
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
  // 앱 단계 전 계정(사업자 검증 전·온보딩 미완료)으로 로그인·가입 화면에 들어오면 로그아웃한다 (04_fe.md §2).
  // 자동 로그인 복구가 끝난 뒤 한 번만 본다 — 새로고침으로 들어와도 같게, 이 화면에서 막 로그인한
  // 계정은 그 단계 화면으로 보내도록. 로그아웃이 끝날 때까지 폼을 그리지 않아 그 사이 새 로그인이 지워지지 않게 한다.
  const [decided, setDecided] = useState(false);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (!bootstrapped || decided) return;
    setDecided(true);
    const state = useAuthStore.getState();
    if (state.accessToken && state.user && !isStageAllowed("app", state.user)) {
      setLeaving(true);
      void signOut(queryClient).finally(() => setLeaving(false));
    }
  }, [bootstrapped, decided]);
  if (!bootstrapped || !decided || leaving) return <SplashScreen />;
  if (morningActive) return <>{children}</>;
  if (token && user && isStageAllowed("app", user)) {
    return <Navigate to={landingPath(user)} replace />;
  }
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
  const { pathname } = useLocation();
  if (!bootstrapped) return <SplashScreen />;
  if (morningActive) return <>{children}</>;
  // 첫 접속(/)은 서비스 소개, 특정 화면 주소로 들어오면 로그인 (04_fe.md §3)
  if (!token || !user) return <Navigate to={pathname === "/" ? "/intro" : "/login"} replace />;
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

// 지름 40px 원판을 도넛 모양(두께 6px)으로 오려 낸다 — 아래는 흰 유리 고리, 위는 도는 호
const DONUT_MASK =
  "radial-gradient(farthest-side, transparent calc(100% - 7px), #000 calc(100% - 6px))";
const GLASS_RING = {
  borderRadius: "9999px",
  // glass-card의 카드용 테두리·안쪽 빛은 고리 둘레에 선으로 남아 뺀다
  border: "none",
  boxShadow: "none",
  maskImage: DONUT_MASK,
  WebkitMaskImage: DONUT_MASK,
} as const;
// 호는 12시에서 시계 방향으로 갈수록 진해져 9시(270°)에서 머리가 된다 — 꼬리는 유리 고리에 녹아든다
const SPIN_ARC = {
  ...GLASS_RING,
  backgroundImage: "conic-gradient(transparent, var(--color-brand) 270deg, transparent 270deg)",
} as const;

/** 자동 로그인 복구·로그아웃을 기다리는 동안 — 하늘만 두고, 0.5초가 넘으면 유리 도넛 로딩 (04_fe.md §2). */
function SplashScreen() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 500);
    return () => clearTimeout(timer);
  }, []);
  return (
    <output className="grid min-h-dvh place-items-center" aria-live="polite">
      {slow && (
        <span aria-hidden="true" className="relative block size-10">
          <span className="absolute inset-0 glass-card" style={GLASS_RING} />
          <span className="absolute inset-0 animate-spin">
            <span className="absolute inset-0" style={SPIN_ARC} />
            {/* 머리 끝을 둥글게 — 9시 방향, 고리 한가운데(반지름 17)에 두께와 같은 6px 원 */}
            <span className="absolute top-[17px] left-0 size-1.5 rounded-full bg-brand" />
          </span>
        </span>
      )}
      <span className="sr-only">로딩 중</span>
    </output>
  );
}
