// HTTP 클라이언트 — 10_frontend_design.md §1 (ky 1.x) + §2 (401 단일 refresh 인터셉터).
import ky from "ky";
import { useAuthStore } from "../stores/auth-store";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

// 동시 401 → 단일 refresh로 합치기 위한 in-flight 프라미스.
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { access_token: string };
      useAuthStore.getState().setAccessToken(body.access_token);
      return body.access_token;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export const api = ky.create({
  prefixUrl: BASE_URL,
  credentials: "include",
  retry: { limit: 0 },
  hooks: {
    beforeRequest: [
      (request) => {
        const token = useAuthStore.getState().accessToken;
        if (token) request.headers.set("Authorization", `Bearer ${token}`);
      },
    ],
    afterResponse: [
      async (request, _options, response) => {
        if (response.status !== 401) return response;
        // 인증 엔드포인트 자체는 refresh 재시도 안 함 (무한 루프 방지).
        if (request.url.includes("/auth/")) return response;

        const newToken = await refreshAccessToken();
        if (!newToken) {
          useAuthStore.getState().clear();
          return response;
        }
        request.headers.set("Authorization", `Bearer ${newToken}`);
        return ky(request);
      },
    ],
  },
});
