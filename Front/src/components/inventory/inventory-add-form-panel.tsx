// 새 재료 추가 판 — 수량 있으면 구매 금액 검증 오류 표시, DateField 날짜 입력 (04_fe.md §4.6, 09_inventory.html).
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { createInventoryItem } from "../../api/endpoints/inventory";
import { FollowPanel } from "../shell/follow-panel";
import { DateField } from "../ui/date-field";

const optionalNumber = z.union([z.literal(""), z.coerce.number().min(0)]).optional();

const itemSchema = z
  .object({
    name: z.string().min(1, "재료명을 입력하세요.").max(100),
    unit: z.string().min(1, "단위를 입력하세요.").max(20),
    quantity: z.coerce.number({ message: "숫자로 입력하세요." }).min(0),
    expiry_date: z.string().optional(),
    purchase_price: optionalNumber,
    low_stock_threshold: z.coerce.number({ message: "숫자로 입력하세요." }).min(0),
    safety_stock: optionalNumber,
    lead_time_days: z.union([z.literal(""), z.coerce.number().int().min(0)]).optional(),
  })
  .refine((v) => v.quantity === 0 || (v.purchase_price !== "" && v.purchase_price !== undefined), {
    message: "수량이 있으면 구매 금액을 입력하세요.",
    path: ["purchase_price"],
  });

type ItemFormValues = z.infer<typeof itemSchema>;

export interface InventoryAddFormPanelProps {
  onClose: () => void;
  onSuccess: (createdItemId: string) => void;
}

export function InventoryAddFormPanel({ onClose, onSuccess }: InventoryAddFormPanelProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      name: "",
      unit: "",
      quantity: 0,
      expiry_date: "",
      purchase_price: "",
      low_stock_threshold: 0,
      safety_stock: "",
      lead_time_days: "",
    },
  });

  const expiryValue = watch("expiry_date");

  const createMutation = useMutation({
    mutationFn: (values: ItemFormValues) =>
      createInventoryItem({
        name: values.name,
        unit: values.unit,
        quantity: values.quantity,
        expiry_date: values.expiry_date ? values.expiry_date : null,
        purchase_price:
          values.purchase_price === "" || values.purchase_price === undefined
            ? null
            : Number(values.purchase_price),
        low_stock_threshold: values.low_stock_threshold,
        safety_stock: values.safety_stock === "" ? null : Number(values.safety_stock),
        lead_time_days: values.lead_time_days === "" ? null : Number(values.lead_time_days),
      }),
    onSuccess: (newItem) => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      onSuccess(newItem.item_id);
    },
    onError: () => window.alert("재료 등록에 실패했습니다."),
  });

  return (
    <FollowPanel title="새 재료" onClose={onClose} aria-label="새 재료" className="lg:col-span-2">
      <form
        onSubmit={handleSubmit((v) => createMutation.mutate(v))}
        className="mt-4 grid grid-cols-2 gap-3"
      >
        <label className="col-span-2 flex flex-col gap-1 text-sm font-semibold text-ink-2">
          재료명
          <input
            {...register("name")}
            className="h-11 w-full rounded-xl border border-white/80 bg-transparent px-3 text-base font-normal text-ink focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none"
          />
          {errors.name && (
            <span className="text-xs font-normal text-danger" role="alert">
              {errors.name.message}
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm font-semibold text-ink-2">
          현재 수량
          <input
            type="number"
            step="any"
            inputMode="decimal"
            {...register("quantity")}
            className="h-11 w-full rounded-xl border border-white/80 bg-transparent px-3 text-base font-normal text-ink focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none"
          />
          {errors.quantity && (
            <span className="text-xs font-normal text-danger" role="alert">
              {errors.quantity.message}
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm font-semibold text-ink-2">
          단위
          <input
            placeholder="kg, 개, L"
            {...register("unit")}
            className="h-11 w-full rounded-xl border border-white/80 bg-transparent px-3 text-base font-normal text-ink placeholder:text-ink-4 focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none"
          />
          {errors.unit && (
            <span className="text-xs font-normal text-danger" role="alert">
              {errors.unit.message}
            </span>
          )}
        </label>

        {/* 오류가 있으면 힌트 대신 오류를 보인다 */}
        <label className="flex flex-col gap-1 text-sm font-semibold text-ink-2">
          구매 금액 (원)
          <input
            type="number"
            inputMode="numeric"
            {...register("purchase_price")}
            className={`h-11 w-full rounded-xl border bg-transparent px-3 text-base font-normal text-ink focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none ${
              errors.purchase_price ? "border-danger" : "border-white/80"
            }`}
          />
          {errors.purchase_price && (
            <span className="text-xs font-normal text-danger" role="alert">
              {errors.purchase_price.message}
            </span>
          )}
        </label>

        <div className="flex flex-col gap-1 text-sm font-semibold text-ink-2">
          <span>소비기한 (선택)</span>
          <DateField
            value={expiryValue ?? ""}
            onChange={(v) => setValue("expiry_date", v)}
            optional
            aria-label="소비기한 (선택)"
          />
        </div>

        <label className="flex flex-col gap-1 text-sm font-semibold text-ink-2">
          <span>
            재주문 임계값{" "}
            <span
              title="이 수량 이하면 부족으로 표시"
              className="inline-flex align-middle text-ink-2"
            >
              <Info className="size-3.5" />
            </span>
          </span>
          <input
            type="number"
            step="any"
            inputMode="decimal"
            {...register("low_stock_threshold")}
            className="h-11 w-full rounded-xl border border-white/80 bg-transparent px-3 text-base font-normal text-ink focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none"
          />
          {errors.low_stock_threshold && (
            <span className="text-xs font-normal text-danger" role="alert">
              {errors.low_stock_threshold.message}
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm font-semibold text-ink-2">
          안전재고 (선택)
          <input
            type="number"
            step="any"
            inputMode="decimal"
            {...register("safety_stock")}
            className="h-11 w-full rounded-xl border border-white/80 bg-transparent px-3 text-base font-normal text-ink focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-semibold text-ink-2">
          리드타임 (일, 선택)
          <input
            type="number"
            inputMode="numeric"
            {...register("lead_time_days")}
            className="h-11 w-full rounded-xl border border-white/80 bg-transparent px-3 text-base font-normal text-ink focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none"
          />
        </label>

        <div className="col-span-2 mt-2 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-xl border border-white/80 text-[0.95rem] font-semibold text-ink-2 hover:bg-white/30"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="h-11 flex-1 rounded-xl bg-brand text-[0.95rem] font-semibold text-white hover:bg-brand-strong disabled:opacity-60"
          >
            {createMutation.isPending ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </FollowPanel>
  );
}
