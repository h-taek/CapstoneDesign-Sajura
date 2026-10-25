// 온보딩 레이아웃 — 스텝 진행 표시 + Outlet (04_fe.md §3).
// 앱에서도 한눈에 보이도록 번호 동그라미 + 진행 막대로 표시한다.
import { Check } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router";
import { cn } from "../../lib/utils";

const STEPS = [
  { id: 1, label: "매장 정보" },
  { id: 2, label: "POS 연동" },
  { id: 3, label: "메뉴 등록" },
  { id: 4, label: "확인" },
] as const;

export default function OnboardingLayout() {
  const { pathname } = useLocation();
  const current = Number(pathname.split("/").pop()) || 1;

  return (
    <main className="min-h-dvh bg-canvas px-4 py-6 sm:p-6">
      <div className="mx-auto w-full max-w-2xl space-y-6 lg:py-6">
        <header className="space-y-1">
          <p className="text-sm font-semibold text-brand">
            {current} / {STEPS.length} 단계
          </p>
          <h1 className="text-[1.75rem] font-bold tracking-tight text-ink">매장 온보딩</h1>
          <p className="text-base text-ink-3">
            기본 정보를 4단계로 입력하면 메인 화면으로 이동합니다.
          </p>
        </header>
        <ol className="grid grid-cols-4 gap-2" aria-label="온보딩 단계">
          {STEPS.map((step) => {
            const done = step.id < current;
            const active = step.id === current;
            return (
              <li
                key={step.id}
                aria-current={active ? "step" : undefined}
                className="flex flex-col items-center gap-2 text-center"
              >
                <span
                  className={cn(
                    "h-1.5 w-full rounded-full",
                    done || active ? "bg-brand" : "bg-line",
                  )}
                />
                <span className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      active
                        ? "bg-brand text-white"
                        : done
                          ? "bg-brand-soft text-brand"
                          : "bg-line-soft text-ink-4",
                    )}
                  >
                    {done ? <Check className="size-3.5" strokeWidth={3} /> : step.id}
                  </span>
                  <NavLink
                    to={`/onboarding/${step.id}`}
                    className={cn(
                      "text-sm font-semibold whitespace-nowrap",
                      active ? "text-ink" : done ? "text-ink-2" : "text-ink-4",
                      !active && "hidden sm:inline",
                    )}
                    // 미완료 단계로 임의 점프 방지: done 단계만 클릭 가능.
                    onClick={(e) => {
                      if (!done && !active) e.preventDefault();
                    }}
                  >
                    {step.label}
                  </NavLink>
                </span>
              </li>
            );
          })}
        </ol>
        <section className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-8">
          <Outlet />
        </section>
      </div>
    </main>
  );
}
