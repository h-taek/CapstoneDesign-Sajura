// 입력 + 라벨 + 에러 메시지 묶음 — RHF 친화 (04_fe.md §8).
import {
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  forwardRef,
} from "react";
import { cn } from "../../lib/utils";

const baseField =
  "h-12 w-full rounded-xl border border-line bg-white px-4 text-base text-ink placeholder:text-ink-4 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand-soft disabled:bg-subtle disabled:text-ink-3";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...rest }, ref) => (
    <input ref={ref} className={cn(baseField, className)} {...rest} />
  ),
);
Input.displayName = "Input";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...rest }, ref) => (
    <select ref={ref} className={cn(baseField, "pr-8", className)} {...rest}>
      {children}
    </select>
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
