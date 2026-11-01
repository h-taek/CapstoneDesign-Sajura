// 사장님의 하루(하늘 배경) — 시각별 하늘 색·별·달·해·동네 실루엣 보간과 전환 연출(mockup.js 이식).
import type { AuthUser } from "../../stores/auth-store";
import { useAuthStore } from "../../stores/auth-store";
import { useOnboardingStore } from "../../stores/onboarding-store";

export type RgbTuple = [number, number, number];

export type DayKey = readonly [
  minutes: number,
  sky: readonly [string, string, string],
  stars: number,
  town: string,
  win: string,
  fg: number,
];

export interface DaySample {
  sky: [RgbTuple, RgbTuple, RgbTuple];
  stars: number;
  town: RgbTuple;
  win: RgbTuple;
  fg: number;
}

export type SkyNavigate = (to: string, options?: { replace?: boolean }) => void;

// [분, 하늘 위·가운데·아래, 별, 동네, 가게 창문, 하늘 위 글자 밝기(0 흰색 → 1 진한 글자)]
// 열쇠 시각 사이는 직선으로 섞는다. 시작 화면 장면 시각(21:30 22:40 02:00 07:30 10:00 14:00 19:00)과 같다.
export const DAY_KEYS: readonly DayKey[] = [
  [120, ["#05031a", "#110b3a", "#2a1d6a"], 1, "#07051a", "#8f7bff", 0], // 02:00 — 창문은 사주라가 일하는 보라 불
  [450, ["#3e36a8", "#ac86d8", "#ffc6a6"], 0.12, "#3a2c78", "#3a2c78", 0.2], // 07:30 새벽
  [600, ["#8ea6ff", "#c8c2ff", "#f3efff"], 0, "#b9b0f0", "#fff3c4", 1], // 10:00
  [840, ["#a6b8ff", "#dcd7ff", "#faf8ff"], 0, "#d4cdfb", "#fff3c4", 1], // 14:00
  [1140, ["#a9a6f4", "#e7d3f4", "#ffd6bf"], 0, "#c9b9ec", "#ffd27a", 1], // 19:00
  [1290, ["#241a5e", "#6a46c4", "#f2988c"], 0.35, "#1d1446", "#ffd27a", 0], // 21:30 마감
  [1360, ["#110b36", "#24195f", "#4a368f"], 0.8, "#0f0a2c", "#ffd27a", 0], // 22:40
] as const;

const SHOP_RINGS: ReadonlyArray<readonly [number, number]> = [
  [0.3, 0],
  [0.6, 0.12],
];
export const SHOP_GLOW_OPACITY = 1 - SHOP_RINGS.reduce((a, [o]) => a * (1 - o), 1);
export const SHOP_SKY = 1290;
export const SHOP_LEAVE_MS = 950;
export const SHOP_ARRIVE_MS = 1100;
export const SHOP_SPLIT = SHOP_LEAVE_MS / (SHOP_LEAVE_MS + SHOP_ARRIVE_MS);

export const shopEase = (p: number): number => (1 - Math.cos(Math.PI * p)) / 2;

export function dayHex(h: string): RgbTuple {
  return [
    Number.parseInt(h.slice(1, 3), 16),
    Number.parseInt(h.slice(3, 5), 16),
    Number.parseInt(h.slice(5, 7), 16),
  ];
}

export function dayMix(a: string, b: string, t: number): RgbTuple {
  const ca = dayHex(a);
  const cb = dayHex(b);
  return [
    Math.round(ca[0] + (cb[0] - ca[0]) * t),
    Math.round(ca[1] + (cb[1] - ca[1]) * t),
    Math.round(ca[2] + (cb[2] - ca[2]) * t),
  ];
}

export function dayRgb(c: readonly number[], alpha?: number): string {
  return `rgb(${c.join(" ")}${alpha === undefined ? "" : ` / ${alpha}`})`;
}

export function dayLerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function dayClock(mf: number): string {
  const m = ((Math.round(mf) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** "HH:MM" 문자열 또는 분 숫자를 분(0~1439)으로 바꾼다. */
export function parseSkyMinutes(value: string | number): number {
  if (typeof value === "number") return value;
  const [hStr, mStr] = value.trim().split(":");
  const h = Number(hStr);
  const m = Number(mStr ?? 0);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 1290;
  return h * 60 + m;
}

/** from(분)에서 to(분)로 갈 때 앞뒤 중 가까운 쪽(자정 넘김 포함)의 시작·목표 분을 돌려준다. */
export function nearestSkyMinutes(from: number, to: number): [fromNorm: number, toTarget: number] {
  const f = ((Math.round(from) % 1440) + 1440) % 1440;
  let t = ((Math.round(to) % 1440) + 1440) % 1440;
  while (t - f > 720) t -= 1440;
  while (f - t > 720) t += 1440;
  return [f, t];
}

export const DAY = {
  mf: 1290,
  win: [255, 210, 122] as RgbTuple,
  redraw: (): void => {},
  run: 0,
  flowP: 0,
  calm: false,
  initialized: false,
};

let morningActive = false;
const morningListeners = new Set<() => void>();

function setMorningActive(next: boolean): void {
  if (morningActive === next) return;
  morningActive = next;
  for (const fn of morningListeners) fn();
}

export function isMorningTransitioning(): boolean {
  return morningActive;
}

export function subscribeMorningTransition(listener: () => void): () => void {
  morningListeners.add(listener);
  return () => {
    morningListeners.delete(listener);
  };
}

export function reduceMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

/** 분(자정을 넘으면 1440 초과·음수 가능)을 받아 해당 시각의 하늘·별·동네·창문·글자 밝기를 보간한다. */
export function dayAt(mf: number): DaySample {
  const d = ((mf % 1440) + 1440) % 1440;
  let i = DAY_KEYS.length - 1;
  DAY_KEYS.forEach(([m], k) => {
    if (m <= d) i = k;
  });
  const A = DAY_KEYS[i]!;
  const B = DAY_KEYS[(i + 1) % DAY_KEYS.length]!;
  const span = (((B[0] - A[0]) % 1440) + 1440) % 1440;
  const t = ((((d - A[0]) % 1440) + 1440) % 1440) / span;
  return {
    sky: [dayMix(A[1][0], B[1][0], t), dayMix(A[1][1], B[1][1], t), dayMix(A[1][2], B[1][2], t)],
    stars: dayLerp(A[2], B[2], t),
    town: dayMix(A[3], B[3], t),
    win: dayMix(A[4], B[4], t),
    fg: dayLerp(A[5], B[5], t),
  };
}

export function setSkyCalm(calm: boolean): void {
  DAY.calm = calm;
  if (typeof document === "undefined") return;
  const bd = document.querySelector<HTMLElement>(".bd-day");
  if (!bd) return;
  if (calm) bd.setAttribute("data-calm", "");
  else bd.removeAttribute("data-calm");
}

/** 주어진 분(mf)으로 하늘 배경과 document.documentElement의 --sky-fg·--sky-fg2·--sky-pill·--sky-halo를 갱신한다. */
export function drawDay(mf: number): DaySample {
  DAY.mf = mf;
  const s = dayAt(mf);
  DAY.win = s.win;
  const bd =
    typeof document !== "undefined" ? document.querySelector<HTMLElement>(".bd-day") : null;
  const calm = bd ? bd.hasAttribute("data-calm") : DAY.calm;

  if (typeof document !== "undefined") {
    const root = document.documentElement.style;
    if (!calm) {
      root.setProperty("--sky-fg", dayRgb(dayMix("#ffffff", "#111827", s.fg)));
      root.setProperty("--sky-fg2", dayRgb(dayMix("#dcd8f2", "#374151", s.fg)));
      root.setProperty("--sky-pill", dayRgb(s.sky[0], 0.42));
      // 제목 높이(화면 위 약 20%)의 하늘색 — 맨 위 색과 55% 지점 색 사이
      root.setProperty(
        "--sky-halo",
        dayRgb(s.sky[0].map((v, i) => Math.round(v + ((s.sky[1]?.[i] ?? v) - v) * 0.4))),
      );
    } else {
      root.setProperty("--sky-fg", "#111827");
      root.setProperty("--sky-fg2", "#374151");
      root.setProperty("--sky-pill", "rgb(255 255 255 / 0.1)");
      root.setProperty("--sky-halo", "transparent");
    }
    for (const el of document.querySelectorAll<HTMLElement>("[data-sky-clock]")) {
      el.textContent = dayClock(mf);
    }
  }

  if (!bd) return s;

  const skyEl = bd.querySelector<HTMLElement>(".d-sky");
  if (skyEl) {
    skyEl.style.background = `linear-gradient(180deg, ${dayRgb(s.sky[0])} 0%, ${dayRgb(s.sky[1])} 55%, ${dayRgb(s.sky[2])} 100%)`;
  }
  const starsEl = bd.querySelector<SVGElement | HTMLElement>(".d-stars");
  if (starsEl) {
    starsEl.style.opacity = String(s.stars);
  }
  const veilEl = bd.querySelector<HTMLElement>(".d-veil");
  if (veilEl) {
    veilEl.style.opacity = String(calm ? 0.25 + (1 - s.fg) * 0.55 : 0);
  }

  // 달·해 — 같은 호를 같은 방향(오른쪽 → 왼쪽)으로 넘어간다.
  const narrow = typeof window !== "undefined" ? window.innerWidth < 860 : false;
  const arc = (el: HTMLElement | null, f: number) => {
    if (!el) return;
    const p = Math.min(1, Math.max(0, f));
    let y = 84 - 70 * Math.sin(Math.PI * p);
    if (narrow) y = 4 + (y - 6) * 0.12;
    el.style.left = `${92 - 84 * p}vw`;
    el.style.top = `${y}vh`;
    const op =
      f > 0 && f < 1
        ? Math.min(1, p / 0.06, (1 - p) / 0.06) * (narrow ? 0.5 : 1) * (calm ? 0.35 : 1)
        : 0;
    el.style.opacity = String(op);
  };

  const d = ((mf % 1440) + 1440) % 1440;
  arc(bd.querySelector<HTMLElement>(".d-sun"), (d - 390) / 780); // 06:30 뜨고 19:30 진다
  arc(bd.querySelector<HTMLElement>(".d-moon"), ((((mf - 1170) % 1440) + 1440) % 1440) / 720); // 19:30 뜨고 07:30 진다

  const town = bd.querySelector<SVGElement | HTMLElement>(".d-town");
  if (town) {
    town.style.opacity = String(calm ? 0.3 : 1);
    for (const el of town.querySelectorAll(".d-fill")) {
      el.setAttribute("fill", dayRgb(s.town));
    }
    for (const el of town.querySelectorAll(".d-win")) {
      el.setAttribute("fill", dayRgb(s.win));
    }
  }
  return s;
}

/** 진행률 p0 → p1을 ms 동안 그린다. run이 바뀌면 멈춘다. */
export function flowSky(
  from: number,
  to: number,
  p0: number,
  p1: number,
  ms: number,
  run: number,
): void {
  let t0: number | null = null;
  const step = (ts: number) => {
    if (run !== DAY.run) return;
    if (t0 === null) t0 = ts;
    const k = Math.min(1, (ts - t0) / ms);
    DAY.flowP = p0 + (p1 - p0) * k;
    drawDay(from + (to - from) * shopEase(DAY.flowP));
    if (k < 1) requestAnimationFrame(step);
  };
  DAY.flowP = p0;
  drawDay(from + (to - from) * shopEase(p0));
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(step);
  }
}

/** from에서 to로 앞뒤 중 가까운 쪽으로 흐른다. */
export function flowTo(from: number, to: number, ms = 900): number {
  const [f, t] = nearestSkyMinutes(from, to);
  if (t === f || reduceMotion()) {
    drawDay(to);
  } else {
    flowSky(f, t, 0, 1, ms, ++DAY.run);
  }
  return t;
}

function resolveOnboardingPath(): string {
  const { store, pos, menus } = useOnboardingStore.getState();
  if (!store) return "/onboarding/1";
  if (!pos) return "/onboarding/2";
  if (menus.length === 0) return "/onboarding/3";
  return "/onboarding/4";
}

function userDestination(user: AuthUser): string {
  if (user.business_status === "UNVERIFIED" || user.business_status === "REJECTED") {
    return "/verify-business";
  }
  if (!user.onboarding_completed) return resolveOnboardingPath();
  return "/";
}

function resolveDestination(target?: string | AuthUser | null): string {
  if (typeof target === "string" && target.length > 0) return target;
  if (target && typeof target === "object") return userDestination(target);
  const currentUser = useAuthStore.getState().user;
  if (currentUser) return userDestination(currentUser);
  return "/";
}

/**
 * 로그인·온보딩 완료 후 이동.
 * 목적지(가드 redirect 순서)가 홈('/')일 때만 시계를 지금 시각까지 돌리는 '아침이 밝기' 연출 후 홈으로 이동한다.
 * 목적지가 '/verify-business'나 '/onboarding/*'이면 연출 없이 바로 이동한다.
 */
export function goDashboard(
  target?: string | AuthUser | null,
  navigate?: SkyNavigate,
): Promise<string> {
  const dest = resolveDestination(target);
  if (dest !== "/") {
    navigate?.(dest, { replace: true });
    return Promise.resolve(dest);
  }
  if (reduceMotion() || typeof document === "undefined") {
    navigate?.("/", { replace: true });
    return Promise.resolve("/");
  }

  const run = ++DAY.run;
  setMorningActive(true);
  setSkyCalm(false);
  document.body.classList.add("leaving");

  const from = DAY.mf;
  const now = new Date();
  let to = now.getHours() * 60 + now.getMinutes();
  while (to <= from) to += 1440;

  return new Promise<string>((resolve) => {
    const finish = () => {
      for (const el of document.querySelectorAll(".morning-clock")) el.remove();
      document.body.classList.remove("leaving");
      document.body.classList.add("entering");
      setMorningActive(false);
      setSkyCalm(true);
      drawDay(now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60);
      navigate?.("/", { replace: true });
      resolve("/");
      setTimeout(() => {
        if (typeof document !== "undefined") {
          document.body.classList.remove("entering");
        }
      }, 1200);
    };

    const clock = document.createElement("div");
    clock.className = "morning-clock";
    const dur = 1800;
    let t0: number | null = null;

    const step = (ts: number) => {
      if (run !== DAY.run) {
        clock.remove();
        setMorningActive(false);
        resolve("/");
        return;
      }
      if (t0 === null) t0 = ts;
      const p = Math.min(1, (ts - t0) / dur);
      const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
      drawDay(from + (to - from) * e);
      clock.textContent = dayClock(DAY.mf);
      clock.style.color =
        document.documentElement.style.getPropertyValue("--sky-fg") ||
        getComputedStyle(document.documentElement).getPropertyValue("--sky-fg");
      if (p < 1) {
        requestAnimationFrame(step);
      } else {
        setTimeout(() => {
          if (run !== DAY.run) {
            clock.remove();
            setMorningActive(false);
            resolve("/");
            return;
          }
          finish();
        }, 300);
      }
    };

    setTimeout(() => {
      if (run !== DAY.run) {
        setMorningActive(false);
        resolve("/");
        return;
      }
      document.body.appendChild(clock);
      requestAnimationFrame(step);
    }, 350);
  });
}

/** 가게로 들어가기(시작 화면 → 로그인/회원가입) — 창문 빛 두 겹 원이 퍼지며 하늘이 21:30으로 흐른다. */
export function goShop(to = "/login", navigate?: SkyNavigate): Promise<string> {
  if (typeof document === "undefined" || reduceMotion()) {
    navigate?.(to);
    return Promise.resolve(to);
  }
  const win = document.querySelector<SVGGraphicsElement>(".bd-day .d-win");
  if (!win) {
    navigate?.(to);
    return Promise.resolve(to);
  }

  const glow = DAY.win.map((v) => v.toString(16).padStart(2, "0")).join("");
  const [from, target] = nearestSkyMinutes(DAY.mf, SHOP_SKY);
  const r = win.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const far = Math.hypot(
    Math.max(cx, window.innerWidth - cx),
    Math.max(cy, window.innerHeight - cy),
  );

  const rings = SHOP_RINGS.map(([opacity, delay]) => {
    const el = document.createElement("div");
    el.className = "shop-light";
    el.style.background = `#${glow}`;
    el.style.opacity = String(opacity);
    el.style.clipPath = `circle(${Math.hypot(r.width, r.height) / 2}px at ${cx}px ${cy}px)`;
    el.dataset.delay = String(delay);
    document.body.appendChild(el);
    return el;
  });

  document.body.classList.add("going-shop");
  const run = ++DAY.run;
  if (target !== from) flowSky(from, target, 0, SHOP_SPLIT, SHOP_LEAVE_MS, run);

  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      for (const el of rings) {
        el.style.transition = `clip-path 0.8s cubic-bezier(0.7, 0, 0.2, 1) ${el.dataset.delay}s`;
        el.style.clipPath = `circle(${far}px at ${cx}px ${cy}px)`;
      }
    }),
  );

  return new Promise<string>((resolve) => {
    setTimeout(() => {
      for (const el of rings) el.remove();
      document.body.classList.remove("going-shop");
      if (run !== DAY.run) {
        resolve(to);
        return;
      }
      navigate?.(to);
      document.body.classList.add("arrive-shop");
      const light = document.createElement("div");
      light.className = "shop-light out";
      light.style.background = `#${glow}`;
      light.style.opacity = String(SHOP_GLOW_OPACITY);
      document.body.appendChild(light);
      if (target !== from) {
        flowSky(from, target, DAY.flowP || SHOP_SPLIT, 1, SHOP_ARRIVE_MS, ++DAY.run);
      }
      setTimeout(() => {
        light.remove();
        document.body.classList.remove("arrive-shop");
      }, SHOP_ARRIVE_MS);
      resolve(to);
    }, SHOP_LEAVE_MS);
  });
}

/** 시험·초기화용 하늘 상태 리셋. */
export function resetSkyState(): void {
  DAY.run++;
  DAY.mf = 1290;
  DAY.win = [255, 210, 122];
  DAY.redraw = () => {};
  DAY.flowP = 0;
  DAY.calm = false;
  DAY.initialized = false;
  setMorningActive(false);
  if (typeof document !== "undefined") {
    for (const el of document.querySelectorAll(".morning-clock, .shop-light")) el.remove();
    document.body.classList.remove("leaving", "entering", "going-shop", "arrive-shop");
  }
}
