// 이 기기의 로그인 화면 상태를 비운다 — 로그인 정보·온보딩 입력·조회 캐시. 서버는 부르지 않는다.
// 직접 로그아웃(signOut)·회원 탈퇴·세션 만료(api.ts refresh 실패)가 함께 쓴다.
import type { QueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../stores/auth-store";
import { useOnboardingStore } from "../stores/onboarding-store";

export function clearLocalSession(queryClient: QueryClient): void {
  useAuthStore.getState().clear();
  useOnboardingStore.getState().reset();
  queryClient.clear();
}
