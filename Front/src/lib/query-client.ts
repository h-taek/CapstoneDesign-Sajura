// TanStack Query 클라이언트 — 04_fe.md §1.
import { MutationCache, QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  // 저장·업로드가 성공하면 모든 조회를 낡은 것으로 표시한다. 판매·재고·발주가 서로 엮여 있고
  // 홈은 다른 화면과 따로 키를 쓰므로, 화면마다 고칠 키를 고르면 빠뜨린 화면이 옛 값을 보인다.
  // 지금 화면에 있는 조회만 바로 다시 받고, 나머지는 그 화면을 열 때 받는다.
  mutationCache: new MutationCache({
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
