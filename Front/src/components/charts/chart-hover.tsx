// 차트 공용 호버/터치 툴팁 — 마우스를 올리거나 터치한 지점에서 가장 가까운 점의 금액을 보여준다.
// 마우스는 벗어나면 닫히고, 터치는 차트 밖을 다시 누를 때까지 유지된다.
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { useEffect, useState } from "react";

export function useChartHover(containerRef: RefObject<HTMLElement | null>) {
  const [index, setIndex] = useState<number | null>(null);

  // 터치로 연 툴팁은 차트 바깥을 누르면 닫는다
  useEffect(() => {
    if (index == null) return;
    const onDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setIndex(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [index, containerRef]);

  /** count개 점의 x좌표(xAt)를 받아 SVG에 붙일 포인터 핸들러를 만든다. viewBox는 실제 픽셀 크기와 같아야 한다. */
  const bind = (count: number, xAt: (i: number) => number) => {
    const pick = (e: ReactPointerEvent<SVGSVGElement>) => {
      if (count === 0) return;
      const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
      let best = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      for (let i = 0; i < count; i++) {
        const d = Math.abs(xAt(i) - px);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      setIndex(best);
    };
    return {
      onPointerMove: pick,
      onPointerDown: pick,
      onPointerLeave: (e: ReactPointerEvent<SVGSVGElement>) => {
        if (e.pointerType === "mouse") setIndex(null);
      },
      style: { touchAction: "pan-y" as const, cursor: "crosshair" },
    };
  };

  return { index, bind };
}

export interface ChartTooltipRow {
  label: string;
  value: string;
  tone?: "brand" | "muted";
}

/** 점(x, y) 위에 뜨는 툴팁 — 위 공간이 모자라면 점 아래로 내린다. 좌표는 컨테이너 기준 px. */
export function ChartTooltip({
  x,
  y,
  containerWidth,
  title,
  rows,
}: {
  x: number;
  y: number;
  containerWidth: number;
  title: string;
  rows: ChartTooltipRow[];
}) {
  const half = 64;
  const left = Math.min(Math.max(x, half), Math.max(half, containerWidth - half));
  const approxHeight = 22 + rows.length * 18;
  const above = y - approxHeight - 12 >= 0;
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 rounded-lg bg-ink/90 px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg"
      style={{
        left,
        top: above ? y - 12 : y + 12,
        transform: above ? "translate(-50%, -100%)" : "translate(-50%, 0)",
      }}
    >
      <p className="font-semibold">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="tabular mt-0.5 flex justify-between gap-3">
          <span className={r.tone === "muted" ? "text-white/60" : "text-white/80"}>{r.label}</span>
          <span className="font-semibold">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

/** 툴팁용 정확한 금액 — 1,234,000원 */
export function formatWonFull(v: number): string {
  return `${Math.round(v).toLocaleString("ko-KR")}원`;
}
