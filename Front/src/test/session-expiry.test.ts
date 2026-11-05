// 세션 만료 — refresh까지 실패하면 로그인 정보뿐 아니라 조회 캐시·온보딩 입력도 비운다 (lib/api.ts).
// jsdom에선 상대 주소 요청을 만들 수 없어 API 주소를 절대 주소로 바꾸고 모듈을 새로 불러온다.
import { afterEach, describe, expect, it, vi } from "vitest";

describe("세션 만료", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("refresh까지 401이면 로그인 정보·온보딩 입력·조회 캐시를 모두 비운다", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://localhost/api");
    vi.resetModules();
    const fetchMock = vi.fn(async () => new Response("{}", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    const { api } = await import("../lib/api");
    const { queryClient } = await import("../lib/query-client");
    const { useAuthStore } = await import("../stores/auth-store");
    const { useOnboardingStore } = await import("../stores/onboarding-store");
    useAuthStore.setState({
      accessToken: "old",
      user: { user_id: "u1" } as ReturnType<typeof useAuthStore.getState>["user"],
    });
    useOnboardingStore.setState({ pos: { pos_type: "CSV_ONLY" } as never });
    queryClient.setQueryData(["store"], { store_name: "칠야" });

    await expect(api.get("store").json()).rejects.toThrow();

    expect(fetchMock).toHaveBeenCalledTimes(2); // 원 요청 + refresh
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useOnboardingStore.getState().pos).toBeNull();
    expect(queryClient.getQueryData(["store"])).toBeUndefined();
  });
});
