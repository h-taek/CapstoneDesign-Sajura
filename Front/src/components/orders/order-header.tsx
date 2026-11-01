// 추천 발주 상단 머리글 — 반영 기준과 추천 대상 기간. 04_fe.md §4.8.
interface OrderHeaderProps {
  periodText: string;
  isLowConfidence?: boolean | undefined;
  lowConfidenceReason?: string | null | undefined;
}

export function OrderHeader({
  periodText,
  isLowConfidence,
  lowConfidenceReason,
}: OrderHeaderProps) {
  return (
    <header className="mb-4 space-y-1">
      <h1 className="hidden text-[1.75rem] font-bold tracking-tight text-ink lg:block">
        추천 발주
      </h1>
      <p className="text-[0.95rem] text-ink-2">
        {periodText}
        {isLowConfidence ? (
          <>
            {" "}
            ·{" "}
            <span
              title={lowConfidenceReason ?? "최근 2주 판매가 평소와 많이 달라요"}
              className="font-semibold text-warn"
            >
              예측 신뢰도 낮음
            </span>
          </>
        ) : null}
      </p>
    </header>
  );
}
