// 입력 + 라벨 + 에러 메시지 묶음 — RHF 친화 (10_frontend_design.md §7).
import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { cn } from "../../lib/utils";

const baseField =
  "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100";

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
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}
