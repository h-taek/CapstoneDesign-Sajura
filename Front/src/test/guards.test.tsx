// 라우트 가드 목적지(상태 넷 × 경로), 설정 하위 판 라우팅, 루트 하늘 유지 시험.
import { act, render, screen } from "@testing-library/react";
import {
  MemoryRouter,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DAY, dayClock, goDashboard, resetSkyState, useSky } from "../components/sky";
import {
  RequireAdmin,
  RequireGuest,
  RequireStage,
  currentOnboardingStep,
  landingPath,
} from "../routes/guards";
import RootLayout from "../routes/root-layout";
import { SETTINGS_PANELS } from "../routes/router";
import { type AuthUser, useAuthStore } from "../stores/auth-store";
import { useOnboardingStore } from "../stores/onboarding-store";

const verifiedUser: AuthUser = {
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

function LocationProbe() {
  const location = useLocation();
  const params = useParams();
  return (
    <div>
      <span data-testid="path">{location.pathname}</span>
      <span data-testid="splat">{params["*"] ?? ""}</span>
    </div>
  );
}

function SettingsProbe() {
  const params = useParams();
  const splat = (params["*"] ?? "").replace(/^\/+|\/+$/g, "");
  if (splat !== "" && !SETTINGS_PANELS.includes(splat as (typeof SETTINGS_PANELS)[number])) {
    return <LocationProbe />;
  }
  return <LocationProbe />;
}

function renderGuardedPath(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<RootLayout />}>
          <Route path="/intro" element={<LocationProbe />} />
          <Route
            path="/login"
            element={
              <RequireGuest>
                <LocationProbe />
              </RequireGuest>
            }
          />
          <Route
            path="/register"
            element={
              <RequireGuest>
                <LocationProbe />
              </RequireGuest>
            }
          />
          <Route
            path="/verify-business"
            element={
              <RequireStage stage="verify">
                <LocationProbe />
              </RequireStage>
            }
          />
          <Route
            path="/onboarding/*"
            element={
              <RequireStage stage="onboarding">
                <Outlet />
              </RequireStage>
            }
          >
            <Route path="*" element={<LocationProbe />} />
          </Route>
          <Route
            path="/admin/verifications"
            element={
              <RequireAdmin>
                <LocationProbe />
              </RequireAdmin>
            }
          />
          <Route
            path="/settings/*"
            element={
              <RequireStage stage="app">
                <SettingsProbe />
              </RequireStage>
            }
          />
          <Route
            path="/sales"
            element={
              <RequireStage stage="app">
                <LocationProbe />
              </RequireStage>
            }
          />
          <Route
            path="/forecast"
            element={
              <RequireStage stage="app">
                <LocationProbe />
              </RequireStage>
            }
          />
          <Route
            path="/inventory"
            element={
              <RequireStage stage="app">
                <LocationProbe />
              </RequireStage>
            }
          />
          <Route
            path="/orders"
            element={
              <RequireStage stage="app">
                <LocationProbe />
              </RequireStage>
            }
          />
          <Route
            path="/menus"
            element={
              <RequireStage stage="app">
                <LocationProbe />
              </RequireStage>
            }
          />
          <Route
            path="/"
            element={
              <RequireStage stage="app">
                <LocationProbe />
              </RequireStage>
            }
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("가드 목적지 (상태 넷 × 경로)", () => {
  beforeEach(() => {
    resetSkyState();
    useOnboardingStore.getState().reset();
    useAuthStore.setState({ bootstrapped: true, accessToken: null, user: null });
  });

  afterEach(() => {
    resetSkyState();
    useOnboardingStore.getState().reset();
    useAuthStore.getState().clear();
    vi.useRealTimers();
  });

  it("1) 미인증 상태: /intro·/login·/register는 허용하고, /는 /intro로, 나머지 경로는 /login으로 보낸다", () => {
    for (const allowed of ["/intro", "/login", "/register"]) {
      const { unmount } = renderGuardedPath(allowed);
      expect(screen.getByTestId("path")).toHaveTextContent(allowed);
      unmount();
    }

    const protectedPaths = [
      "/verify-business",
      "/onboarding/1",
      "/forecast",
      "/inventory",
      "/menus",
      "/sales",
      "/orders",
      "/settings",
      "/settings/pos/upload",
      "/admin/verifications",
    ];
    for (const path of protectedPaths) {
      const { unmount } = renderGuardedPath(path);
      expect(screen.getByTestId("path")).toHaveTextContent("/login");
      unmount();
    }

    const { unmount } = renderGuardedPath("/");
    expect(screen.getByTestId("path")).toHaveTextContent("/intro");
    unmount();
  });

  it("2) 사업자 미인증·반려(UNVERIFIED·REJECTED): /intro와 /verify-business 외 모든 경로를 /verify-business로 보낸다", () => {
    for (const status of ["UNVERIFIED", "REJECTED"] as const) {
      useAuthStore.setState({
        bootstrapped: true,
        accessToken: "tok",
        user: { ...verifiedUser, business_status: status, onboarding_completed: false },
      });

      const { unmount: uIntro } = renderGuardedPath("/intro");
      expect(screen.getByTestId("path")).toHaveTextContent("/intro");
      uIntro();

      const { unmount: uVerify } = renderGuardedPath("/verify-business");
      expect(screen.getByTestId("path")).toHaveTextContent("/verify-business");
      uVerify();

      for (const path of [
        "/login",
        "/register",
        "/onboarding/1",
        "/",
        "/forecast",
        "/inventory",
        "/menus",
        "/sales",
        "/orders",
        "/settings",
        "/admin/verifications",
      ]) {
        const { unmount } = renderGuardedPath(path);
        expect(screen.getByTestId("path")).toHaveTextContent("/verify-business");
        unmount();
      }
    }
  });

  it("3) 사업자 PENDING·VERIFIED + 온보딩 미완료: /onboarding/{현재 스텝}으로 보낸다", () => {
    for (const status of ["PENDING", "VERIFIED"] as const) {
      useOnboardingStore.getState().reset();
      useAuthStore.setState({
        bootstrapped: true,
        accessToken: "tok",
        user: { ...verifiedUser, business_status: status, onboarding_completed: false },
      });

      for (const path of [
        "/login",
        "/register",
        "/verify-business",
        "/",
        "/forecast",
        "/inventory",
        "/menus",
        "/sales",
        "/orders",
        "/settings",
        "/admin/verifications",
      ]) {
        const { unmount } = renderGuardedPath(path);
        expect(screen.getByTestId("path")).toHaveTextContent("/onboarding/1");
        unmount();
      }
    }

    // 온보딩 스텝 진행 상태가 있으면 해당 스텝으로 이동한다
    useOnboardingStore.getState().setStore({
      store_name: "사주라",
      business_type: "양식",
      store_size: "MEDIUM",
      operation_type: "BOTH",
      address: "서울 성동구",
      phone: "02-000-0000",
    });
    expect(currentOnboardingStep()).toBe(2);
    expect(landingPath({ ...verifiedUser, onboarding_completed: false })).toBe("/onboarding/2");

    useOnboardingStore.getState().setPos({ pos_type: "CSV_ONLY" });
    expect(currentOnboardingStep()).toBe(3);

    useOnboardingStore
      .getState()
      .setMenus([{ name: "피자", category: "메인", price: 16000, is_active: true }]);
    expect(currentOnboardingStep()).toBe(4);
    expect(landingPath({ ...verifiedUser, onboarding_completed: false })).toBe("/onboarding/4");
  });

  it("4) 온보딩 완료: 게이트 경로는 /로 보내고, 메인·/sales·/settings/* 판 7개를 허용하며, 비관리자 /admin은 /로 보낸다", () => {
    useAuthStore.setState({
      bootstrapped: true,
      accessToken: "tok",
      user: verifiedUser,
    });

    for (const gatePath of ["/login", "/register", "/verify-business", "/onboarding/1"]) {
      const { unmount } = renderGuardedPath(gatePath);
      expect(screen.getByTestId("path")).toHaveTextContent("/");
      unmount();
    }

    for (const appPath of [
      "/",
      "/forecast",
      "/inventory",
      "/menus",
      "/sales",
      "/orders",
      "/settings",
      ...SETTINGS_PANELS.map((p) => `/settings/${p}`),
    ]) {
      const { unmount } = renderGuardedPath(appPath);
      expect(screen.getByTestId("path")).toHaveTextContent(appPath);
      unmount();
    }

    // OWNER가 /admin/verifications 접근 시 /로 리다이렉트
    const { unmount: uOwnerAdmin } = renderGuardedPath("/admin/verifications");
    expect(screen.getByTestId("path")).toHaveTextContent("/");
    uOwnerAdmin();

    // ADMIN은 /admin/verifications 통과
    useAuthStore.setState({
      bootstrapped: true,
      accessToken: "tok",
      user: { ...verifiedUser, role: "ADMIN" },
    });
    const { unmount: uAdmin } = renderGuardedPath("/admin/verifications");
    expect(screen.getByTestId("path")).toHaveTextContent("/admin/verifications");
    uAdmin();
  });

  it("루트 레이아웃의 하늘(.bd-day)은 화면을 넘겨도 다시 마운트되지 않고 시각을 이어받는다", () => {
    vi.useFakeTimers();

    function StepScreen() {
      const navigate = useNavigate();
      const { pathname } = useLocation();
      useSky(pathname === "/register" ? "21:45" : "21:30");
      return (
        <button type="button" onClick={() => navigate("/register")}>
          다음 화면
        </button>
      );
    }

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route element={<RootLayout />}>
            <Route path="/login" element={<StepScreen />} />
            <Route path="/register" element={<StepScreen />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    const firstBackdrop = document.querySelector(".bd-day");
    expect(firstBackdrop).not.toBeNull();
    expect(dayClock(DAY.mf)).toBe("21:30");

    act(() => {
      screen.getByRole("button", { name: "다음 화면" }).click();
    });

    const secondBackdrop = document.querySelector(".bd-day");
    expect(secondBackdrop).toBe(firstBackdrop);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(dayClock(DAY.mf)).toBe("21:45");
  });

  it("가드 목적지가 홈('/')인 사용자에게만 아침이 밝기 시계가 동작한다", async () => {
    vi.useFakeTimers();
    const navigate = vi.fn();

    // 미완료 사용자는 시계 없이 즉시 /onboarding/1로 이동
    const incomplete: AuthUser = { ...verifiedUser, onboarding_completed: false };
    await expect(goDashboard(landingPath(incomplete), navigate)).resolves.toBe("/onboarding/1");
    expect(document.querySelector(".morning-clock")).toBeNull();

    // 완료 사용자는 아침이 밝기 시계 회전 후 /로 이동
    const promise = goDashboard(landingPath(verifiedUser), navigate);
    vi.advanceTimersByTime(400);
    expect(document.querySelector(".morning-clock")).not.toBeNull();
    vi.advanceTimersByTime(2200);
    await expect(promise).resolves.toBe("/");
  });
});
