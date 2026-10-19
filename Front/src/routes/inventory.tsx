// 재고관리 화면 — Figma "재고 관리"(node 9:915) 셸 적용.
// 수량은 로트 단위로 관리한다(01_basic_design.md §3.3). 품목 행을 펼치면 로트 목록·입고·수정·폐기.
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  type AdjustmentReason,
  type InventoryItem,
  type Lot,
  addLot,
  createInventoryItem,
  deleteInventoryItem,
  disposeLot,
  listInventory,
  listLots,
  updateLot,
} from "../api/endpoints/inventory";
import { DashboardShell } from "../components/dashboard/shell";
import { AlertBadge } from "../components/inventory/alert-badge";
import { Button } from "../components/ui/button";
import { FormField, Input } from "../components/ui/field";

// 빈 칸("")을 먼저 검사한다 — coerce가 먼저면 ""가 0으로 바뀌어 통과한다
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

const REASON_LABEL: Record<AdjustmentReason, string> = {
  STOCKTAKE: "실사 조정",
  EXPIRY_CORRECTION: "소비기한 정정",
  OTHER: "기타",
};

const inputClass = "h-9 rounded-lg border border-[#d1d5dc] px-2 text-sm";

// BE는 DECIMAL을 "100.000" 같은 문자열로 보낸다 — 비교·표시 전에 숫자로 바꾼다.
function fmtQty(v: number | string): string {
  return Number(v).toLocaleString("ko-KR", { maximumFractionDigits: 3 });
}

function today(): string {
  return new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD (로컬 시간대)
}

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [openItemId, setOpenItemId] = useState<string | null>(null);

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
      quantity: 0,
      expiry_date: "",
      purchase_price: "",
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      reset();
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => deleteInventoryItem(itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inventory"] }),
    onError: (err: unknown) => {
      window.alert(
        err instanceof Error && err.message.includes("409")
          ? "레시피나 발주 내역에서 사용 중인 재료는 삭제할 수 없습니다."
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
            <FormField label="현재 수량" htmlFor="quantity" error={errors.quantity?.message}>
              <Input
                id="quantity"
                type="number"
                step="any"
                className="h-11 rounded-xl border-[#d1d5dc] bg-[#f3f4f6]"
                {...register("quantity")}
              />
            </FormField>
            <FormField label="소비기한 (선택)" htmlFor="expiry_date">
              <Input
                id="expiry_date"
                type="date"
                className="h-11 rounded-xl border-[#d1d5dc] bg-[#f3f4f6]"
                {...register("expiry_date")}
              />
            </FormField>
            <FormField
              label="구매 금액 (원)"
              htmlFor="purchase_price"
              error={errors.purchase_price?.message}
              hint="현재 수량 전체의 금액"
            >
              <Input
                id="purchase_price"
                type="number"
                className="h-11 rounded-xl border-[#d1d5dc] bg-[#f3f4f6]"
                {...register("purchase_price")}
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
                <th className="px-4 py-3 font-medium">총 수량</th>
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
                    open={openItemId === item.item_id}
                    onToggle={() =>
                      setOpenItemId((id) => (id === item.item_id ? null : item.item_id))
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
  open,
  onToggle,
  onDelete,
}: {
  item: InventoryItem;
  open: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <tr className="border-t border-[#eef1f4]">
        <td className="px-4 py-3 font-medium text-[#364153]">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="inline-flex items-center gap-1 hover:text-[#7a5eff]"
          >
            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            {item.name}
          </button>
        </td>
        <td className="px-4 py-3 text-[#364153]">
          {fmtQty(item.total_quantity)} {item.unit}
        </td>
        <td className="px-4 py-3 text-[#364153]">
          {fmtQty(item.low_stock_threshold)} {item.unit}
        </td>
        <td className="px-4 py-3 text-[#364153]">
          {item.safety_stock != null ? `${fmtQty(item.safety_stock)} ${item.unit}` : "—"}
        </td>
        <td className="px-4 py-3">
          <AlertBadge status={item.alert_status} />
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
      {open && (
        <tr className="bg-[#fafafa]">
          <td colSpan={6} className="px-4 py-4">
            <LotPanel item={item} />
          </td>
        </tr>
      )}
    </>
  );
}

type LotAction = { lotId: string; kind: "edit" | "dispose" } | null;

function LotPanel({ item }: { item: InventoryItem }) {
  const queryClient = useQueryClient();
  const [action, setAction] = useState<LotAction>(null);
  const { data: lots = [], isLoading } = useQuery({
    queryKey: ["inventory", item.item_id, "lots"],
    queryFn: () => listLots(item.item_id),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["inventory"] });

  return (
    <div className="space-y-4">
      {item.alert_status === "NEEDS_CHECK" && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          기록상 재고 없이 판매가 차감됐습니다. 입고를 등록하거나 실사 조정으로 수량을 맞추세요.
        </p>
      )}
      <AddLotForm itemId={item.item_id} unit={item.unit} onDone={refresh} />
      <table className="w-full text-left text-sm">
        <thead className="text-[#61646b]">
          <tr>
            <th className="py-2 font-medium">입고일</th>
            <th className="py-2 font-medium">소비기한</th>
            <th className="py-2 font-medium">입고 수량</th>
            <th className="py-2 font-medium">잔여 수량</th>
            <th className="py-2 font-medium">구매 금액</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={6} className="py-3 text-center text-[#99a1af]">
                불러오는 중…
              </td>
            </tr>
          ) : lots.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-3 text-center text-[#99a1af]">
                로트가 없습니다. 입고를 등록하세요.
              </td>
            </tr>
          ) : (
            lots.map((lot) => (
              <LotRow
                key={lot.lot_id}
                lot={lot}
                unit={item.unit}
                action={action?.lotId === lot.lot_id ? action.kind : null}
                onAction={(kind) =>
                  setAction((a) =>
                    a?.lotId === lot.lot_id && a.kind === kind ? null : { lotId: lot.lot_id, kind },
                  )
                }
                onDone={() => {
                  setAction(null);
                  refresh();
                }}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function AddLotForm({
  itemId,
  unit,
  onDone,
}: { itemId: string; unit: string; onDone: () => void }) {
  const [quantity, setQuantity] = useState("");
  const [receivedAt, setReceivedAt] = useState(today());
  const [expiry, setExpiry] = useState("");
  const [price, setPrice] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      addLot(itemId, {
        quantity: Number(quantity),
        received_at: receivedAt,
        expiry_date: expiry || null,
        purchase_price: Number(price),
      }),
    onSuccess: () => {
      setQuantity("");
      setExpiry("");
      setPrice("");
      onDone();
    },
    onError: () => window.alert("입고 등록에 실패했습니다."),
  });
  const valid = Number(quantity) > 0 && price !== "" && Number(price) >= 0 && receivedAt !== "";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) mutation.mutate();
      }}
      className="flex flex-wrap items-end gap-2"
    >
      <label className="text-xs text-[#61646b]">
        입고 수량 ({unit})
        <input
          type="number"
          step="any"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className={`${inputClass} block w-28`}
        />
      </label>
      <label className="text-xs text-[#61646b]">
        입고일
        <input
          type="date"
          value={receivedAt}
          onChange={(e) => setReceivedAt(e.target.value)}
          className={`${inputClass} block`}
        />
      </label>
      <label className="text-xs text-[#61646b]">
        소비기한 (선택)
        <input
          type="date"
          value={expiry}
          onChange={(e) => setExpiry(e.target.value)}
          className={`${inputClass} block`}
        />
      </label>
      <label className="text-xs text-[#61646b]">
        구매 금액 (원)
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className={`${inputClass} block w-32`}
        />
      </label>
      <Button
        type="submit"
        disabled={!valid || mutation.isPending}
        className="h-9 rounded-full bg-[#7a5eff] px-4 text-sm font-semibold hover:bg-[#6a4eef]"
      >
        입고 등록
      </Button>
    </form>
  );
}

function LotRow({
  lot,
  unit,
  action,
  onAction,
  onDone,
}: {
  lot: Lot;
  unit: string;
  action: "edit" | "dispose" | null;
  onAction: (kind: "edit" | "dispose") => void;
  onDone: () => void;
}) {
  return (
    <>
      <tr className="border-t border-[#eef1f4]">
        <td className="py-2">{lot.received_at}</td>
        <td className="py-2">{lot.expiry_date ?? "—"}</td>
        <td className="py-2">
          {fmtQty(lot.quantity)} {unit}
        </td>
        <td className="py-2 font-medium">
          {fmtQty(lot.remaining_quantity)} {unit}
        </td>
        <td className="py-2">{lot.purchase_price.toLocaleString("ko-KR")}원</td>
        <td className="py-2 text-right">
          <button
            type="button"
            onClick={() => onAction("edit")}
            className="mr-3 text-xs text-[#7a5eff] hover:underline"
          >
            수정
          </button>
          <button
            type="button"
            onClick={() => onAction("dispose")}
            className="text-xs text-red-600 hover:underline"
          >
            폐기
          </button>
        </td>
      </tr>
      {action === "edit" && (
        <tr>
          <td colSpan={6} className="pb-3">
            <EditLotForm lot={lot} unit={unit} onDone={onDone} />
          </td>
        </tr>
      )}
      {action === "dispose" && (
        <tr>
          <td colSpan={6} className="pb-3">
            <DisposeForm lot={lot} unit={unit} onDone={onDone} />
          </td>
        </tr>
      )}
    </>
  );
}

function EditLotForm({ lot, unit, onDone }: { lot: Lot; unit: string; onDone: () => void }) {
  const [remaining, setRemaining] = useState(String(Number(lot.remaining_quantity)));
  const [expiry, setExpiry] = useState(lot.expiry_date ?? "");
  const [reason, setReason] = useState<AdjustmentReason>("STOCKTAKE");
  const [memo, setMemo] = useState("");
  const mutation = useMutation({
    mutationFn: () => {
      const n = Number(remaining);
      return updateLot(lot.item_id, lot.lot_id, {
        ...(n !== Number(lot.remaining_quantity) && { remaining_quantity: n }),
        ...((expiry || null) !== lot.expiry_date && { expiry_date: expiry || null }),
        reason,
        memo: memo || null,
      });
    },
    onSuccess: onDone,
    onError: () => window.alert("로트 수정에 실패했습니다."),
  });
  const valid = remaining !== "" && Number(remaining) >= 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) mutation.mutate();
      }}
      className="flex flex-wrap items-end gap-2 rounded-lg bg-white p-3"
    >
      <label className="text-xs text-[#61646b]">
        잔여 수량 ({unit})
        <input
          type="number"
          step="any"
          value={remaining}
          onChange={(e) => setRemaining(e.target.value)}
          className={`${inputClass} block w-28`}
        />
      </label>
      <label className="text-xs text-[#61646b]">
        소비기한
        <input
          type="date"
          value={expiry}
          onChange={(e) => setExpiry(e.target.value)}
          className={`${inputClass} block`}
        />
      </label>
      <label className="text-xs text-[#61646b]">
        수정 사유
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value as AdjustmentReason)}
          className={`${inputClass} block`}
        >
          {(Object.keys(REASON_LABEL) as AdjustmentReason[]).map((r) => (
            <option key={r} value={r}>
              {REASON_LABEL[r]}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-[#61646b]">
        메모 (선택)
        <input
          value={memo}
          maxLength={255}
          onChange={(e) => setMemo(e.target.value)}
          className={`${inputClass} block w-48`}
        />
      </label>
      <Button
        type="submit"
        disabled={!valid || mutation.isPending}
        className="h-9 rounded-full bg-[#7a5eff] px-4 text-sm font-semibold hover:bg-[#6a4eef]"
      >
        저장
      </Button>
    </form>
  );
}

function DisposeForm({ lot, unit, onDone }: { lot: Lot; unit: string; onDone: () => void }) {
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      disposeLot(lot.item_id, {
        lot_id: lot.lot_id,
        quantity: Number(quantity),
        reason: reason || null,
      }),
    onSuccess: onDone,
    onError: (err: unknown) =>
      window.alert(
        err instanceof Error && err.message.includes("422")
          ? "폐기 수량이 잔여 수량보다 많습니다."
          : "폐기 처리에 실패했습니다.",
      ),
  });
  const n = Number(quantity);
  const valid = n > 0 && n <= Number(lot.remaining_quantity);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) mutation.mutate();
      }}
      className="flex flex-wrap items-end gap-2 rounded-lg bg-white p-3"
    >
      <label className="text-xs text-[#61646b]">
        폐기 수량 ({unit}, 최대 {fmtQty(lot.remaining_quantity)})
        <input
          type="number"
          step="any"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className={`${inputClass} block w-28`}
        />
      </label>
      <label className="text-xs text-[#61646b]">
        폐기 사유 (선택)
        <input
          value={reason}
          maxLength={255}
          placeholder="소비기한 만료"
          onChange={(e) => setReason(e.target.value)}
          className={`${inputClass} block w-48`}
        />
      </label>
      <Button
        type="submit"
        disabled={!valid || mutation.isPending}
        className="h-9 rounded-full bg-red-600 px-4 text-sm font-semibold hover:bg-red-700"
      >
        폐기
      </Button>
    </form>
  );
}
