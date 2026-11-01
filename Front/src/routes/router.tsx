// 라우터 정의 — 04_fe.md §3.
import { Navigate, type RouteObject, createBrowserRouter, useParams } from "react-router";
import AdminVerificationsPage from "./admin/verifications";
import ForecastPage from "./forecast";
import { RequireAdmin, RequireGuest, RequireStage, currentOnboardingStep } from "./guards";
import HomePage from "./home";
import IntroPage from "./intro";
import InventoryPage from "./inventory";
import LoginPage from "./login";
import MenusPage from "./menus";
import OnboardingLayout from "./onboarding/layout";
import ConfirmStep from "./onboarding/step-confirm";
import MenusStep from "./onboarding/step-menus";
import PosStep from "./onboarding/step-pos";
import StoreStep from "./onboarding/step-store";
import OrdersPage from "./orders";
import RegisterPage from "./register";
import RootLayout from "./root-layout";
import SalesPage from "./sales/index";
import SettingsHubPage from "./settings/index";
import VerifyBusinessPage from "./verify-business";

export const SETTINGS_PANELS = [
  "account",
  "notifications",
  "store",
  "pos",
  "pos/upload",
  "coupang",
  "app-info",
] as const;

export type SettingsPanel = (typeof SETTINGS_PANELS)[number];

function OnboardingIndexRedirect() {
  return <Navigate to={`/onboarding/${currentOnboardingStep()}`} replace />;
}

function SettingsRoute() {
  const params = useParams();
  const splat = (params["*"] ?? "").replace(/^\/+|\/+$/g, "");
  if (splat !== "" && !SETTINGS_PANELS.includes(splat as SettingsPanel)) {
    return <Navigate to="/settings" replace />;
  }
  return <SettingsHubPage />;
}

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      // 서비스 소개 — 로그인 없이 누구나 (PWA 설치 안내 포함)
      { path: "/intro", element: <IntroPage /> },
      {
        path: "/login",
        element: (
          <RequireGuest>
            <LoginPage />
          </RequireGuest>
        ),
      },
      {
        path: "/register",
        element: (
          <RequireGuest>
            <RegisterPage />
          </RequireGuest>
        ),
      },
      {
        path: "/verify-business",
        element: (
          <RequireStage stage="verify">
            <VerifyBusinessPage />
          </RequireStage>
        ),
      },
      {
        path: "/onboarding",
        element: (
          <RequireStage stage="onboarding">
            <OnboardingLayout />
          </RequireStage>
        ),
        children: [
          { index: true, element: <OnboardingIndexRedirect /> },
          { path: "1", element: <StoreStep /> },
          { path: "2", element: <PosStep /> },
          { path: "3", element: <MenusStep /> },
          { path: "4", element: <ConfirmStep /> },
          { path: "*", element: <OnboardingIndexRedirect /> },
        ],
      },
      {
        path: "/admin/verifications",
        element: (
          <RequireAdmin>
            <AdminVerificationsPage />
          </RequireAdmin>
        ),
      },
      {
        path: "/admin/*",
        element: (
          <RequireAdmin>
            <Navigate to="/admin/verifications" replace />
          </RequireAdmin>
        ),
      },
      {
        path: "/settings/*",
        element: (
          <RequireStage stage="app">
            <SettingsRoute />
          </RequireStage>
        ),
      },
      {
        path: "/sales",
        element: (
          <RequireStage stage="app">
            <SalesPage />
          </RequireStage>
        ),
      },
      {
        path: "/forecast",
        element: (
          <RequireStage stage="app">
            <ForecastPage />
          </RequireStage>
        ),
      },
      {
        path: "/inventory",
        element: (
          <RequireStage stage="app">
            <InventoryPage />
          </RequireStage>
        ),
      },
      {
        path: "/orders",
        element: (
          <RequireStage stage="app">
            <OrdersPage />
          </RequireStage>
        ),
      },
      {
        path: "/menus",
        element: (
          <RequireStage stage="app">
            <MenusPage />
          </RequireStage>
        ),
      },
      {
        path: "/",
        element: (
          <RequireStage stage="app">
            <HomePage />
          </RequireStage>
        ),
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
