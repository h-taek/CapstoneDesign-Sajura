// M3.F5 — 온보딩 3스텝: 메뉴 등록 (동적 배열, 07_api_spec.md §4 POST /api/menus/bulk).
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import { Navigate, useNavigate } from "react-router";
import { Button } from "../../components/ui/button";
import { FormField, Input } from "../../components/ui/field";
import { type MenusStepValues, menusStepSchema } from "../../schemas/onboarding";
import { useOnboardingStore } from "../../stores/onboarding-store";

const EMPTY_MENU = {
  name: "",
  category: "음료",
  price: 0,
  is_active: true,
  use_inventory_deduction: true,
};

export default function MenusStep() {
  const navigate = useNavigate();
  const pos = useOnboardingStore((s) => s.pos);
  const drafts = useOnboardingStore((s) => s.menus);
  const setMenus = useOnboardingStore((s) => s.setMenus);

  if (!pos) return <Navigate to="/onboarding/2" replace />;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<MenusStepValues>({
    resolver: zodResolver(menusStepSchema),
    defaultValues: { menus: drafts.length > 0 ? drafts : [{ ...EMPTY_MENU }] },
    mode: "onBlur",
  });
  const { fields, append, remove } = useFieldArray({ control, name: "menus" });

  const onSubmit = (values: MenusStepValues) => {
    setMenus(values.menus);
    navigate("/onboarding/4");
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-[#101828]">메뉴 등록</h2>
        <p className="text-base text-[#364153]">판매하는 메뉴를 등록해주세요.</p>
      </div>

      <div className="space-y-3">
        {fields.map((field, idx) => {
          const rowErrors = errors.menus?.[idx];
          return (
            <div
              key={field.id}
              className="grid grid-cols-12 items-start gap-3 rounded-xl border border-[#d1d5dc] p-4"
              data-testid={`menu-row-${idx}`}
            >
              <div className="col-span-4">
                <FormField
                  label="메뉴명"
                  htmlFor={`menus.${idx}.name`}
                  error={rowErrors?.name?.message}
                >
                  <Input
                    id={`menus.${idx}.name`}
                    className="h-11 rounded-xl border-[#d1d5dc] bg-[#f3f4f6]"
                    {...register(`menus.${idx}.name`)}
                  />
                </FormField>
              </div>
              <div className="col-span-3">
                <FormField
                  label="카테고리"
                  htmlFor={`menus.${idx}.category`}
                  error={rowErrors?.category?.message}
                >
                  <Input
                    id={`menus.${idx}.category`}
                    className="h-11 rounded-xl border-[#d1d5dc] bg-[#f3f4f6]"
                    {...register(`menus.${idx}.category`)}
                  />
                </FormField>
              </div>
              <div className="col-span-3">
                <FormField
                  label="단가(원)"
                  htmlFor={`menus.${idx}.price`}
                  error={rowErrors?.price?.message}
                >
                  <Input
                    id={`menus.${idx}.price`}
                    inputMode="numeric"
                    type="number"
                    min={0}
                    className="h-11 rounded-xl border-[#d1d5dc] bg-[#f3f4f6]"
                    {...register(`menus.${idx}.price`)}
                  />
                </FormField>
              </div>
              <div className="col-span-2 flex justify-end pt-7">
                <Button
                  type="button"
                  variant="ghost"
                  aria-label="메뉴 삭제"
                  disabled={fields.length === 1}
                  onClick={() => remove(idx)}
                  className="h-11 rounded-full text-[#99a1af] hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="col-span-12 flex gap-4 text-sm text-[#364153]">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="accent-[#7a5eff]"
                    {...register(`menus.${idx}.is_active`)}
                  />{" "}
                  판매 활성
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="accent-[#7a5eff]"
                    {...register(`menus.${idx}.use_inventory_deduction`)}
                  />
                  재고 차감
                </label>
              </div>
            </div>
          );
        })}
      </div>
      {errors.menus?.root?.message ? (
        <p className="text-xs text-red-600" role="alert">
          {errors.menus.root.message}
        </p>
      ) : null}
      <Button
        type="button"
        onClick={() => append({ ...EMPTY_MENU })}
        data-testid="menu-add"
        className="h-10 rounded-full border border-[#d1d5dc] bg-white px-4 text-sm text-[#364153] hover:bg-[#f3f4f6]"
      >
        <Plus className="size-4" /> 메뉴 추가
      </Button>
      <div className="flex justify-between pt-2">
        <Button
          type="button"
          onClick={() => navigate("/onboarding/2")}
          className="h-11 rounded-full border border-[#d1d5dc] bg-white px-6 text-[#364153] hover:bg-[#f3f4f6]"
        >
          이전
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          data-testid="menus-next"
          className="h-11 rounded-full bg-[#7a5eff] px-8 font-semibold hover:bg-[#6a4eef]"
        >
          다음
        </Button>
      </div>
    </form>
  );
}
