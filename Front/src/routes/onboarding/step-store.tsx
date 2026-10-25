// M3.F3 — 온보딩 1스텝: 매장 기본정보.
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { Button } from "../../components/ui/button";
import { FormField, Input, Select } from "../../components/ui/field";
import {
  OPERATION_TYPE_LABEL,
  STORE_SIZE_LABEL,
  formatPhone,
  storeStepSchema,
  type StoreStepValues,
} from "../../schemas/onboarding";
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
    formState: { errors, isSubmitting },
  } = useForm<StoreStepValues>({
    resolver: zodResolver(storeStepSchema),
    defaultValues: draft ?? {
      store_name: "",
      business_type: "",
      store_size: "SMALL",
      operation_type: "HALL",
      address: "",
      phone: "",
    },
    mode: "onBlur",
  });
  const phoneValue = watch("phone");

  const onSubmit = (values: StoreStepValues) => {
    setStore(values);
    navigate("/onboarding/2");
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <FormField label="매장명" htmlFor="store_name" error={errors.store_name?.message}>
        <Input id="store_name" autoComplete="organization" {...register("store_name")} />
      </FormField>
      <FormField label="업종" htmlFor="business_type" error={errors.business_type?.message}>
        <Select id="business_type" {...register("business_type")} defaultValue={draft?.business_type ?? ""}>
          <option value="" disabled>
            선택하세요
          </option>
          {BUSINESS_TYPES.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </Select>
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="매장 규모" htmlFor="store_size" error={errors.store_size?.message}>
          <Select id="store_size" {...register("store_size")}>
            {Object.entries(STORE_SIZE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="운영 형태" htmlFor="operation_type" error={errors.operation_type?.message}>
          <Select id="operation_type" {...register("operation_type")}>
            {Object.entries(OPERATION_TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <FormField label="주소" htmlFor="address" error={errors.address?.message}>
        <Input id="address" autoComplete="street-address" {...register("address")} />
      </FormField>
      <FormField
        label="전화번호"
        htmlFor="phone"
        error={errors.phone?.message}
        hint="자동으로 하이픈이 채워집니다."
      >
        <Input
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
        />
      </FormField>
      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isSubmitting} data-testid="store-next">
          다음
        </Button>
      </div>
    </form>
  );
}
