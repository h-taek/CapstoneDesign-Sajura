// 화면별 하늘 시각 지정 훅(useSky)과 경로 기본 하늘 동기화(mockup v2 body[data-sky]·data-sky-steps).
import { useEffect } from "react";
import {
  DAY,
  dayLerp,
  drawDay,
  flowTo,
  isMorningTransitioning,
  parseSkyMinutes,
  setSkyCalm,
  subscribeMorningTransition,
} from "./day";

export type SkyMode = "now" | "scroll" | `${number}:${number}` | string | number;
export type SkyStepsInput = Readonly<Record<string, string | number>> | string;

// 목업 html의 body[data-sky]·data-sky-steps 상수
export const INTRO_SKY = "scroll" as const;
export const LOGIN_SKY = "21:30" as const;
export const LOGIN_SKY_STEPS = {
  default: "21:30",
  withdrawn: "21:30",
  error: "21:30",
} as const;

export const REGISTER_SKY = "21:30" as const;
export const REGISTER_SKY_STEPS = {
  terms: "21:30",
  "terms-error": "21:30",
  email: "21:45",
  "email-error": "21:45",
  name: "22:00",
  password: "22:15",
  "pw-error": "22:15",
  business: "22:20",
  "business-error": "22:20",
} as const;

export const VERIFY_SKY = "22:20" as const;
export const ONBOARDING_SKY = "22:40" as const;
export const ONBOARDING_SKY_STEPS = {
  store: "22:40",
  "store-error": "22:40",
  pos: "23:10",
  "pos-okpos": "23:10",
  menus: "23:40",
  confirm: "00:10",
  "confirm-error": "00:10",
  "1": "22:40",
  "2": "23:10",
  "3": "23:40",
  "4": "00:10",
} as const;

export function parseSkySteps(raw: SkyStepsInput): Record<string, string | number> {
  if (typeof raw !== "string") return { ...raw };
  return Object.fromEntries(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((pair) => {
        const idx = pair.indexOf(":");
        return [pair.slice(0, idx), pair.slice(idx + 1)];
      }),
  );
}

export function resolveSkyValue(
  mode: SkyMode,
  steps?: SkyStepsInput,
  activeStep?: string,
): SkyMode {
  if (!steps || !activeStep) return mode;
  const map = parseSkySteps(steps);
  return map[activeStep] ?? mode;
}

/** 경로(pathname)에 해당하는 목업 기본 하늘 시각을 돌려준다. */
export function defaultSkyForPath(pathname: string): SkyMode {
  if (pathname === "/intro") return INTRO_SKY;
  if (pathname === "/login") return LOGIN_SKY;
  if (pathname === "/register") return REGISTER_SKY;
  if (pathname === "/verify-business") return VERIFY_SKY;
  if (pathname.startsWith("/onboarding")) {
    const seg = pathname.split("/")[2] ?? "1";
    return ONBOARDING_SKY_STEPS[seg as keyof typeof ONBOARDING_SKY_STEPS] ?? ONBOARDING_SKY;
  }
  return "now";
}

let activeHookCount = 0;
let backdropMountedCount = 0;

export function markBackdropMounted(): () => void {
  backdropMountedCount++;
  return () => {
    backdropMountedCount = Math.max(0, backdropMountedCount - 1);
    if (backdropMountedCount === 0 && activeHookCount === 0) {
      DAY.run++;
      DAY.initialized = false;
    }
  };
}

export function hasActiveSkyHook(): boolean {
  return activeHookCount > 0;
}

/** 하늘 모드를 실제 DOM·타이머·스크롤에 적용하고 정리 함수를 돌려준다. */
export function applySkyMode(target: SkyMode): () => void {
  if (isMorningTransitioning()) {
    return subscribeMorningTransition(() => {
      if (!isMorningTransitioning()) {
        applySkyMode(target);
      }
    });
  }

  if (target === "scroll") {
    DAY.run++;
    setSkyCalm(false);
    const ease = (t: number) => t * t * (3 - 2 * t);
    const fromScroll = () => {
      if (typeof document === "undefined" || typeof window === "undefined") return;
      const secs = [
        ...document.querySelectorAll<HTMLElement>("main .scene[data-min], .scene[data-min]"),
      ];
      if (secs.length === 0) {
        drawDay(1290);
        return;
      }
      if (secs.length === 1) {
        drawDay(Number(secs[0]!.dataset.min) || 1290);
        return;
      }
      const mid = window.scrollY + window.innerHeight / 2;
      const c = secs.map((el) => el.offsetTop + el.offsetHeight / 2);
      let i = 0;
      while (i < c.length - 2 && mid > c[i + 1]!) i++;
      const span = c[i + 1]! - c[i]! || 1;
      const t = ease(Math.min(1, Math.max(0, (mid - c[i]!) / span)));
      drawDay(dayLerp(Number(secs[i]!.dataset.min), Number(secs[i + 1]!.dataset.min), t));
    };
    const onScroll = () => {
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(fromScroll);
      else fromScroll();
    };
    DAY.redraw = fromScroll;
    DAY.initialized = true;
    fromScroll();
    if (typeof window !== "undefined") {
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", fromScroll);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", fromScroll);
      }
    };
  }

  if (target === "now") {
    DAY.run++;
    setSkyCalm(true);
    const fromNow = () => {
      const d = new Date();
      drawDay(d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60);
    };
    DAY.redraw = fromNow;
    DAY.initialized = true;
    fromNow();
    const timer = setInterval(fromNow, 30_000);
    if (typeof window !== "undefined") {
      window.addEventListener("resize", fromNow);
    }
    return () => {
      clearInterval(timer);
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", fromNow);
      }
    };
  }

  setSkyCalm(false);
  const minutes = parseSkyMinutes(target);
  DAY.redraw = () => {
    drawDay(minutes);
  };
  if (!DAY.initialized) {
    DAY.initialized = true;
    drawDay(minutes);
  } else {
    flowTo(DAY.mf, minutes, 900);
  }
  const onResize = () => {
    drawDay(DAY.mf);
  };
  if (typeof window !== "undefined") {
    window.addEventListener("resize", onResize);
  }
  return () => {
    if (typeof window !== "undefined") {
      window.removeEventListener("resize", onResize);
    }
  };
}

/**
 * 화면이 하늘 시각을 지정하는 훅.
 * - `useSky("scroll")`: 시작 화면(.scene[data-min]) 스크롤 연동
 * - `useSky("now")`: 현재 시각 연동(대시보드·관리자, 옅은 막 활성)
 * - `useSky("21:30")`: 고정 시각(이전 시각에서 앞뒤 중 가까운 쪽으로 900ms 흐름)
 * - `useSky("21:30", steps, activeStep)`: 단계별 시각 맵과 현재 단계를 함께 넘기면 단계가 바뀔 때 흐른다
 */
export function useSky(mode: SkyMode, steps?: SkyStepsInput, activeStep?: string): void {
  const resolved = resolveSkyValue(mode, steps, activeStep);

  useEffect(() => {
    activeHookCount++;
    return () => {
      activeHookCount = Math.max(0, activeHookCount - 1);
      if (activeHookCount === 0 && backdropMountedCount === 0) {
        DAY.run++;
        DAY.initialized = false;
      }
    };
  }, []);

  useEffect(() => {
    return applySkyMode(resolved);
  }, [resolved]);
}
