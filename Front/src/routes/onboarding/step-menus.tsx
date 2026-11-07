import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import { Navigate, useNavigate } from "react-router";
import { type MenusStepValues, menusStepSchema } from "../../schemas/onboarding";
import { useOnboardingStore } from "../../stores/onboarding-store";

// 빈 줄 하나로 시작한다 — 예시 메뉴를 값으로 넣으면 그대로 [다음]을 눌렀을 때 등록된다.
// 판매가는 메뉴 관리 '새 메뉴' 판처럼 빈칸으로 둔다(0을 채우면 그대로 0원 메뉴가 된다)
const EMPTY_MENU = { name: "", category: "", is_active: true } as MenusStepValues["menus"][number];

export default function MenusStep() {
  const navigate = useNavigate();
  const pos = useOnboardingStore((s) => s.pos);
  const drafts = useOnboardingStore((s) => s.menus);
  const setMenus = useOnboardingStore((s) => s.setMenus);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<MenusStepValues>({
    resolver: zodResolver(menusStepSchema),
    defaultValues: {
      menus: drafts.length > 0 ? drafts : [EMPTY_MENU],
    },
    mode: "onBlur",
  });

  const { fields, append, remove } = useFieldArray({ control, name: "menus" });

  if (!pos) return <Navigate to="/onboarding/2" replace />;

  const onSubmit = (values: MenusStepValues) => {
    setMenus(values.menus);
    navigate("/onboarding/4");
  };

  return (
    <div>
      <h1 className="mt-9 text-[1.75rem] font-extrabold tracking-tight">
        판매하는 메뉴를 알려 주세요
      </h1>
      <p className="mt-2 text-base text-white/75">재고 차감은 레시피를 등록한 뒤 켤 수 있어요</p>
      <form className="mt-8 space-y-2.5 text-left" onSubmit={handleSubmit(onSubmit)} noValidate>
        {fields.map((field, idx) => {
          const rowErrors = errors.menus?.[idx];
          const rowError =
            rowErrors?.name?.message ?? rowErrors?.category?.message ?? rowErrors?.price?.message;
          return (
            <div
              key={field.id}
              className="space-y-2 rounded-2xl border border-white/15 p-3"
              data-testid={`menu-row-${idx}`}
            >
              <input
                id={`menus.${idx}.name`}
                aria-label="메뉴명"
                placeholder="메뉴명 (예: 마르게리타)"
                className="h-12 w-full rounded-xl border border-white/15 bg-[#0d0a26]/45 px-4 text-base text-white placeholder:text-white/70 backdrop-blur-md [color-scheme:dark] focus:border-[#b3a4ff] focus:ring-4 focus:ring-[#b3a4ff]/25 focus:outline-none"
                {...register(`menus.${idx}.name`)}
              />
              <div className="flex items-center gap-2">
                <input
                  id={`menus.${idx}.category`}
                  aria-label="카테고리 (선택)"
                  placeholder="예: 피자"
                  className="h-12 rounded-xl border border-white/15 bg-[#0d0a26]/45 px-3 text-base text-white placeholder:text-white/70 backdrop-blur-md [color-scheme:dark] focus:border-[#b3a4ff] focus:ring-4 focus:ring-[#b3a4ff]/25 focus:outline-none w-24 shrink-0"
                  {...register(`menus.${idx}.category`)}
                />
                <input
                  id={`menus.${idx}.price`}
                  aria-label="판매가 (원)"
                  placeholder="판매가 (원)"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none h-12 rounded-xl border border-white/15 bg-[#0d0a26]/45 px-3 text-base text-white placeholder:text-white/70 backdrop-blur-md [color-scheme:dark] focus:border-[#b3a4ff] focus:ring-4 focus:ring-[#b3a4ff]/25 focus:outline-none min-w-0 flex-1"
                  {...register(`menus.${idx}.price`)}
                />
                <label className="flex shrink-0 items-center gap-1 text-sm text-white/90 cursor-pointer">
                  <input
                    type="checkbox"
                    className="size-4 accent-[#b3a4ff]"
                    {...register(`menus.${idx}.is_active`)}
                  />
                  판매
                </label>
                <button
                  type="button"
                  aria-label="메뉴 삭제"
                  onClick={() => remove(idx)}
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white/75 hover:bg-white/10"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              {rowError && (
                <p className="px-1 text-sm font-semibold text-[#ffd6d6]" role="alert">
                  {rowError}
                </p>
              )}
            </div>
          );
        })}

        {errors.menus?.root?.message && (
          <p className="px-1 text-sm font-semibold text-[#ffd6d6]" role="alert">
            {errors.menus.root.message}
          </p>
        )}

        <button
          type="button"
          onClick={() => append(EMPTY_MENU)}
          data-testid="menu-add"
          className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/35 text-[0.95rem] font-semibold text-white hover:bg-white/10"
        >
          <Plus className="size-4" />
          메뉴 추가
        </button>

        <div className="flex gap-2 pt-4">
          <button
            type="button"
            onClick={() => navigate("/onboarding/2")}
            className="inline-flex h-[52px] w-28 shrink-0 items-center justify-center rounded-xl bg-white/15 px-5 text-lg font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/25"
          >
            이전
          </button>
          <button
            type="submit"
            data-testid="menus-next"
            className="inline-flex h-[52px] flex-1 items-center justify-center rounded-xl bg-brand px-5 text-lg font-bold text-white transition-colors hover:bg-brand-strong"
          >
            다음
          </button>
        </div>
      </form>
    </div>
  );
}
