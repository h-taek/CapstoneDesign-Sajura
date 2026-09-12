// 버튼 프리미티브 — shadcn/ui 스타일 (10_frontend_design.md §1).
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-400",
  secondary:
    "bg-white text-slate-900 border border-slate-300 hover:bg-slate-50 disabled:opacity-60",
  ghost:
    "bg-transparent text-slate-700 hover:bg-slate-100 disabled:opacity-50",
  destructive:
    "bg-red-600 text-white hover:bg-red-500 disabled:bg-red-300",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", type = "button", ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    />
  ),
);
Button.displayName = "Button";
