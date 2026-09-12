// 재고관리 화면 — Figma "재고 관리"(node 9:915) 셸 적용.
// InventoryItem에 current_quantity를 더해 실제 재고 수량 CRUD로 연결 (lots/FIFO 이력은 후속 작업).
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  type InventoryItem,
  createInventoryItem,
  deleteInventoryItem,
  listInventory,
  updateInventoryItem,
} from "../api/endpoints/inventory";
import { DashboardShell } from "../components/dashboard/shell";
import { Button } from "../components/ui/button";
import { FormField, Input } from "../components/ui/field";

const itemSchema = z.object({
  name: z.string().min(1, "재료명을 입력하세요.").max(100),
  unit: z.string().min(1, "단위를 입력하세요.").max(20),
  current_quantity: z.coerce.number({ message: "숫자로 입력하세요." }).min(0),
  low_stock_threshold: z.coerce.number({ message: "숫자로 입력하세요." }).min(0),
  safety_stock: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
  lead_time_days: z.union([z.coerce.number().int().min(0), z.literal("")]).optional(),
});
type ItemFormValues = z.infer<typeof itemSchema>;

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inventory"],
    queryFn: listInventory,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      name: "",
      unit: "",
      current_quantity: 0,
      low_stock_threshold: 0,
      safety_stock: "",
      lead_time_days: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: ItemFormValues) =>
      createInventoryItem({
        name: values.name,
        unit: values.unit,
        current_quantity: values.current_quantity,
        low_stock_threshold: values.low_stock_threshold,
        safety_stock: values.safety_stock === "" ? null : Number(values.safety_stock),
        lead_time_days: values.lead_time_days === "" ? null : Number(values.lead_time_days),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      reset();
      setShowForm(false);
    },
  });

  const quantityMutation = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      updateInventoryItem(itemId, { current_quantity: quantity }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inventory"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => deleteInventoryItem(itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inventory"] }),
    onError: (err: unknown) => {
      window.alert(
        err instanceof Error && err.message.includes("409")
          ? "레시피에서 사용 중인 재료는 삭제할 수 없습니다."
          : "삭제에 실패했습니다.",
      );
    },
  });

  return (
    <DashboardShell active="inventory">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-[#101828]">재고 현황</h1>
          <Button
            onClick={() => setShowForm((v) => !v)}
            className="h-10 rounded-full bg-[#7a5eff] px-5 text-sm font-semibold hover:bg-[#6a4eef]"
          >
            <Plus className="size-4" /> 재료 추가
          </Button>
        </div>

        {showForm && (
          <form
            onSubmit={handleSubmit((v) => createMutation.mutate(v))}
            className="grid grid-cols-1 gap-4 rounded-xl border border-[#d1d5dc] bg-white p-6 sm:grid-cols-3"
          >
            <FormField label="재료명" htmlFor="name" error={errors.name?.message}>
              <Input
                id="name"
                className="h-11 rounded-xl border-[#d1d5dc] bg-[#f3f4f6]"
                {...register("name")}
              />
            </FormField>
            <FormField label="단위 (kg, 개, L 등)" htmlFor="unit" error={errors.unit?.message}>
              <Input
                id="unit"
                className="h-11 rounded-xl border-[#d1d5dc] bg-[#f3f4f6]"
                {...register("unit")}
              />
            </FormField>
            <FormField
              label="현재 수량"
              htmlFor="current_quantity"
              error={errors.current_quantity?.message}
            >
              <Input
                id="current_quantity"
                type="number"
                step="any"
                className="h-11 rounded-xl border-[#d1d5dc] bg-[#f3f4f6]"
                {...register("current_quantity")}
              />
            </FormField>
            <FormField
              label="재주문 임계값"
              htmlFor="low_stock_threshold"
              error={errors.low_stock_threshold?.message}
              hint="이 수량 이하면 부족으로 표시"
            >
              <Input
                id="low_stock_threshold"
                type="number"
                step="any"
                className="h-11 rounded-xl border-[#d1d5dc] bg-[#f3f4f6]"
                {...register("low_stock_threshold")}
              />
            </FormField>
            <FormField label="안전재고 (선택)" htmlFor="safety_stock">
              <Input
                id="safety_stock"
                type="number"
                step="any"
                className="h-11 rounded-xl border-[#d1d5dc] bg-[#f3f4f6]"
                {...register("safety_stock")}
              />
            </FormField>
            <FormField label="리드타임(일, 선택)" htmlFor="lead_time_days">
              <Input
                id="lead_time_days"
                type="number"
                className="h-11 rounded-xl border-[#d1d5dc] bg-[#f3f4f6]"
                {...register("lead_time_days")}
              />
            </FormField>
            <div className="sm:col-span-3 flex justify-end gap-2">
              <Button
                type="button"
                onClick={() => setShowForm(false)}
                className="h-10 rounded-full border border-[#d1d5dc] bg-white px-5 text-[#364153] hover:bg-[#f3f4f6]"
              >
                취소
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="h-10 rounded-full bg-[#7a5eff] px-5 font-semibold hover:bg-[#6a4eef]"
              >
                {createMutation.isPending ? "저장 중…" : "저장"}
              </Button>
            </div>
          </form>
        )}

        <div className="overflow-hidden rounded-xl border border-[#d1d5dc] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#fafafa] text-[#61646b]">
              <tr>
                <th className="px-4 py-3 font-medium">재료</th>
                <th className="px-4 py-3 font-medium">현재 수량</th>
                <th className="px-4 py-3 font-medium">재주문 임계값</th>
                <th className="px-4 py-3 font-medium">안전재고</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-[#99a1af]">
                    불러오는 중…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-[#99a1af]">
                    등록된 재료가 없습니다. "재료 추가"로 시작하세요.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <InventoryRow
                    key={item.item_id}
                    item={item}
                    onQuantityChange={(quantity) =>
                      quantityMutation.mutate({ itemId: item.item_id, quantity })
                    }
                    onDelete={() => {
                      if (window.confirm(`"${item.name}"을(를) 삭제할까요?`)) {
                        deleteMutation.mutate(item.item_id);
                      }
                    }}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardShell>
  );
}

function InventoryRow({
  item,
  onQuantityChange,
  onDelete,
}: {
  item: InventoryItem;
  onQuantityChange: (quantity: number) => void;
  onDelete: () => void;
}) {
  const [qty, setQty] = useState(String(item.current_quantity));

  return (
    <tr className="border-t border-[#eef1f4]">
      <td className="px-4 py-3 font-medium text-[#364153]">{item.name}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="any"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            onBlur={() => {
              const n = Number(qty);
              if (!Number.isNaN(n) && n >= 0 && n !== item.current_quantity) onQuantityChange(n);
            }}
            className="h-9 w-24 rounded-lg border border-[#d1d5dc] px-2 text-sm"
          />
          <span className="text-[#99a1af]">{item.unit}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-[#364153]">
        {item.low_stock_threshold} {item.unit}
      </td>
      <td className="px-4 py-3 text-[#364153]">
        {item.safety_stock != null ? `${item.safety_stock} ${item.unit}` : "—"}
      </td>
      <td className="px-4 py-3">
        {item.is_low_stock ? (
          <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
            부족
          </span>
        ) : (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            정상
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={onDelete}
          aria-label="삭제"
          className="text-[#99a1af] hover:text-red-600"
        >
          <Trash2 className="size-4" />
        </button>
      </td>
    </tr>
  );
}
