import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Navigate, useNavigate } from "react-router";
import { type PosStepValues, posStepSchema } from "../../schemas/onboarding";
import { useAuthStore } from "../../stores/auth-store";
import { useOnboardingStore } from "../../stores/onboarding-store";

export default function PosStep() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.user?.name);
  const store = useOnboardingStore((s) => s.store);
  const draft = useOnboardingStore((s) => s.pos);
  const setPos = useOnboardingStore((s) => s.setPos);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PosStepValues>({
    resolver: zodResolver(posStepSchema),
    defaultValues: draft ?? { pos_type: "CSV_ONLY", api_key: "", store_code: "" },
    mode: "onBlur",
  });

  if (!store) return <Navigate to="/onboarding/1" replace />;

  const posType = watch("pos_type");
  const isCsvOnly = posType === "CSV_ONLY";
  const isToss = posType === "TOSSPLACE";

  const onSubmit = (values: PosStepValues) => {
    setPos(values);
    navigate("/onboarding/3");
  };

  return (
    <div>
      <h1 className="mt-9 text-[1.75rem] font-extrabold tracking-tight">POS를 연결해 주세요</h1>
      <p className="mt-2 text-base text-white/75">
        {userName ? `${userName}님, ` : ""}환영해요. 매출을 가져올 방법을 골라 주세요
      </p>
      <form className="mt-8 space-y-3 text-left" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="POS 종류">
          <label
            className={`flex cursor-pointer items-center gap-2.5 rounded-xl border border-white/15 px-4 py-3.5 text-[0.95rem] font-semibold backdrop-blur-md transition-colors ${
              posType === "TOSSPLACE"
                ? "border-[#b3a4ff] bg-[#b3a4ff]/20 text-white"
                : "bg-[#0d0a26]/45 text-white/90 hover:bg-white/10"
            }`}
          >
            <input
              type="radio"
              value="TOSSPLACE"
              className="size-4 accent-[#b3a4ff]"
              {...register("pos_type")}
            />
            토스플레이스
          </label>
          <label
            className={`flex cursor-pointer items-center gap-2.5 rounded-xl border border-white/15 px-4 py-3.5 text-[0.95rem] font-semibold backdrop-blur-md transition-colors ${
              posType === "KIWOOM"
                ? "border-[#b3a4ff] bg-[#b3a4ff]/20 text-white"
                : "bg-[#0d0a26]/45 text-white/90 hover:bg-white/10"
            }`}
          >
            <input
              type="radio"
              value="KIWOOM"
              className="size-4 accent-[#b3a4ff]"
              {...register("pos_type")}
            />
            키움페이
          </label>
          <label
            className={`flex cursor-pointer items-center gap-2.5 rounded-xl border border-white/15 px-4 py-3.5 text-[0.95rem] font-semibold backdrop-blur-md transition-colors ${
              posType === "OKPOS"
                ? "border-[#b3a4ff] bg-[#b3a4ff]/20 text-white"
                : "bg-[#0d0a26]/45 text-white/90 hover:bg-white/10"
            }`}
          >
            <input
              type="radio"
              value="OKPOS"
              className="size-4 accent-[#b3a4ff]"
              {...register("pos_type")}
            />
            OKPOS
          </label>
          <label
            className={`flex cursor-pointer items-center gap-2.5 rounded-xl border border-white/15 px-4 py-3.5 text-[0.95rem] font-semibold backdrop-blur-md transition-colors ${
              posType === "CSV_ONLY"
                ? "border-[#b3a4ff] bg-[#b3a4ff]/20 text-white"
                : "bg-[#0d0a26]/45 text-white/90 hover:bg-white/10"
            }`}
          >
            <input
              type="radio"
              value="CSV_ONLY"
              className="size-4 accent-[#b3a4ff]"
              {...register("pos_type")}
            />
            CSV 업로드만 사용
          </label>
        </div>

        {isCsvOnly ? (
          <p className="px-1 text-sm text-white/85">
            CSV 업로드는 API 키 없이 진행해요. 매출 파일은 나중에 올리면 돼요.
          </p>
        ) : (
          <div className="space-y-3">
            {isToss ? null : (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="api_key" className="text-sm font-semibold text-white/90">
                  POS API 키
                </label>
                <input
                  id="api_key"
                  type="text"
                  autoComplete="off"
                  className="h-12 w-full rounded-xl border border-white/15 bg-[#0d0a26]/45 px-4 text-base text-white placeholder:text-white/70 backdrop-blur-md [color-scheme:dark] focus:border-[#b3a4ff] focus:ring-4 focus:ring-[#b3a4ff]/25 focus:outline-none"
                  {...register("api_key")}
                />
                {errors.api_key?.message && (
                  <p className="px-1 text-sm font-semibold text-[#ffd6d6]" role="alert">
                    {errors.api_key.message}
                  </p>
                )}
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="store_code" className="text-sm font-semibold text-white/90">
                {isToss ? "토스 가맹점 ID" : "매장 코드"}
              </label>
              <input
                id="store_code"
                type="text"
                autoComplete="off"
                className="h-12 w-full rounded-xl border border-white/15 bg-[#0d0a26]/45 px-4 text-base text-white placeholder:text-white/70 backdrop-blur-md [color-scheme:dark] focus:border-[#b3a4ff] focus:ring-4 focus:ring-[#b3a4ff]/25 focus:outline-none"
                {...register("store_code")}
              />
              {errors.store_code?.message && (
                <p className="px-1 text-sm font-semibold text-[#ffd6d6]" role="alert">
                  {errors.store_code.message}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-4">
          <button
            type="button"
            onClick={() => navigate("/onboarding/1")}
            className="inline-flex h-[52px] w-28 shrink-0 items-center justify-center rounded-xl bg-white/15 px-5 text-lg font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/25"
          >
            이전
          </button>
          <button
            type="submit"
            data-testid="pos-next"
            className="inline-flex h-[52px] flex-1 items-center justify-center rounded-xl bg-brand px-5 text-lg font-bold text-white transition-colors hover:bg-brand-strong"
          >
            다음
          </button>
        </div>
      </form>
    </div>
  );
}
