// 라우터 정의 — frontend_design.md §3.
import { Navigate, createBrowserRouter } from "react-router";
import AdminVerificationsPage from "./admin/verifications";
import ForecastPage from "./forecast";
import { RequireAdmin, RequireGuest, RequireStage } from "./guards";
import HomePage from "./home";
import InventoryPage from "./inventory";
import LoginPage from "./login";
import OnboardingLayout from "./onboarding/layout";
import ConfirmStep from "./onboarding/step-confirm";
import MenusStep from "./onboarding/step-menus";
import PosStep from "./onboarding/step-pos";
import StoreStep from "./onboarding/step-store";
import OrdersPage from "./orders";
import RecipesPage from "./recipes";
import RegisterPage from "./register";
import SalesUploadPage from "./sales/upload";
import AccountSettingsPage from "./settings/account";
import AppInfoSettingsPage from "./settings/app-info";
import SettingsHubPage from "./settings/index";
import NotificationSettingsPage from "./settings/notifications";
import PosSettingsPage from "./settings/pos";
import PricingSettingsPage from "./settings/pricing";
import VerifyBusinessPage from "./verify-business";

export const router = createBrowserRouter([
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
      { index: true, element: <Navigate to="/onboarding/1" replace /> },
      { path: "1", element: <StoreStep /> },
      { path: "2", element: <PosStep /> },
      { path: "3", element: <MenusStep /> },
      { path: "4", element: <ConfirmStep /> },
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
    path: "/settings",
    element: (
      <RequireStage stage="app">
        <SettingsHubPage />
      </RequireStage>
    ),
  },
  {
    path: "/settings/pos",
    element: (
      <RequireStage stage="app">
        <PosSettingsPage />
      </RequireStage>
    ),
  },
  {
    path: "/settings/pricing",
    element: (
      <RequireStage stage="app">
        <PricingSettingsPage />
      </RequireStage>
    ),
  },
  {
    path: "/settings/notifications",
    element: (
      <RequireStage stage="app">
        <NotificationSettingsPage />
      </RequireStage>
    ),
  },
  {
    path: "/settings/account",
    element: (
      <RequireStage stage="app">
        <AccountSettingsPage />
      </RequireStage>
    ),
  },
  {
    path: "/settings/app-info",
    element: (
      <RequireStage stage="app">
        <AppInfoSettingsPage />
      </RequireStage>
    ),
  },
  {
    path: "/sales/upload",
    element: (
      <RequireStage stage="app">
        <SalesUploadPage />
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
    path: "/recipes",
    element: (
      <RequireStage stage="app">
        <RecipesPage />
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
]);
