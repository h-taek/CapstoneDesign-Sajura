// BE 사업자 검증 게이트(403 BUSINESS_NOT_VERIFIED) 수신 시 사용자 상태 재동기화 — 12_security.md §5.1.
// 상태가 바뀌면 RequireStage가 /verify-business로 보낸다.
import { afterEach, describe, expect, it, vi } from "vitest";
import { api as baseApi } from "../lib/api";
import { type AuthUser, useAuthStore } from "../stores/auth-store";

// 테스트 런타임의 Request는 상대 URL을 해석하지 못한다. extend는 훅을 그대로 이어받는다.
const api = baseApi.extend({ prefixUrl: "http://localhost/api" });

const user: AuthUser = {
  user_id: "u1",
  email: "a@example.com",
  name: "점주",
  auth_provider: "LOCAL",
  role: "OWNER",
  store_name: "매장",
  business_no: "123",
  business_status: "VERIFIED",
  onboarding_completed: true,
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("403 BUSINESS_NOT_VERIFIED", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    useAuthStore.getState().clear();
  });

  it("me를 다시 불러 business_status를 갱신한다", async () => {
    useAuthStore.setState({ accessToken: "tok", user });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json(403, { error: "BUSINESS_NOT_VERIFIED", message: "사업자 검증이 필요합니다." }),
      ),
    );
    const meSpy = vi.spyOn(baseApi, "get").mockImplementation(
      () =>
        ({
          json: async () => ({ ...user, business_status: "REJECTED" }),
        }) as unknown as ReturnType<typeof baseApi.get>,
    );

    await expect(api.get("menus").json()).rejects.toThrow();
    expect(meSpy).toHaveBeenCalledWith("auth/me");
    expect(useAuthStore.getState().user?.business_status).toBe("REJECTED");
  });

  it("다른 403은 사용자 상태를 건드리지 않는다", async () => {
    useAuthStore.setState({ accessToken: "tok", user });
    const fetchMock = vi.fn(async () => json(403, { error: "FORBIDDEN", message: "권한 없음" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.get("admin/verifications").json()).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().user?.business_status).toBe("VERIFIED");
  });
});
