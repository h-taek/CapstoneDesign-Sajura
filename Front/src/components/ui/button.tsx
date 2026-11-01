// 알약 버튼 프리미티브 — 디자인 토큰 v2 (index.css @theme).
// 앱(모바일)에서는 html 글씨가 커지므로 같은 size도 손가락 기준(≥48px)으로 커진다.
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "destructive" | "soft";
type Size = "sm" | "md" | "lg" | "xl";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-strong disabled:bg-ink-4",
  soft: "bg-brand-soft text-brand-strong hover:bg-brand-tint disabled:opacity-60",
  secondary:
    "border border-white/80 bg-transparent text-ink-2 hover:bg-white/30 disabled:opacity-60",
  ghost: "bg-transparent text-ink-2 hover:bg-white/40 hover:text-ink disabled:opacity-50",
  destructive: "bg-danger text-white hover:opacity-90 disabled:bg-ink-4",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm rounded-full",
  md: "h-11 px-5 text-[0.95rem] rounded-full",
  lg: "h-12 px-6 text-base rounded-full",
  xl: "h-14 px-6 text-lg rounded-full",
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
        "inline-flex shrink-0 items-center justify-center gap-2 font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    />
  ),
);
Button.displayName = "Button";
