// 조회 실패 칸 — 실패를 '데이터 없음'으로 보이지 않게 빈 상태 자리에 대신 띄운다.
import { cn } from "../../lib/utils";
import { Button } from "./button";

export function LoadError({ onRetry, className }: { onRetry: () => void; className?: string }) {
  return (
    <div role="alert" className={cn("rounded-2xl px-5 py-10 text-center glass-card", className)}>
      <p className="text-lg font-bold text-ink">불러오지 못했어요</p>
      <p className="mt-1 text-sm text-ink-2">연결을 확인하고 다시 시도해 주세요.</p>
      <Button variant="soft" size="sm" className="mt-4" onClick={onRetry}>
        다시 시도
      </Button>
    </div>
  );
}
