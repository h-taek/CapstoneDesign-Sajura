// 온보딩 레이아웃 — 스텝 진행 표시 + Outlet (10_frontend_design.md §3).
import { NavLink, Outlet, useLocation } from "react-router";

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
    <main className="min-h-dvh bg-[#f3f4f6] p-6">
      <div className="mx-auto w-full max-w-2xl space-y-6 py-6">
        <header className="space-y-1">
          <h1 className="text-3xl font-semibold text-[#101828]">매장 온보딩</h1>
          <p className="text-base text-[#364153]">
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
                className={`flex flex-col items-start rounded-xl border px-3 py-2 ${
                  active
                    ? "border-[#7a5eff] bg-white"
                    : done
                      ? "border-[#d1d5dc] bg-white"
                      : "border-dashed border-[#d1d5dc] bg-white text-[#99a1af]"
                }`}
              >
                <span className={`text-xs ${active ? "text-[#7a5eff]" : ""}`}>Step {step.id}</span>
                <NavLink
                  to={`/onboarding/${step.id}`}
                  className={`text-sm font-medium ${active ? "text-[#101828]" : done ? "text-[#364153]" : ""}`}
                  // 미완료 단계로 임의 점프 방지: done 단계만 클릭 가능.
                  onClick={(e) => {
                    if (!done && !active) e.preventDefault();
                  }}
                >
                  {step.label}
                </NavLink>
              </li>
            );
          })}
        </ol>
        <section className="rounded-2xl bg-white p-8 shadow-sm">
          <Outlet />
        </section>
      </div>
    </main>
  );
}
