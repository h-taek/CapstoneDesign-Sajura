// 카드·섹션·KPI 프리미티브 — 디자인 토큰 v2.
// 웹: 흰 카드 + 얇은 테두리 + 큰 숫자. 앱: 같은 카드가 화면 폭을 꽉 채우고 글씨가 커진다.
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "../../lib/utils";

export function Card({
  className,
  children,
  as: Tag = "div",
}: {
  className?: string;
  children: ReactNode;
  as?: "div" | "section" | "article";
}) {
  return (
    <Tag className={cn("rounded-2xl border border-line bg-white shadow-card", className)}>
      {children}
    </Tag>
  );
}

/** 페이지 제목 줄. 앱에서는 상단바가 제목을 보여주므로 설명·버튼만 남긴다. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-1">
        <h1 className="hidden text-[1.75rem] font-bold tracking-tight text-ink lg:block">
          {title}
        </h1>
        {description ? <p className="text-[0.95rem] text-ink-3">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function SectionTitle({
  title,
  description,
  action,
  badge,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0 space-y-0.5">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink lg:text-xl">
          {title}
          {badge}
        </h2>
        {description ? <p className="text-sm text-ink-3">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function MoreLink({ to, children = "전체 보기" }: { to: string; children?: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex shrink-0 items-center gap-0.5 text-[0.95rem] font-semibold text-brand hover:text-brand-strong"
    >
      {children}
      <ChevronRight className="size-4" />
    </Link>
  );
}

/** 큰 숫자 KPI — 발주고·앳트래커처럼 숫자를 가장 크게. */
export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "brand" | "warn" | "danger";
}) {
  const toneClass = {
    default: "bg-subtle text-ink-2",
    brand: "bg-brand-soft text-brand",
    warn: "bg-warn-soft text-warn",
    danger: "bg-danger-soft text-danger",
  }[tone];
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.95rem] font-medium text-ink-3">{label}</p>
        {Icon ? (
          <span
            className={cn(
              "hidden size-9 items-center justify-center rounded-xl sm:flex",
              toneClass,
            )}
          >
            <Icon className="size-5" />
          </span>
        ) : null}
      </div>
      <p className="tabular text-[1.65rem] leading-none font-bold tracking-tight text-ink lg:text-[1.9rem]">
        {value}
      </p>
      {sub ? <p className="text-sm text-ink-3">{sub}</p> : null}
    </Card>
  );
}

export function EmptyState({
  children,
  className,
  action,
}: {
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[120px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line bg-white px-6 py-8 text-center text-[0.95rem] text-ink-3",
        className,
      )}
    >
      {children}
      {action}
    </div>
  );
}

/** 칩 탭 — 기간·필터 전환. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="inline-flex rounded-xl border border-line bg-white p-1 shadow-card"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors",
            o.value === value ? "bg-brand-soft text-brand" : "text-ink-3 hover:text-ink-2",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 표 공통 클래스 — 웹 전용 표(앱에서는 카드 목록으로 대체). */
export const tableClass = {
  wrap: "overflow-x-auto rounded-2xl border border-line bg-white shadow-card",
  table: "w-full min-w-[640px] text-left text-[0.95rem]",
  thead: "bg-subtle text-sm text-ink-3",
  th: "px-5 py-3 font-semibold",
  tr: "border-t border-line-soft",
  td: "px-5 py-3.5 text-ink-2",
};
