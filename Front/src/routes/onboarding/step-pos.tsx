// M3.F4 — 온보딩 2스텝: POS 연동 (BE M3.B6 stub 200 응답 사용).
// Figma "POS 연동"(node 5:413) 라디오 선택 패턴 + "사용자 계정 인증 완료"(node 5:400) 웰컴 문구 반영.
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Navigate, useNavigate } from "react-router";
import { Button } from "../../components/ui/button";
import { FormField, Input } from "../../components/ui/field";
import { cn } from "../../lib/utils";
import { POS_TYPE_LABEL, type PosStepValues, posStepSchema } from "../../schemas/onboarding";
import { useAuthStore } from "../../stores/auth-store";
import { useOnboardingStore } from "../../stores/onboarding-store";

const POS_TYPES = (Object.keys(POS_TYPE_LABEL) as PosStepValues["pos_type"][]).map((value) => ({
  value,
  label: POS_TYPE_LABEL[value],
}));

export default function PosStep() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.user?.name);
  const store = useOnboardingStore((s) => s.store);
  const draft = useOnboardingStore((s) => s.pos);
  const setPos = useOnboardingStore((s) => s.setPos);

  // 1스텝 미완료 시 진입 차단.
  if (!store) return <Navigate to="/onboarding/1" replace />;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PosStepValues>({
    resolver: zodResolver(posStepSchema),
    defaultValues: draft ?? { pos_type: "CSV_ONLY", api_key: "", store_code: "" },
    mode: "onBlur",
  });
  const posType = watch("pos_type");
  const csvOnly = posType === "CSV_ONLY";

  const onSubmit = (values: PosStepValues) => {
    setPos(values);
    navigate("/onboarding/3");
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-ink">
          {userName ? `${userName}님, ` : ""}Sajura에 오신 걸 환영합니다
        </h2>
        <p className="text-base text-ink-2">POS 데이터를 연동해주세요.</p>
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium text-ink-2">POS 종류</span>
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="POS 종류">
          {POS_TYPES.map((t) => {
            const active = posType === t.value;
            return (
              <label
                key={t.value}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors",
                  active
                    ? "border-brand bg-brand-soft text-ink"
                    : "border-line bg-white text-ink-2 hover:bg-subtle",
                )}
              >
                <input
                  type="radio"
                  value={t.value}
                  className="size-4 accent-brand"
                  {...register("pos_type")}
                />
                {t.label}
              </label>
            );
          })}
        </div>
        {errors.pos_type ? (
          <p className="text-sm text-red-600" role="alert">
            {errors.pos_type.message}
          </p>
        ) : null}
      </div>

      <FormField
        label="POS API 키"
        htmlFor="api_key"
        error={errors.api_key?.message}
        hint={csvOnly ? "CSV 업로드 모드는 자격증명 없이 진행합니다." : undefined}
      >
        <Input
          id="api_key"
          autoComplete="off"
          disabled={csvOnly}
          className="h-11 rounded-xl border-line bg-subtle"
          {...register("api_key")}
        />
      </FormField>
      <FormField label="매장 코드" htmlFor="store_code" error={errors.store_code?.message}>
        <Input
          id="store_code"
          autoComplete="off"
          disabled={csvOnly}
          className="h-11 rounded-xl border-line bg-subtle"
          {...register("store_code")}
        />
      </FormField>

      <div className="flex justify-between pt-2">
        <Button
          type="button"
          onClick={() => navigate("/onboarding/1")}
          className="h-11 rounded-full border border-line bg-white px-6 text-ink-2 hover:bg-subtle"
        >
          이전
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          data-testid="pos-next"
          className="h-11 rounded-full bg-brand px-8 font-semibold hover:bg-brand-strong"
        >
          다음
        </Button>
      </div>
    </form>
  );
}
