import { ChevronDown } from "lucide-react";
// 알약 입력 + 라벨 + 에러 메시지 묶음 — RHF 친화 (04_fe.md §8, mockup v2).
import {
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  forwardRef,
} from "react";
import { cn } from "../../lib/utils";

export {
  DateField,
  type DateFieldProps,
  daysInMonth,
  formatDateDisplay,
  isDateOutOfRange,
  stepCalendarMonth,
} from "./date-field";

const baseField =
  "h-11 w-full rounded-full border border-white/80 bg-[rgb(46_32_120/0.065)] px-4 text-base text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand-soft disabled:cursor-not-allowed disabled:opacity-60 disabled:text-ink-3";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...rest }, ref) => (
    <input ref={ref} className={cn(baseField, className)} {...rest} />
  ),
);
Input.displayName = "Input";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...rest }, ref) => (
    <span className="relative block">
      <select ref={ref} className={cn(baseField, "appearance-none pr-10", className)} {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-ink-2" />
    </span>
  ),
);
Select.displayName = "Select";

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string | undefined;
  hint?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[0.95rem] font-semibold text-ink-2">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}
