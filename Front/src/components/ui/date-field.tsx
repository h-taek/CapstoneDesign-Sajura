// 날짜 선택 필드 — 앱(< lg)은 네이티브 date 입력, 웹(>= lg)은 유리 달력 팝오버 (04_fe.md §4.0, mockup.js).
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { type FocusEvent, forwardRef, useEffect, useId, useMemo, useRef, useState } from "react";
import { WEEKDAYS } from "../../lib/format";
import { cn } from "../../lib/utils";

const baseDateFieldClass =
  "h-11 w-full rounded-full border border-white/80 bg-[rgb(46_32_120/0.065)] px-4 text-base text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand-soft disabled:cursor-not-allowed disabled:opacity-60 disabled:text-ink-3";

/** YYYY-MM-DD 문자열을 "YYYY. MM. DD." 형식으로 바꾼다. */
export function formatDateDisplay(value?: string): string {
  if (!value) return "";
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  const [y, m, d] = parts;
  return `${y}. ${m}. ${d}.`;
}

/** 해당 연·월(1~12)의 총 일수를 계산한다. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** 달력 월 이동 — 1월에서 이전 달이면 전년 12월, 12월에서 다음 달이면 익년 1월로 넘긴다. */
export function stepCalendarMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/** YYYY-MM-DD 문자열이 min/max 범위를 벗어나는지 판별한다. */
export function isDateOutOfRange(iso: string, min?: string, max?: string): boolean {
  if (min && iso < min) return true;
  if (max && iso > max) return true;
  return false;
}

function getTodayIso(): string {
  return new Date().toLocaleDateString("sv-SE");
}

function parseYearMonth(iso?: string, fallbackIso?: string): { year: number; month: number } {
  const source = iso || fallbackIso || getTodayIso();
  const [y, m] = source.split("-").map(Number);
  if (y && m && m >= 1 && m <= 12) {
    return { year: y, month: m };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export interface DateFieldProps {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onValueChange?: (value: string) => void;
  onBlur?: (e: FocusEvent<HTMLInputElement | HTMLButtonElement>) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  optional?: boolean;
  allowClear?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

export const DateField = forwardRef<HTMLInputElement, DateFieldProps>(
  (
    {
      id,
      name,
      value,
      defaultValue = "",
      onChange,
      onValueChange,
      onBlur,
      min,
      max,
      placeholder = "날짜 선택",
      disabled = false,
      required = false,
      optional = false,
      allowClear = false,
      className,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledBy,
    },
    ref,
  ) => {
    const fallbackId = useId();
    const fieldId = id ?? fallbackId;
    const isControlled = value !== undefined;
    const [innerValue, setInnerValue] = useState(defaultValue);
    const currentValue = isControlled ? value : innerValue;

    const [open, setOpen] = useState(false);
    const initialYM = useMemo(() => parseYearMonth(currentValue, min), [currentValue, min]);
    const [viewYear, setViewYear] = useState(initialYM.year);
    const [viewMonth, setViewMonth] = useState(initialYM.month);
    const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const popoverRef = useRef<HTMLDialogElement | null>(null);

    const emitChange = (next: string) => {
      if (!isControlled) {
        setInnerValue(next);
      }
      onChange?.(next);
      onValueChange?.(next);
    };

    const openPopover = () => {
      if (disabled) return;
      const ym = parseYearMonth(currentValue, min);
      setViewYear(ym.year);
      setViewMonth(ym.month);
      if (triggerRef.current && typeof window !== "undefined") {
        const r = triggerRef.current.getBoundingClientRect();
        const w = 288;
        const left = Math.max(12, Math.min(r.left, (window.innerWidth || 1024) - w - 12));
        setPos({ top: r.bottom + 8, left });
      }
      setOpen(true);
    };

    useEffect(() => {
      if (!open) return;

      const onDocClick = (e: MouseEvent) => {
        const target = e.target as Node | null;
        if (!target) return;
        if (popoverRef.current?.contains(target)) return;
        if (triggerRef.current?.contains(target)) return;
        setOpen(false);
      };

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setOpen(false);
        }
      };

      const onViewportChange = () => {
        setOpen(false);
      };

      document.addEventListener("mousedown", onDocClick);
      document.addEventListener("keydown", onKeyDown);
      window.addEventListener("scroll", onViewportChange, true);
      window.addEventListener("resize", onViewportChange);

      return () => {
        document.removeEventListener("mousedown", onDocClick);
        document.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("scroll", onViewportChange, true);
        window.removeEventListener("resize", onViewportChange);
      };
    }, [open]);

    const firstWeekday = new Date(viewYear, viewMonth - 1, 1).getDay();
    const totalDays = daysInMonth(viewYear, viewMonth);
    const todayIso = getTodayIso();
    const canClear = optional || allowClear;

    const handleStepMonth = (delta: number) => {
      const next = stepCalendarMonth(viewYear, viewMonth, delta);
      setViewYear(next.year);
      setViewMonth(next.month);
    };

    const handleSelectDay = (iso: string) => {
      if (isDateOutOfRange(iso, min, max)) return;
      emitChange(iso);
      setOpen(false);
    };

    return (
      <div className="relative w-full">
        {/* 앱(< lg) 네이티브 날짜 입력 */}
        <input
          ref={ref}
          id={fieldId}
          name={name}
          type="date"
          value={currentValue}
          min={min}
          max={max}
          disabled={disabled}
          required={required}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          onBlur={onBlur}
          onChange={(e) => emitChange(e.target.value)}
          className={cn(baseDateFieldClass, "lg:hidden", className)}
        />

        {/* 웹(>= lg) 유리 달력 트리거 버튼 */}
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          onBlur={onBlur}
          onClick={() => (open ? setOpen(false) : openPopover())}
          className={cn(
            baseDateFieldClass,
            "hidden items-center justify-between gap-2 text-left lg:flex",
            className,
          )}
        >
          <span className={cn("tabular", !currentValue && "text-ink-3")}>
            {currentValue ? formatDateDisplay(currentValue) : placeholder}
          </span>
          <CalendarDays className="size-4 shrink-0 text-ink-3" />
        </button>

        {/* 웹 달력 팝오버 */}
        {open ? (
          <dialog
            open
            ref={popoverRef}
            aria-label="날짜 고르기"
            style={{ top: `${pos.top}px`, left: `${pos.left}px` }}
            className="glass-card fixed z-[60] m-0 w-72 rounded-2xl p-3 text-ink"
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <button
                type="button"
                aria-label="이전 달"
                onClick={() => handleStepMonth(-1)}
                className="flex size-8 items-center justify-center rounded-full text-ink-2 hover:bg-white/50 hover:text-ink"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="tabular text-sm font-bold text-ink">
                {viewYear}년 {viewMonth}월
              </span>
              <button
                type="button"
                aria-label="다음 달"
                onClick={() => handleStepMonth(1)}
                className="flex size-8 items-center justify-center rounded-full text-ink-2 hover:bg-white/50 hover:text-ink"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 text-center text-xs font-semibold text-ink-3">
              {WEEKDAYS.map((w) => (
                <span key={w} className="py-1">
                  {w}
                </span>
              ))}
            </div>

            <div className="mt-0.5 grid grid-cols-7 gap-0.5 text-center text-sm">
              {Array.from({ length: firstWeekday }).map((_, idx) => (
                <span key={`empty-${String(idx)}`} />
              ))}
              {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
                const iso = `${viewYear}-${String(viewMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const isSelected = iso === currentValue;
                const isToday = iso === todayIso;
                const isDisabled = isDateOutOfRange(iso, min, max);
                return (
                  <button
                    key={iso}
                    type="button"
                    data-day={iso}
                    disabled={isDisabled}
                    aria-pressed={isSelected}
                    onClick={() => handleSelectDay(iso)}
                    className={cn(
                      "tabular h-9 rounded-full transition-colors",
                      isDisabled
                        ? "cursor-not-allowed text-ink-4 opacity-40"
                        : isSelected
                          ? "bg-brand font-bold text-white"
                          : isToday
                            ? "font-bold text-brand ring-1 ring-brand ring-inset hover:bg-white/50"
                            : "text-ink hover:bg-white/50",
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {canClear ? (
              <div className="mt-2 flex justify-end border-t border-white/60 pt-2">
                <button
                  type="button"
                  data-clear
                  onClick={() => {
                    emitChange("");
                    setOpen(false);
                  }}
                  className="rounded-full px-3 py-1 text-xs font-semibold text-ink-3 hover:bg-white/50 hover:text-ink"
                >
                  지우기
                </button>
              </div>
            ) : null}
          </dialog>
        ) : null}
      </div>
    );
  },
);
DateField.displayName = "DateField";
