// 로그아웃 — 서버 refresh 쿠키까지 지운다(POST /api/auth/logout, 04_fe.md §2).
// 화면 상태만 비우면 HttpOnly refresh 쿠키가 남아 새로고침·앱 재실행 때 자동으로 다시 로그인된다.
import type { QueryClient } from "@tanstack/react-query";
import { logout, refreshAccessToken } from "../../api/endpoints/auth";
import { clearLocalSession } from "../../lib/local-session";
import { getStoredSubscriptionId, unsubscribePush } from "../../lib/push";
import { useAuthStore } from "../../stores/auth-store";

/**
 * 이 기기의 푸시 구독 해지 — 남겨 두면 같은 기기로 다른 계정이 들어와도 이전 계정 알림이 온다.
 * 서버 구독 삭제에 로그인 토큰이 필요해 로그인 정보를 비우기 전에 부른다. 실패해도 진행한다.
 */
export async function releaseDevicePush(): Promise<void> {
  // 이 기기에서 구독한 적이 없으면 건너뛴다 — 서비스 워커가 없으면 serviceWorker.ready가 끝나지 않는다.
  if (!getStoredSubscriptionId()) return;
  try {
    await unsubscribePush();
  } catch {
    // 서버 구독 삭제 실패 — 브라우저 구독은 이미 풀었다
  }
}

export async function signOut(queryClient: QueryClient): Promise<void> {
  await releaseDevicePush();
  try {
    await logout();
  } catch {
    // access token 만료(401) 등 — refresh로 새 토큰을 받아 한 번 더 시도한다.
    try {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        useAuthStore.getState().setAccessToken(refreshed.access_token);
        await logout();
      }
    } catch {
      // 서버 로그아웃이 끝내 실패해도 화면 상태는 아래에서 비운다.
    }
  }
  clearLocalSession(queryClient);
}
