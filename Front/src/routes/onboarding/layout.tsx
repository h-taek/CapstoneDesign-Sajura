import { Outlet, useLocation, useNavigate } from "react-router";
import { ONBOARDING_SKY, ONBOARDING_SKY_STEPS, useSky } from "../../components/sky";
import { currentOnboardingStep } from "../guards";

export default function OnboardingLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const stepStr = pathname.split("/").pop() || "1";
  const currentStep = Number(stepStr) || 1;

  // 온보딩 스텝별 하늘 시각: store(22:40), pos(23:10), menus(23:40), confirm(00:10)
  useSky(ONBOARDING_SKY, ONBOARDING_SKY_STEPS, String(currentStep));

  // 사용자가 진행한 최대 단계 계산 (guards의 currentOnboardingStep)
  const allowedMaxStep = currentOnboardingStep();

  return (
    <>
      <p className="fixed top-6 left-6 z-10 text-[1.75rem] leading-none font-extrabold tracking-tight text-[#b3a4ff] sm:top-8 sm:left-10">
        Sajura
      </p>

      <main className="sky-titles min-h-dvh px-5 pt-[13vh] pb-10 text-center text-white">
        <section className="mx-auto w-full max-w-[440px]">
          {/* 진행 막대 4칸 */}
          <div className="-my-3 flex justify-center gap-2" aria-label={`${currentStep} / 4 단계`}>
            {[1, 2, 3, 4].map((s) => {
              const isPassed = s < currentStep;
              const isCurrent = s === currentStep;

              if (isCurrent) {
                return (
                  <span key={s} className="py-3" aria-current="step">
                    <span className="block h-1 w-9 rounded-full bg-[#b3a4ff]" />
                  </span>
                );
              }

              // 지나간 칸이거나 이미 허용된 이전 단계는 클릭 가능
              if (isPassed || s <= allowedMaxStep) {
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => navigate(`/onboarding/${s}`)}
                    aria-label={`${s}단계로 돌아가기`}
                    className="cursor-pointer py-3 hover:opacity-80"
                  >
                    <span className="block h-1 w-9 rounded-full bg-white/20" />
                  </button>
                );
              }

              return (
                <span key={s} className="py-3">
                  <span className="block h-1 w-9 rounded-full bg-white/20" />
                </span>
              );
            })}
          </div>

          <Outlet />
        </section>
      </main>
    </>
  );
}
