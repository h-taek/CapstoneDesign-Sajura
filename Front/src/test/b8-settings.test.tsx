// B8 설정 묶음 단위/통합 테스트 — 판 전환, 확장 연결/없음, 푸시 권한 거부, 설치 안내 분기.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as authApi from "../api/endpoints/auth";
import * as notifApi from "../api/endpoints/notifications";
import * as posApi from "../api/endpoints/pos";
import * as storeApi from "../api/endpoints/store";
import * as extensionLib from "../lib/extension";
import * as pwaInstall from "../lib/pwa-install";
import SettingsHubPage from "../routes/settings/index";
import { type AuthUser, useAuthStore } from "../stores/auth-store";

const testUser: AuthUser = {
  user_id: "test-user-id",
  email: "owner@sajura.kr",
  name: "김사주",
  auth_provider: "LOCAL",
  role: "OWNER",
  store_name: "사주라 화덕피자 성수점",
  business_no: "123-45-67890",
  business_status: "VERIFIED",
  onboarding_completed: true,
  created_at: "2026-01-01T00:00:00",
};

function renderSettings(initialEntry = "/settings") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/settings/*" element={<SettingsHubPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("B8 설정 화면", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({ accessToken: "tok", user: testUser });
    vi.spyOn(posApi, "getPosStatus").mockResolvedValue({
      status: "CSV_MODE",
      last_synced_at: "2026-10-19T21:42:00",
      error_message: null,
    });
    vi.spyOn(storeApi, "getStore").mockResolvedValue({
      store_id: "store-1",
      store_name: "사주라 화덕피자 성수점",
      business_no: "123-45-67890",
      business_status: "VERIFIED",
      business_reject_reason: null,
      business_type: "양식",
      store_size: "MEDIUM",
      operation_type: "BOTH",
      address: "서울특별시 성동구 연무장길 00",
      phone: "02-000-0000",
      onboarding_completed: true,
      created_at: "2026-01-01T00:00:00",
    });
    vi.spyOn(notifApi, "getNotificationSettings").mockResolvedValue({
      expiry: true,
      stock_low: true,
      forecast_done: true,
      anomaly: false,
    });
    vi.spyOn(extensionLib, "pingExtension").mockResolvedValue({
      ok: true,
      version: "0.1.0",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().clear();
  });

  it("로그아웃을 누르면 끝날 때까지 버튼을 막고 '로그아웃 중…'을 보여 준다", async () => {
    let finish: () => void = () => {};
    vi.spyOn(authApi, "logout").mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    renderSettings();

    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    expect(await screen.findByRole("button", { name: "로그아웃 중…" })).toBeDisabled();

    finish();
    await waitFor(() => expect(useAuthStore.getState().accessToken).toBeNull());
  });

  it("1) 판 전환: /settings 진입 시 판 없이 목록만 보이고, 고른 항목의 판이 열리며 X로 닫힌다", async () => {
    const { container } = renderSettings("/settings");
    expect(await screen.findByRole("button", { name: "POS 연동" })).toBeInTheDocument();
    expect(screen.queryByText("CSV 모드")).not.toBeInTheDocument();

    // POS 연동을 고르면 판이 열리고, X(닫기)로 닫힌다
    fireEvent.click(screen.getByRole("button", { name: "POS 연동" }));
    expect(await screen.findByText("CSV 모드")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "닫기" })[0] as HTMLElement);
    await waitFor(() => expect(screen.queryByText("CSV 모드")).not.toBeInTheDocument());

    // 알림 클릭
    const notifBtn = container.querySelector('button[data-row="notify"]');
    expect(notifBtn).toBeTruthy();
    fireEvent.click(notifBtn!);
    await waitFor(() => {
      expect(screen.getByText("소비기한 임박")).toBeInTheDocument();
      expect(screen.getByText("이 기기로 푸시 받기")).toBeInTheDocument();
    });

    // 매장 정보 클릭
    fireEvent.click(screen.getByRole("button", { name: "매장 정보" }));
    await waitFor(() => {
      expect(screen.getByLabelText("매장명")).toBeInTheDocument();
      expect(screen.getByText("인증됨")).toBeInTheDocument();
    });

    // 앱 정보 클릭
    fireEvent.click(screen.getByRole("button", { name: /앱 정보/ }));
    await waitFor(() => {
      expect(screen.getByText("이용약관")).toBeInTheDocument();
      expect(screen.getByText("개인정보처리방침")).toBeInTheDocument();
    });
  });

  it("2) 쿠팡 확장 연결됨 및 확장 없음 상태를 올바르게 표시한다", async () => {
    // 연결됨
    renderSettings("/settings/coupang");
    await waitFor(() => {
      expect(screen.getByText("연결됨")).toBeInTheDocument();
      expect(screen.getByText(/버전 0.1.0/)).toBeInTheDocument();
    });

    // 확장 없음 모킹
    vi.spyOn(extensionLib, "pingExtension").mockResolvedValue({
      ok: false,
      error: "확장 없음",
    });
    renderSettings("/settings/coupang");
    await waitFor(() => {
      expect(screen.getByText("설치 안 됨")).toBeInTheDocument();
      expect(screen.getByText(/PC 크롬에 사주라 확장을 설치하면/)).toBeInTheDocument();
    });
  });

  it("3) 알림 설정 카테고리 스위치 클릭 시 토글 API가 호출되고 푸시 권한 거부 시 스위치가 꺼진 상태를 유지한다", async () => {
    const updateSpy = vi.spyOn(notifApi, "updateNotificationSettings").mockResolvedValue({
      expiry: true,
      stock_low: true,
      forecast_done: true,
      anomaly: true,
    });

    renderSettings("/settings/notifications");
    await waitFor(() => {
      expect(screen.getByRole("switch", { name: "이상치 감지" })).toBeInTheDocument();
    });

    const anomalySwitch = screen.getByRole("switch", { name: "이상치 감지" });
    expect(anomalySwitch).toHaveAttribute("aria-checked", "false");

    fireEvent.click(anomalySwitch);
    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({ anomaly: true });
    });

    // 푸시 스위치: 권한 거부 시(Notification.permission === 'denied')
    const pushSwitch = screen.getByRole("switch", { name: "이 기기로 푸시 받기" });
    expect(pushSwitch).toHaveAttribute("aria-checked", "false");
  });

  it("4) PWA 설치 안내 분기: canPrompt=false 환경에서 설치 버튼 클릭 시 설치 안내 시트가 열린다", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    );

    renderSettings("/settings");
    const installBtn = screen.getByRole("button", { name: "홈 화면에 설치" });
    fireEvent.click(installBtn);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "홈 화면에 추가하는 방법" })).toBeInTheDocument();
      expect(screen.getByText(/아이폰은/)).toBeInTheDocument();
    });

    // 확인했어요 버튼으로 닫기
    fireEvent.click(screen.getByRole("button", { name: "확인했어요" }));
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "홈 화면에 추가하는 방법" }),
      ).not.toBeInTheDocument();
    });
  });

  it("5) PWA promptInstall 예외 시 안전하게 false를 반환한다", async () => {
    const fakeEvent = new Event("beforeinstallprompt");
    Object.assign(fakeEvent, {
      prompt: vi.fn().mockRejectedValue(new Error("Prompt exception")),
      userChoice: Promise.resolve({ outcome: "dismissed" as const }),
    });

    window.dispatchEvent(fakeEvent);

    const res = await pwaInstall.promptInstall();
    expect(res).toBe(false);
  });
});
