// 마운트 1회 refresh 동기 — 10_frontend_design.md §2 (메모리 Access Token 부재 감지).
import { useEffect } from "react";
import { fetchMe, refreshAccessToken } from "../../api/endpoints/auth";
import { useAuthStore } from "../../stores/auth-store";

export function useAuthBootstrap() {
  const bootstrapped = useAuthStore((s) => s.bootstrapped);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setUser = useAuthStore((s) => s.setUser);
  const markBootstrapped = useAuthStore((s) => s.markBootstrapped);

  useEffect(() => {
    if (bootstrapped) return;
    let cancelled = false;
    (async () => {
      const refreshed = await refreshAccessToken();
      if (cancelled) return;
      if (refreshed) {
        setAccessToken(refreshed.access_token);
        try {
          const me = await fetchMe();
          if (!cancelled) setUser(me);
        } catch {
          // me 실패 시 토큰 유지하되 사용자 정보는 비움 — 후속 API가 401이면 인터셉터가 처리.
        }
      }
      if (!cancelled) markBootstrapped();
    })();
    return () => {
      cancelled = true;
    };
  }, [bootstrapped, setAccessToken, setUser, markBootstrapped]);

  return bootstrapped;
}
