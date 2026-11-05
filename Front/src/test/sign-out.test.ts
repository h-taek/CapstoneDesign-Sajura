// 로그아웃 — 서버 refresh 쿠키까지 지워야 새로고침 때 자동 재로그인되지 않는다.
import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as authApi from "../api/endpoints/auth";
import { signOut } from "../features/auth/sign-out";
import * as pushLib from "../lib/push";
import { useAuthStore } from "../stores/auth-store";
import { useOnboardingStore } from "../stores/onboarding-store";

function seed() {
  useAuthStore.setState({
    accessToken: "old",
    user: { user_id: "u1" } as ReturnType<typeof useAuthStore.getState>["user"],
  });
  useOnboardingStore.setState({ pos: { pos_type: "CSV_ONLY" } as never });
  const client = new QueryClient();
  client.setQueryData(["store"], { store_name: "칠야" });
  return client;
}

describe("signOut", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().clear();
    useOnboardingStore.getState().reset();
    pushLib.setStoredSubscriptionId(null);
  });

  it("서버 로그아웃을 호출하고 인증·온보딩·조회 캐시를 비운다", async () => {
    const client = seed();
    const logoutSpy = vi.spyOn(authApi, "logout").mockResolvedValue();

    await signOut(client);

    expect(logoutSpy).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useOnboardingStore.getState().pos).toBeNull();
    expect(client.getQueryData(["store"])).toBeUndefined();
  });

  it("access token이 만료돼 실패하면 refresh 후 한 번 더 로그아웃한다", async () => {
    const client = seed();
    const logoutSpy = vi
      .spyOn(authApi, "logout")
      .mockRejectedValueOnce(new Error("401"))
      .mockResolvedValueOnce();
    vi.spyOn(authApi, "refreshAccessToken").mockResolvedValue({
      access_token: "new",
    } as Awaited<ReturnType<typeof authApi.refreshAccessToken>>);

    await signOut(client);

    expect(logoutSpy).toHaveBeenCalledTimes(2);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it("서버 로그아웃이 끝내 실패해도 화면 상태는 비운다", async () => {
    const client = seed();
    vi.spyOn(authApi, "logout").mockRejectedValue(new Error("network"));
    vi.spyOn(authApi, "refreshAccessToken").mockResolvedValue(null);

    await signOut(client);

    expect(useAuthStore.getState().user).toBeNull();
  });

  it("이 기기에서 푸시를 구독했으면 서버 로그아웃보다 먼저 해지한다", async () => {
    const client = seed();
    pushLib.setStoredSubscriptionId("sub-1");
    const unsubscribe = vi.spyOn(pushLib, "unsubscribePush").mockResolvedValue(true);
    const logoutSpy = vi.spyOn(authApi, "logout").mockResolvedValue();

    await signOut(client);

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(unsubscribe.mock.invocationCallOrder[0]).toBeLessThan(
      logoutSpy.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("구독한 적이 없으면 푸시 해지를 부르지 않는다", async () => {
    const client = seed();
    const unsubscribe = vi.spyOn(pushLib, "unsubscribePush").mockResolvedValue(true);
    vi.spyOn(authApi, "logout").mockResolvedValue();

    await signOut(client);

    expect(unsubscribe).not.toHaveBeenCalled();
  });

  it("푸시 해지가 실패해도 로그아웃은 끝까지 한다", async () => {
    const client = seed();
    pushLib.setStoredSubscriptionId("sub-1");
    vi.spyOn(pushLib, "unsubscribePush").mockRejectedValue(new Error("404"));
    const logoutSpy = vi.spyOn(authApi, "logout").mockResolvedValue();

    await signOut(client);

    expect(logoutSpy).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().user).toBeNull();
  });
});
