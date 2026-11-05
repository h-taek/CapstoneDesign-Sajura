// 하늘 시각 보간(열쇠 시각 사이·자정 넘김)·글자 색 변수·아침이 밝기 단위 시험.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DAY,
  applySkyMode,
  dayAt,
  dayClock,
  dayHex,
  dayMix,
  dayRgb,
  defaultSkyForPath,
  drawDay,
  flowTo,
  goDashboard,
  nearestSkyMinutes,
  parseSkySteps,
  resetSkyState,
  resolveSkyValue,
} from "../components/sky";
import type { AuthUser } from "../stores/auth-store";

const baseUser: AuthUser = {
  user_id: "u-1",
  email: "owner@sajura.kr",
  name: "김사주",
  auth_provider: "LOCAL",
  role: "OWNER",
  store_name: "사주라 화덕피자",
  business_no: "123-45-67890",
  business_status: "VERIFIED",
  onboarding_completed: true,
  created_at: "2026-01-01T00:00:00Z",
};

describe("dayAt 하늘 색 보간", () => {
  beforeEach(() => {
    resetSkyState();
  });

  afterEach(() => {
    resetSkyState();
    vi.useRealTimers();
  });

  it("열쇠 시각(02:00, 10:00, 21:30, 22:40)에서 정의된 값을 그대로 돌려준다", () => {
    const at0200 = dayAt(120);
    expect(at0200.sky[0]).toEqual(dayHex("#05031a"));
    expect(at0200.stars).toBe(1);
    expect(at0200.fg).toBe(0);

    const at1000 = dayAt(600);
    expect(at1000.sky[0]).toEqual(dayHex("#8ea6ff"));
    expect(at1000.stars).toBe(0);
    expect(at1000.fg).toBe(1);

    const at2130 = dayAt(1290);
    expect(at2130.sky[0]).toEqual(dayHex("#241a5e"));
    expect(at2130.stars).toBeCloseTo(0.35, 5);
    expect(at2130.fg).toBe(0);
  });

  it("열쇠 시각 사이(02:00~07:30, 10:00~14:00)를 직선으로 보간한다", () => {
    // 02:00(120)과 07:30(450)의 정중앙 = 285(04:45)
    const midDawn = dayAt(285);
    expect(midDawn.sky[0]).toEqual(dayMix("#05031a", "#3e36a8", 0.5));
    expect(midDawn.sky[1]).toEqual(dayMix("#110b3a", "#ac86d8", 0.5));
    expect(midDawn.sky[2]).toEqual(dayMix("#2a1d6a", "#ffc6a6", 0.5));
    expect(midDawn.stars).toBeCloseTo(0.56, 5);
    expect(midDawn.fg).toBeCloseTo(0.1, 5);

    // 10:00(600)과 14:00(840)의 정중앙 = 720(12:00)
    const midNoon = dayAt(720);
    expect(midNoon.sky[0]).toEqual(dayMix("#8ea6ff", "#a6b8ff", 0.5));
    expect(midNoon.stars).toBe(0);
    expect(midNoon.fg).toBe(1);
  });

  it("자정을 넘기는 구간(22:40 → 02:00, 200분 간격)을 끊김 없이 보간한다", () => {
    // 22:40(1360)에서 02:00(120)까지 총 200분. 정중앙(+100분)은 00:20(20 또는 1460)
    const afterMidnight = dayAt(20);
    const wrapped = dayAt(1460);
    expect(afterMidnight).toEqual(wrapped);
    expect(afterMidnight.sky[0]).toEqual(dayMix("#110b36", "#05031a", 0.5));
    expect(afterMidnight.sky[1]).toEqual(dayMix("#24195f", "#110b3a", 0.5));
    expect(afterMidnight.sky[2]).toEqual(dayMix("#4a368f", "#2a1d6a", 0.5));
    expect(afterMidnight.stars).toBeCloseTo(0.9, 5);
    expect(afterMidnight.town).toEqual(dayMix("#0f0a2c", "#07051a", 0.5));
    expect(afterMidnight.win).toEqual(dayMix("#ffd27a", "#8f7bff", 0.5));

    // 음수 분(-20분 = 23:40 = 1420분, t = 60 / 200 = 0.3)도 같은 값을 준다
    expect(dayAt(-20)).toEqual(dayAt(1420));
    expect(dayAt(-20).sky[0]).toEqual(dayMix("#110b36", "#05031a", 0.3));
  });

  it("nearestSkyMinutes와 flowTo가 자정 넘김에서 가까운 방향을 고른다", () => {
    // 23:40(1420) → 00:10(10): 앞으로 +30분(1420 → 1450)
    expect(nearestSkyMinutes(1420, 10)).toEqual([1420, 1450]);
    // 00:10(10) → 23:40(1420): 뒤로 -30분(10 → -20)
    expect(nearestSkyMinutes(10, 1420)).toEqual([10, -20]);

    vi.useFakeTimers();
    drawDay(1420);
    const target = flowTo(1420, 10, 900);
    expect(target).toBe(1450);
    vi.advanceTimersByTime(1000);
    expect(dayClock(DAY.mf)).toBe("00:10");
  });

  it("drawDay가 document.documentElement에 --sky-fg·--sky-fg2·--sky-pill을 설정한다", () => {
    drawDay(120); // 02:00 (fg = 0)
    const root = document.documentElement.style;
    expect(root.getPropertyValue("--sky-fg")).toBe("rgb(255 255 255)");
    expect(root.getPropertyValue("--sky-fg2")).toBe("rgb(220 216 242)");
    expect(root.getPropertyValue("--sky-pill")).toBe("rgb(5 3 26 / 0.42)");

    drawDay(600); // 10:00 (fg = 1)
    expect(root.getPropertyValue("--sky-fg")).toBe(dayRgb(dayMix("#ffffff", "#111827", 1)));
    expect(root.getPropertyValue("--sky-fg2")).toBe(dayRgb(dayMix("#dcd8f2", "#374151", 1)));

    const cleanup = applySkyMode("now");
    expect(root.getPropertyValue("--sky-fg")).toBe("#111827");
    expect(root.getPropertyValue("--sky-fg2")).toBe("#374151");
    cleanup();
  });

  it("data-sky-steps 문자열과 객체를 단계 시각으로 해석한다", () => {
    const raw = "store:22:40,pos:23:10,menus:23:40,confirm:00:10";
    expect(parseSkySteps(raw)).toEqual({
      store: "22:40",
      pos: "23:10",
      menus: "23:40",
      confirm: "00:10",
    });
    expect(resolveSkyValue("22:40", raw, "confirm")).toBe("00:10");
    expect(defaultSkyForPath("/intro")).toBe("scroll");
    expect(defaultSkyForPath("/login")).toBe("21:30");
    expect(defaultSkyForPath("/verify-business")).toBe("22:20");
    expect(defaultSkyForPath("/onboarding/4")).toBe("00:10");
    expect(defaultSkyForPath("/")).toBe("now");
  });
});

describe("goDashboard 아침이 밝기 전환", () => {
  beforeEach(() => {
    resetSkyState();
    vi.useFakeTimers();
  });

  afterEach(() => {
    resetSkyState();
    vi.useRealTimers();
  });

  it("목적지가 홈('/')일 때만 시계를 돌린 뒤 홈으로 이동한다", async () => {
    drawDay(1290); // 21:30에서 출발
    const navigate = vi.fn();

    const promise = goDashboard(baseUser, navigate);
    expect(document.body.classList.contains("leaving")).toBe(true);
    expect(navigate).not.toHaveBeenCalled();

    // 350ms 뒤 시계 등장
    vi.advanceTimersByTime(400);
    expect(document.querySelector(".morning-clock")).not.toBeNull();

    // 1800ms 시계 회전 + 300ms 대기 후 이동
    vi.advanceTimersByTime(2200);
    await expect(promise).resolves.toBe("/");
    expect(navigate).toHaveBeenCalledWith("/", { replace: true });
    expect(document.querySelector(".morning-clock")).toBeNull();
    expect(document.body.classList.contains("entering")).toBe(true);
  });

  it("목적지가 사업자 검증('/verify-business')이면 아침이 밝기 없이 즉시 이동한다", async () => {
    const navigate = vi.fn();
    const unverified: AuthUser = { ...baseUser, business_status: "UNVERIFIED" };

    const dest = await goDashboard(unverified, navigate);
    expect(dest).toBe("/verify-business");
    expect(navigate).toHaveBeenCalledWith("/verify-business", { replace: true });
    expect(document.querySelector(".morning-clock")).toBeNull();
    expect(document.body.classList.contains("leaving")).toBe(false);
  });

  it("목적지가 온보딩('/onboarding/1')이면 아침이 밝기 없이 즉시 이동한다", async () => {
    const navigate = vi.fn();
    const pendingOnboarding: AuthUser = { ...baseUser, onboarding_completed: false };

    const dest = await goDashboard(pendingOnboarding, navigate);
    expect(dest).toBe("/onboarding/1");
    expect(navigate).toHaveBeenCalledWith("/onboarding/1", { replace: true });
    expect(document.querySelector(".morning-clock")).toBeNull();
    expect(document.body.classList.contains("leaving")).toBe(false);
  });
});
