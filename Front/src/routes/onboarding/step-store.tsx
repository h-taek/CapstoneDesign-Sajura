import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown } from "lucide-react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { type StoreStepValues, formatPhone, storeStepSchema } from "../../schemas/onboarding";
import { useOnboardingStore } from "../../stores/onboarding-store";

const BUSINESS_TYPES = ["카페", "한식", "양식", "분식", "주점", "기타"];

export default function StoreStep() {
  const navigate = useNavigate();
  const draft = useOnboardingStore((s) => s.store);
  const setStore = useOnboardingStore((s) => s.setStore);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<StoreStepValues>({
    resolver: zodResolver(storeStepSchema),
    defaultValues: draft ?? {
      store_name: "사주라 화덕피자 성수점",
      business_type: "양식",
      store_size: "MEDIUM",
      operation_type: "BOTH",
      address: "서울 성동구 성수이로 00",
      phone: "02-000-0000",
    },
    mode: "onBlur",
  });
  const phoneValue = watch("phone");

  const onSubmit = (values: StoreStepValues) => {
    setStore(values);
    navigate("/onboarding/2");
  };

  return (
    <div>
      <h1 className="mt-9 text-[1.75rem] font-extrabold tracking-tight">매장 정보를 알려 주세요</h1>
      <p className="mt-2 text-base text-white/75">AI 예측에 쓰는 기본 정보예요</p>
      <form className="mt-8 space-y-3 text-left" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="store_name" className="text-sm font-semibold text-white/90">
            매장명
          </label>
          <input
            id="store_name"
            type="text"
            autoComplete="organization"
            className="h-12 w-full rounded-xl border border-white/15 bg-[#0d0a26]/45 px-4 text-base text-white placeholder:text-white/70 backdrop-blur-md [color-scheme:dark] focus:border-[#b3a4ff] focus:ring-4 focus:ring-[#b3a4ff]/25 focus:outline-none"
            {...register("store_name")}
          />
          {errors.store_name?.message && (
            <p className="px-1 text-sm font-semibold text-[#ffd6d6]" role="alert">
              {errors.store_name.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="business_type" className="text-sm font-semibold text-white/90">
            업종
          </label>
          <span className="relative block">
            <select
              id="business_type"
              className="h-12 w-full rounded-xl border border-white/15 bg-[#0d0a26]/45 px-4 text-base text-white placeholder:text-white/70 backdrop-blur-md [color-scheme:dark] focus:border-[#b3a4ff] focus:ring-4 focus:ring-[#b3a4ff]/25 focus:outline-none appearance-none pr-10"
              {...register("business_type")}
            >
              {BUSINESS_TYPES.map((b) => (
                <option key={b} value={b} className="bg-[#110b36] text-white">
                  {b}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-white/80" />
          </span>
          {errors.business_type?.message && (
            <p className="px-1 text-sm font-semibold text-[#ffd6d6]" role="alert">
              {errors.business_type.message}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="store_size" className="text-sm font-semibold text-white/90">
              매장 규모
            </label>
            <span className="relative block">
              <select
                id="store_size"
                className="h-12 w-full rounded-xl border border-white/15 bg-[#0d0a26]/45 px-4 text-base text-white placeholder:text-white/70 backdrop-blur-md [color-scheme:dark] focus:border-[#b3a4ff] focus:ring-4 focus:ring-[#b3a4ff]/25 focus:outline-none appearance-none pr-10"
                {...register("store_size")}
              >
                <option value="SMALL" className="bg-[#110b36] text-white">
                  소형 (~10석)
                </option>
                <option value="MEDIUM" className="bg-[#110b36] text-white">
                  중형 (11~30석)
                </option>
                <option value="LARGE" className="bg-[#110b36] text-white">
                  대형 (31석~)
                </option>
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-white/80" />
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="operation_type" className="text-sm font-semibold text-white/90">
              운영 형태
            </label>
            <span className="relative block">
              <select
                id="operation_type"
                className="h-12 w-full rounded-xl border border-white/15 bg-[#0d0a26]/45 px-4 text-base text-white placeholder:text-white/70 backdrop-blur-md [color-scheme:dark] focus:border-[#b3a4ff] focus:ring-4 focus:ring-[#b3a4ff]/25 focus:outline-none appearance-none pr-10"
                {...register("operation_type")}
              >
                <option value="HALL" className="bg-[#110b36] text-white">
                  홀
                </option>
                <option value="DELIVERY" className="bg-[#110b36] text-white">
                  배달
                </option>
                <option value="BOTH" className="bg-[#110b36] text-white">
                  홀+배달
                </option>
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-white/80" />
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="address" className="text-sm font-semibold text-white/90">
            주소
          </label>
          <input
            id="address"
            type="text"
            autoComplete="street-address"
            className="h-12 w-full rounded-xl border border-white/15 bg-[#0d0a26]/45 px-4 text-base text-white placeholder:text-white/70 backdrop-blur-md [color-scheme:dark] focus:border-[#b3a4ff] focus:ring-4 focus:ring-[#b3a4ff]/25 focus:outline-none"
            {...register("address")}
          />
          {errors.address?.message && (
            <p className="px-1 text-sm font-semibold text-[#ffd6d6]" role="alert">
              {errors.address.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="phone" className="text-sm font-semibold text-white/90">
            전화번호
          </label>
          <input
            id="phone"
            inputMode="tel"
            autoComplete="tel"
            value={phoneValue}
            onChange={(e) =>
              setValue("phone", formatPhone(e.target.value), { shouldValidate: false })
            }
            onBlur={() =>
              setValue("phone", formatPhone(phoneValue ?? ""), { shouldValidate: true })
            }
            className="h-12 w-full rounded-xl border border-white/15 bg-[#0d0a26]/45 px-4 text-base text-white placeholder:text-white/70 backdrop-blur-md [color-scheme:dark] focus:border-[#b3a4ff] focus:ring-4 focus:ring-[#b3a4ff]/25 focus:outline-none"
          />
          {errors.phone?.message ? (
            <p className="px-1 text-sm font-semibold text-[#ffd6d6]" role="alert">
              {errors.phone.message}
            </p>
          ) : (
            <p className="px-1 text-sm text-white/85">자동으로 하이픈이 채워져요.</p>
          )}
        </div>

        <div className="flex gap-2 pt-4">
          <button
            type="submit"
            data-testid="store-next"
            className="inline-flex h-[52px] flex-1 items-center justify-center rounded-xl bg-brand px-5 text-lg font-bold text-white transition-colors hover:bg-brand-strong"
          >
            다음
          </button>
        </div>
      </form>
    </div>
  );
}
