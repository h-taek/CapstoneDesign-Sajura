// 따라오는 옆 판(FollowPanel) — 웹(>= lg)은 sticky + 하단 도달 시 휠 드롭, 앱(< lg)은 전체 화면 덮기 (04_fe.md §4.0, mockup.js).
import { ChevronLeft, X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";

export interface FollowPanelDropInput {
  currentDrop: number;
  deltaY: number;
  atPageBottom: boolean;
  roomBelow: number;
}

export interface FollowPanelDropResult {
  nextDrop: number;
  consumed: boolean;
}

/**
 * 페이지 맨 아래에서 휠을 더 내릴 때 옆 판을 목록 끝까지 내리고, 다시 올릴 때 옆 판부터 끌어올리는 변위(px)를 계산한다.
 */
export function calcFollowPanelDrop({
  currentDrop,
  deltaY,
  atPageBottom,
  roomBelow,
}: FollowPanelDropInput): FollowPanelDropResult {
  if (deltaY < 0 && currentDrop > 0) {
    return {
      nextDrop: Math.max(0, currentDrop + deltaY),
      consumed: true,
    };
  }
  if (deltaY > 0 && atPageBottom && roomBelow > 0.5) {
    return {
      nextDrop: currentDrop + Math.min(deltaY, roomBelow),
      consumed: true,
    };
  }
  return {
    nextDrop: currentDrop,
    consumed: false,
  };
}

export interface FollowPanelProps {
  children: ReactNode;
  title?: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  backLabel?: string;
  className?: string;
  panelClassName?: string;
  "aria-label"?: string;
}

export function FollowPanel({
  children,
  title,
  onClose,
  closeLabel = "닫기",
  backLabel = "목록으로",
  className,
  panelClassName,
  "aria-label": ariaLabel,
}: FollowPanelProps) {
  const asideRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dropRef = useRef(0);
  const [drop, setDrop] = useState(0);

  useEffect(() => {
    const updateDrop = (next: number) => {
      dropRef.current = next;
      setDrop(next);
    };

    const onWheel = (e: WheelEvent) => {
      if (typeof window === "undefined" || window.innerWidth < 1024) return;
      const aside = asideRef.current;
      const panel = panelRef.current;
      if (!aside || !panel) return;

      const docEl = document.documentElement;
      if (docEl.scrollHeight - window.innerHeight < 1) return;

      const inPanel = panel.contains(e.target as Node | null);
      const canScrollPanel =
        e.deltaY > 0
          ? panel.scrollHeight - panel.clientHeight - panel.scrollTop > 0.5
          : panel.scrollTop > 0.5;
      if (inPanel && canScrollPanel) return;

      const atBottom = window.scrollY + window.innerHeight >= docEl.scrollHeight - 1;
      const room = aside.getBoundingClientRect().bottom - panel.getBoundingClientRect().bottom;
      const res = calcFollowPanelDrop({
        currentDrop: dropRef.current,
        deltaY: e.deltaY,
        atPageBottom: atBottom,
        roomBelow: room,
      });

      if (res.consumed) {
        e.preventDefault();
        updateDrop(res.nextDrop);
        return;
      }

      if (inPanel) {
        e.preventDefault();
        window.scrollBy(0, e.deltaY);
      }
    };

    const onScroll = () => {
      if (typeof window === "undefined") return;
      const docEl = document.documentElement;
      if (dropRef.current > 0 && window.scrollY + window.innerHeight < docEl.scrollHeight - 1) {
        updateDrop(0);
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <aside
      ref={asideRef}
      data-follow
      aria-label={ariaLabel ?? (typeof title === "string" ? title : undefined)}
      className={cn(
        "fixed inset-0 z-50 overflow-y-auto lg:relative lg:inset-auto lg:z-auto lg:col-span-2 lg:flex lg:h-0 lg:min-h-full lg:flex-col lg:overflow-visible",
        className,
      )}
    >
      <div
        ref={panelRef}
        style={drop > 0 ? { transform: `translateY(${drop}px)` } : undefined}
        className={cn(
          "glass-card min-h-full px-4 pt-[5.25rem] pb-28 lg:sticky lg:top-[5.25rem] lg:max-h-[calc(100vh-6.25rem)] lg:min-h-0 lg:overflow-y-auto lg:rounded-2xl lg:p-5",
          panelClassName,
        )}
      >
        {title !== undefined || onClose !== undefined ? (
          <div className="mb-4 flex items-center gap-2">
            {onClose ? (
              <button
                type="button"
                aria-label={backLabel}
                onClick={onClose}
                className="flex size-10 items-center justify-center rounded-full text-ink-2 hover:bg-white/60 lg:hidden"
              >
                <ChevronLeft className="size-6" />
              </button>
            ) : null}
            {title !== undefined ? (
              <h2 className="min-w-0 flex-1 truncate text-xl font-bold text-ink">{title}</h2>
            ) : (
              <span className="flex-1" />
            )}
            {onClose ? (
              <button
                type="button"
                aria-label={closeLabel}
                onClick={onClose}
                className="hidden size-10 items-center justify-center rounded-full text-ink-2 hover:bg-white/60 lg:flex"
              >
                <X className="size-5" />
              </button>
            ) : null}
          </div>
        ) : null}
        {children}
      </div>
    </aside>
  );
}
