// 회원 탈퇴(30일 유예) — 02_implementation_design.md §3 DELETE /api/auth/me, 01_basic_design.md §5.2.1.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as authApi from "../api/endpoints/auth";
import * as storeApi from "../api/endpoints/store";
import * as pushLib from "../lib/push";
import LoginPage from "../routes/login";
import SettingsHubPage from "../routes/settings/index";
import { type AuthUser, useAuthStore } from "../stores/auth-store";
import { useOnboardingStore } from "../stores/onboarding-store";

const user: AuthUser = {
  user_id: "u1",
  email: "owner@example.com",
  name: "점주",
  auth_provider: "LOCAL",
  role: "OWNER",
  store_name: "매장",
  business_no: "123",
  business_status: "VERIFIED",
  onboarding_completed: true,
  created_at: "2026-01-01T00:00:00",
};

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/settings/*" element={<SettingsHubPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("회원 탈퇴", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(storeApi, "getStore").mockResolvedValue(
      {} as Awaited<ReturnType<typeof storeApi.getStore>>,
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().clear();
    useOnboardingStore.getState().reset();
    pushLib.setStoredSubscriptionId(null);
  });

  it("탈퇴하면 이 기기의 푸시 구독을 지우고 온보딩 입력까지 비운다", async () => {
    useAuthStore.setState({ accessToken: "tok", user });
    useOnboardingStore.setState({ pos: { pos_type: "CSV_ONLY" } as never });
    pushLib.setStoredSubscriptionId("sub-1");
    vi.spyOn(authApi, "deleteAccount").mockResolvedValue();
    const unsubscribe = vi.spyOn(pushLib, "unsubscribePush").mockResolvedValue(true);
    renderAt("/settings/account");

    fireEvent.change(screen.getByLabelText("비밀번호 확인"), { target: { value: "Passw0rd!" } });
    fireEvent.click(screen.getByLabelText(/모든 데이터가 지워지는 것을 확인/));
    fireEvent.click(screen.getByRole("button", { name: "회원 탈퇴" }));

    expect(await screen.findByText(/탈퇴가 접수되었습니다/)).toBeInTheDocument();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(useOnboardingStore.getState().pos).toBeNull();
  });

  it("확인 체크 전에는 버튼이 비활성이고, 탈퇴 후 로그인 화면에서 접수 안내를 보여준다", async () => {
    useAuthStore.setState({ accessToken: "tok", user });
    const del = vi.spyOn(authApi, "deleteAccount").mockResolvedValue();
    renderAt("/settings/account");

    const button = screen.getByRole("button", { name: "회원 탈퇴" });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText("비밀번호 확인"), { target: { value: "Passw0rd!" } });
    fireEvent.click(screen.getByLabelText(/모든 데이터가 지워지는 것을 확인/));
    fireEvent.click(button);

    await waitFor(() => expect(del).toHaveBeenCalledWith("Passw0rd!"));
    expect(await screen.findByText(/탈퇴가 접수되었습니다/)).toBeInTheDocument();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it("소셜 계정은 비밀번호 없이 탈퇴한다", async () => {
    useAuthStore.setState({ accessToken: "tok", user: { ...user, auth_provider: "KAKAO" } });
    const del = vi.spyOn(authApi, "deleteAccount").mockResolvedValue();
    renderAt("/settings/account");

    expect(screen.queryByLabelText("비밀번호 확인")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/모든 데이터가 지워지는 것을 확인/));
    fireEvent.click(screen.getByRole("button", { name: "회원 탈퇴" }));
    await waitFor(() => expect(del).toHaveBeenCalledWith(""));
  });

  it("OAuth 콜백이 탈퇴 계정으로 돌려보내면 로그인 화면에 사유를 보여준다", () => {
    renderAt("/login?error=withdrawn");
    expect(screen.getByText(/탈퇴 처리된 계정입니다/)).toBeInTheDocument();
  });
});
