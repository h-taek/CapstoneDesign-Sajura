// 경고 배지·정렬은 BE가 준 원본값으로 FE가 판정한다(04_fe.md §4.6). 웹은 머리글, 앱은 정렬 선택으로 전환.
// 재고관리 화면 — Figma "재고 관리"(node 9:915) 셸 적용.
// 수량은 로트 단위로 관리한다(01_basic_design.md §3.3). 품목 행을 펼치면 로트 목록·입고·수정·폐기.
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
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
import {
  type InventorySortKey,
  type StockStatus,
  daysUntil,
  sortInventory,
  stockStatus,
} from "../components/inventory/stock-status";
import { Button } from "../components/ui/button";
import { Card, PageHeader, Segmented } from "../components/ui/card";
import { FormField, Input } from "../components/ui/field";
import { cn } from "../lib/utils";
import { usePreferencesStore } from "../stores/preferences-store";

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

const inputClass =
  "h-11 rounded-xl border border-line bg-white px-3 text-base text-ink focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none";

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
  const [filter, setFilter] = useState<"all" | "alert">("all");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inventory"],
    queryFn: listInventory,
  });
  const sort = usePreferencesStore((st) => st.inventorySort);
  const setSort = usePreferencesStore((st) => st.setInventorySort);
  const today = useMemo(() => new Date(), []);
  const sorted = useMemo(
    () => sortInventory(items, sort.key, sort.dir, today),
    [items, sort, today],
  );
  const toggleSort = (key: InventorySortKey) =>
    setSort({ key, dir: sort.key === key && sort.dir === "asc" ? "desc" : "asc" });

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

  const isAlert = (i: InventoryItem) => stockStatus(i, today) !== "NORMAL";
  const alertCount = items.filter(isAlert).length;
  const visibleItems = filter === "alert" ? sorted.filter(isAlert) : sorted;

  return (
    <DashboardShell active="inventory">
      <div className="space-y-6 lg:space-y-8">
        <PageHeader
          title="재고 현황"
          description="재료를 누르면 입고·수정·폐기를 할 수 있어요."
          actions={
            <Button size="lg" onClick={() => setShowForm((v) => !v)} className="w-full sm:w-auto">
              <Plus className="size-5" /> 재료 추가
            </Button>
          }
        />

        {showForm && (
          <Card className="p-5 lg:p-6">
            <form
              onSubmit={handleSubmit((v) => createMutation.mutate(v))}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              <p className="text-lg font-bold text-ink sm:col-span-2 lg:col-span-4">새 재료 등록</p>
              <FormField label="재료명" htmlFor="name" error={errors.name?.message}>
                <Input id="name" {...register("name")} />
              </FormField>
              <FormField label="단위 (kg, 개, L 등)" htmlFor="unit" error={errors.unit?.message}>
                <Input id="unit" {...register("unit")} />
              </FormField>
              <FormField label="현재 수량" htmlFor="quantity" error={errors.quantity?.message}>
                <Input
                  id="quantity"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  {...register("quantity")}
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
                  inputMode="numeric"
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
                  inputMode="decimal"
                  {...register("low_stock_threshold")}
                />
              </FormField>
              <FormField label="소비기한 (선택)" htmlFor="expiry_date">
                <Input id="expiry_date" type="date" {...register("expiry_date")} />
              </FormField>
              <FormField label="안전재고 (선택)" htmlFor="safety_stock">
                <Input
                  id="safety_stock"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  {...register("safety_stock")}
                />
              </FormField>
              <FormField label="리드타임(일, 선택)" htmlFor="lead_time_days">
                <Input
                  id="lead_time_days"
                  type="number"
                  inputMode="numeric"
                  {...register("lead_time_days")}
                />
              </FormField>
              <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end lg:col-span-4">
                <Button variant="secondary" size="lg" onClick={() => setShowForm(false)}>
                  취소
                </Button>
                <Button type="submit" size="lg" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "저장 중…" : "저장"}
                </Button>
              </div>
            </form>
          </Card>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            label="재고 보기"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: `전체 ${items.length}` },
              { value: "alert", label: `확인 필요 ${alertCount}` },
            ]}
          />
          <label className="flex items-center gap-2 text-sm font-semibold text-ink-3 lg:hidden">
            정렬
            <select
              aria-label="재고 정렬"
              value={`${sort.key}:${sort.dir}`}
              onChange={(e) => {
                const [key, dir] = e.target.value.split(":") as [InventorySortKey, "asc" | "desc"];
                setSort({ key, dir });
              }}
              className="h-11 rounded-xl border border-line bg-white px-3 text-base font-semibold text-ink"
            >
              <option value="expiry:asc">소비기한 빠른순</option>
              <option value="status:asc">급한 것부터</option>
              <option value="name:asc">이름순</option>
              <option value="quantity:asc">수량 적은순</option>
            </select>
          </label>
        </div>

        <Card className="overflow-hidden">
          <div className="hidden lg:grid-cols-[minmax(0,1.5fr)_1fr_1.3fr_1fr_1fr_8.5rem_3rem] gap-4 bg-subtle px-5 py-3 text-sm font-semibold text-ink-3 lg:grid">
            <SortHeader label="재료" sortKey="name" sort={sort} onSort={toggleSort} />
            <SortHeader label="총 수량" sortKey="quantity" sort={sort} onSort={toggleSort} />
            <SortHeader label="소비기한" sortKey="expiry" sort={sort} onSort={toggleSort} />
            <span>재주문 임계값</span>
            <span>안전재고</span>
            <SortHeader label="상태" sortKey="status" sort={sort} onSort={toggleSort} />
            <span />
          </div>
          {isLoading ? (
            <p className="px-5 py-8 text-center text-ink-3">불러오는 중…</p>
          ) : visibleItems.length === 0 ? (
            <p className="px-5 py-8 text-center text-ink-3">
              {items.length === 0
                ? '등록된 재료가 없습니다. "재료 추가"로 시작하세요.'
                : "확인이 필요한 재료가 없습니다."}
            </p>
          ) : (
            <ul className="divide-y divide-line-soft">
              {visibleItems.map((item) => (
                <InventoryRow
                  key={item.item_id}
                  item={item}
                  status={stockStatus(item, today)}
                  today={today}
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
              ))}
            </ul>
          )}
        </Card>
      </div>
    </DashboardShell>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: InventorySortKey;
  sort: { key: InventorySortKey; dir: "asc" | "desc" };
  onSort: (key: InventorySortKey) => void;
}) {
  const active = sort.key === sortKey;
  const Arrow = sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <span>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-pressed={active}
        title={`${label} 기준으로 정렬`}
        className={cn("inline-flex items-center gap-1", active ? "text-brand" : "hover:text-ink-2")}
      >
        {label}
        {active && <Arrow className="size-3.5" />}
      </button>
    </span>
  );
}

function expiryLabel(iso: string | null, today: Date): string {
  if (iso === null) return "—";
  const days = daysUntil(iso, today);
  return `${iso} (${days < 0 ? `${-days}일 지남` : `D-${days}`})`;
}

function InventoryRow({
  item,
  status,
  today,
  open,
  onToggle,
  onDelete,
}: {
  item: InventoryItem;
  status: StockStatus;
  today: Date;
  open: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const warn = status !== "NORMAL";
  return (
    <li>
      <div className="flex items-start gap-3 px-4 py-4 lg:grid lg:grid-cols-[minmax(0,1.5fr)_1fr_1.3fr_1fr_1fr_8.5rem_3rem] lg:items-center lg:gap-4 lg:px-5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-start gap-2 text-left lg:items-center"
        >
          {open ? (
            <ChevronDown className="mt-1 size-5 shrink-0 text-brand lg:mt-0" />
          ) : (
            <ChevronRight className="mt-1 size-5 shrink-0 text-ink-4 lg:mt-0" />
          )}
          <span className="min-w-0">
            <span className="block truncate text-[1.05rem] font-bold text-ink">{item.name}</span>
            <span className="mt-0.5 block text-sm text-ink-3 lg:hidden">
              기준 {fmtQty(item.low_stock_threshold)}
              {item.unit}
              {item.nearest_expiry_date
                ? ` · 기한 ${expiryLabel(item.nearest_expiry_date, today)}`
                : ""}
            </span>
          </span>
        </button>
        <div className="flex shrink-0 flex-col items-end gap-1.5 lg:contents">
          <span
            className={cn(
              "tabular text-lg font-bold lg:text-base lg:font-semibold",
              warn ? "text-danger lg:text-ink" : "text-ink",
            )}
          >
            {fmtQty(item.total_quantity)} {item.unit}
          </span>
          <span className="hidden text-ink-2 lg:block">
            {expiryLabel(item.nearest_expiry_date, today)}
          </span>
          <span className="hidden text-ink-2 lg:block">
            {fmtQty(item.low_stock_threshold)} {item.unit}
          </span>
          <span className="hidden text-ink-2 lg:block">
            {item.safety_stock != null ? `${fmtQty(item.safety_stock)} ${item.unit}` : "—"}
          </span>
          <span>
            <AlertBadge status={status} />
          </span>
        </div>
        <button
          type="button"
          onClick={onDelete}
          aria-label="삭제"
          className="flex size-10 shrink-0 items-center justify-center rounded-lg text-ink-4 hover:bg-danger-soft hover:text-danger lg:justify-self-end"
        >
          <Trash2 className="size-5" />
        </button>
      </div>
      {open && (
        <div className="border-t border-line-soft bg-subtle px-4 py-4 lg:px-5">
          <LotPanel item={item} />
        </div>
      )}
    </li>
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
      {item.needs_check && (
        <p className="rounded-xl bg-danger-soft px-4 py-3 text-[0.95rem] font-medium text-danger">
          기록상 재고 없이 판매가 차감됐습니다. 입고를 등록하거나 실사 조정으로 수량을 맞추세요.
        </p>
      )}
      <AddLotForm itemId={item.item_id} unit={item.unit} onDone={refresh} />
      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[560px] text-left text-[0.95rem]">
          <thead className="bg-subtle text-sm text-ink-3">
            <tr>
              <th className="px-4 py-2.5 font-semibold">입고일</th>
              <th className="px-4 py-2.5 font-semibold">소비기한</th>
              <th className="px-4 py-2.5 font-semibold">입고 수량</th>
              <th className="px-4 py-2.5 font-semibold">잔여 수량</th>
              <th className="px-4 py-2.5 font-semibold">구매 금액</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-center text-ink-3">
                  불러오는 중…
                </td>
              </tr>
            ) : lots.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-center text-ink-3">
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
                      a?.lotId === lot.lot_id && a.kind === kind
                        ? null
                        : { lotId: lot.lot_id, kind },
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
      className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-white p-4"
    >
      <label className="space-y-1 text-sm font-semibold text-ink-2">
        입고 수량 ({unit})
        <input
          type="number"
          step="any"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className={`${inputClass} block w-28`}
        />
      </label>
      <label className="space-y-1 text-sm font-semibold text-ink-2">
        입고일
        <input
          type="date"
          value={receivedAt}
          onChange={(e) => setReceivedAt(e.target.value)}
          className={`${inputClass} block`}
        />
      </label>
      <label className="space-y-1 text-sm font-semibold text-ink-2">
        소비기한 (선택)
        <input
          type="date"
          value={expiry}
          onChange={(e) => setExpiry(e.target.value)}
          className={`${inputClass} block`}
        />
      </label>
      <label className="space-y-1 text-sm font-semibold text-ink-2">
        구매 금액 (원)
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className={`${inputClass} block w-32`}
        />
      </label>
      <Button type="submit" disabled={!valid || mutation.isPending} size="lg">
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
      <tr className="border-t border-line-soft">
        <td className="px-4 py-3">{lot.received_at}</td>
        <td className="px-4 py-3">{lot.expiry_date ?? "—"}</td>
        <td className="px-4 py-3">
          {fmtQty(lot.quantity)} {unit}
        </td>
        <td className="px-4 py-3 font-medium">
          {fmtQty(lot.remaining_quantity)} {unit}
        </td>
        <td className="px-4 py-3">{lot.purchase_price.toLocaleString("ko-KR")}원</td>
        <td className="px-4 py-3 text-right">
          <button
            type="button"
            onClick={() => onAction("edit")}
            className="mr-1 rounded-lg px-3 py-2 text-sm font-semibold text-brand hover:bg-brand-soft"
          >
            수정
          </button>
          <button
            type="button"
            onClick={() => onAction("dispose")}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-danger hover:bg-danger-soft"
          >
            폐기
          </button>
        </td>
      </tr>
      {action === "edit" && (
        <tr>
          <td colSpan={6} className="px-4 pb-4">
            <EditLotForm lot={lot} unit={unit} onDone={onDone} />
          </td>
        </tr>
      )}
      {action === "dispose" && (
        <tr>
          <td colSpan={6} className="px-4 pb-4">
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
      className="flex flex-wrap items-end gap-3 rounded-xl bg-subtle p-4"
    >
      <label className="space-y-1 text-sm font-semibold text-ink-2">
        잔여 수량 ({unit})
        <input
          type="number"
          step="any"
          value={remaining}
          onChange={(e) => setRemaining(e.target.value)}
          className={`${inputClass} block w-28`}
        />
      </label>
      <label className="space-y-1 text-sm font-semibold text-ink-2">
        소비기한
        <input
          type="date"
          value={expiry}
          onChange={(e) => setExpiry(e.target.value)}
          className={`${inputClass} block`}
        />
      </label>
      <label className="space-y-1 text-sm font-semibold text-ink-2">
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
      <label className="space-y-1 text-sm font-semibold text-ink-2">
        메모 (선택)
        <input
          value={memo}
          maxLength={255}
          onChange={(e) => setMemo(e.target.value)}
          className={`${inputClass} block w-48`}
        />
      </label>
      <Button type="submit" disabled={!valid || mutation.isPending} size="lg">
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
      className="flex flex-wrap items-end gap-3 rounded-xl bg-subtle p-4"
    >
      <label className="space-y-1 text-sm font-semibold text-ink-2">
        폐기 수량 ({unit}, 최대 {fmtQty(lot.remaining_quantity)})
        <input
          type="number"
          step="any"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className={`${inputClass} block w-28`}
        />
      </label>
      <label className="space-y-1 text-sm font-semibold text-ink-2">
        폐기 사유 (선택)
        <input
          value={reason}
          maxLength={255}
          placeholder="소비기한 만료"
          onChange={(e) => setReason(e.target.value)}
          className={`${inputClass} block w-48`}
        />
      </label>
      <Button type="submit" disabled={!valid || mutation.isPending} variant="destructive" size="lg">
        폐기
      </Button>
    </form>
  );
}
