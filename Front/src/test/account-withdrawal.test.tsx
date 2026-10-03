// 회원 탈퇴(30일 유예) — 07_api_spec.md DELETE /api/auth/me, 12_security.md §3.1.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as authApi from "../api/endpoints/auth";
import * as storeApi from "../api/endpoints/store";
import LoginPage from "../routes/login";
import AccountSettingsPage from "../routes/settings/account";
import { type AuthUser, useAuthStore } from "../stores/auth-store";

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
};

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/settings/account" element={<AccountSettingsPage />} />
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
  });

  it("확인 체크 전에는 버튼이 비활성이고, 탈퇴 후 로그인 화면에서 접수 안내를 보여준다", async () => {
    useAuthStore.setState({ accessToken: "tok", user });
    const del = vi.spyOn(authApi, "deleteAccount").mockResolvedValue();
    renderAt("/settings/account");

    const button = screen.getByRole("button", { name: "회원 탈퇴" });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText("비밀번호 확인"), { target: { value: "Passw0rd!" } });
    fireEvent.click(screen.getByLabelText(/영구 삭제/));
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
    fireEvent.click(screen.getByLabelText(/영구 삭제/));
    fireEvent.click(screen.getByRole("button", { name: "회원 탈퇴" }));
    await waitFor(() => expect(del).toHaveBeenCalledWith(""));
  });

  it("OAuth 콜백이 탈퇴 계정으로 돌려보내면 로그인 화면에 사유를 보여준다", () => {
    renderAt("/login?error=withdrawn");
    expect(screen.getByText(/탈퇴 처리된 계정입니다/)).toBeInTheDocument();
  });
});
