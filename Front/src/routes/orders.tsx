// 발주추천 화면 — 리디자인 v2.
// AI 서버(GET /api/orders/recommend — 수요예측 × 메뉴 비중 분해 × 레시피(BOM) × 재고/리드타임/안전재고)
// 추천을 줄 단위 선택 + 수량 스테퍼로 고친다. 예측이 없으면(이력 부족·AI 서버 장애) 대체 추천 없이 사유만 안내한다.
// 확정은 쿠팡 담기(POST /api/orders/automate/*)로 붙인다 — 08_coupang_cart.md §4·§5.
import { useQuery } from "@tanstack/react-query";
import { HTTPError } from "ky";
import { AlertTriangle, Check, ChevronDown, Minus, Plus, Sparkles } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  type OrderDetailItem,
  type OrderSummary,
  getAIRecommend,
  getOrder,
  listOrders,
} from "../api/endpoints/orders";
import { DashboardShell } from "../components/dashboard/shell";
import { Card, EmptyState, PageHeader, SectionTitle } from "../components/ui/card";
import { formatQty, formatWon } from "../lib/format";
import { cn } from "../lib/utils";

/** 단가 × 수량. 단가 미설정이면 null (01_basic_design.md §3.3.1) */
function estimate(unitPrice: number | null, quantity: string): number | null {
  const q = Number(quantity);
  return unitPrice == null || !Number.isFinite(q) ? null : Math.round(unitPrice * q);
}

function aiErrorMessage(error: unknown): string {
  if (error instanceof HTTPError && error.response.status === 422) {
    return "AI 추천에 필요한 판매 이력이 부족합니다 (최소 10일 이상 필요).";
  }
  return "AI 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.";
}

interface SelectableRow {
  item_id: string;
  defaultQuantity: number;
  preselect: boolean;
}

// 표 하나의 선택·수량 편집 상태. rows는 호출부에서 useMemo로 고정한다.
function useOrderSelection(rows: SelectableRow[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  useEffect(() => {
    setSelected(new Set(rows.filter((r) => r.preselect).map((r) => r.item_id)));
    setQuantities(Object.fromEntries(rows.map((r) => [r.item_id, String(r.defaultQuantity)])));
  }, [rows]);

  const toggle = (itemId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const setQuantity = (itemId: string, value: string) =>
    setQuantities((prev) => ({ ...prev, [itemId]: value }));

  // DB가 소수 셋째 자리까지 받는다 (02_implementation_design.md §4.3.19 DECIMAL(10,3))
  const items = rows
    .filter((r) => selected.has(r.item_id))
    .map((r) => ({
      item_id: r.item_id,
      final_quantity: Math.round(Number(quantities[r.item_id]) * 1000) / 1000,
    }))
    .filter((i) => Number.isFinite(i.final_quantity) && i.final_quantity > 0);

  return { selected, quantities, toggle, setQuantity, items };
}

/** 발주 품목 한 줄 — 웹은 표처럼 가로, 앱은 큰 카드. 줄 전체를 눌러 선택할 수 있다. */
function OrderItemRow({
  name,
  unit,
  checked,
  onToggle,
  value,
  onChange,
  badges,
  facts,
  unitPrice,
  reason,
}: {
  name: string;
  unit: string;
  checked: boolean;
  onToggle: () => void;
  value: string;
  onChange: (value: string) => void;
  badges?: ReactNode;
  facts: ReactNode;
  unitPrice: number | null;
  reason?: ReactNode;
}) {
  const amount = estimate(unitPrice, value);
  return (
    <li
      className={cn(
        "flex flex-col gap-3 p-4 transition-colors lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-6 lg:px-5",
        checked ? "bg-white" : "bg-subtle/60",
      )}
    >
      <label className="flex min-w-0 cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          aria-label={`${name} 선택`}
          checked={checked}
          onChange={onToggle}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className={cn(
            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border-2 transition-colors peer-focus-visible:ring-4 peer-focus-visible:ring-brand-tint",
            checked ? "border-brand bg-brand text-white" : "border-ink-4 bg-white text-transparent",
          )}
        >
          <Check className="size-5" strokeWidth={3} />
        </span>
        <span className="min-w-0 space-y-1">
          <span className="flex flex-wrap items-center gap-2 text-[1.05rem] font-bold text-ink">
            {name}
            {badges}
          </span>
          <span className="block text-[0.95rem] text-ink-2">{facts}</span>
          <span className="block text-sm text-ink-3">
            {unitPrice == null
              ? "단가 미설정"
              : `단가 ${formatQty(unitPrice)}원/${unit} · 예상 ${formatWon(amount ?? 0)}`}
          </span>
          {reason ? <span className="block text-sm text-ink-3">{reason}</span> : null}
        </span>
      </label>
      <QuantityStepper
        name={name}
        unit={unit}
        value={value}
        disabled={!checked}
        onChange={onChange}
      />
    </li>
  );
}

function QuantityStepper({
  name,
  unit,
  value,
  disabled,
  onChange,
}: {
  name: string;
  unit: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const n = Number(value) || 0;
  const step = (delta: number) =>
    onChange(String(Math.max(0, Math.round((n + delta) * 1000) / 1000)));
  const btn =
    "flex size-12 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-ink-2 hover:bg-subtle disabled:opacity-40 lg:size-10";
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={btn}
        disabled={disabled || n <= 0}
        onClick={() => step(-1)}
        aria-label={`${name} 수량 줄이기`}
      >
        <Minus className="size-5" />
      </button>
      <div className="relative min-w-0 flex-1 lg:flex-none">
        <input
          type="number"
          step="any"
          min={0}
          inputMode="decimal"
          aria-label={`${name} 발주 수량`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="tabular h-12 w-full rounded-xl border border-line pr-10 pl-3 text-right text-lg font-bold text-ink focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none disabled:bg-subtle disabled:text-ink-4 lg:h-10 lg:w-32 lg:text-base"
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-ink-3">
          {unit}
        </span>
      </div>
      <button
        type="button"
        className={btn}
        disabled={disabled}
        onClick={() => step(1)}
        aria-label={`${name} 수량 늘리기`}
      >
        <Plus className="size-5" />
      </button>
    </div>
  );
}

const RECEIPT_LABEL: Record<string, string> = {
  PENDING: "입고 대기",
  RECEIVED: "입고 완료",
  SKIPPED: "입고 안 함",
};

/** "입고 대기 2개 · 입고 완료 1개" */
function receiptSummary(items: OrderDetailItem[]): string {
  return Object.entries(RECEIPT_LABEL)
    .map(
      ([status, label]) =>
        [label, items.filter((i) => i.receipt_status === status).length] as const,
    )
    .filter(([, n]) => n > 0)
    .map(([label, n]) => `${label} ${n}개`)
    .join(" · ");
}

function OrderHistoryRow({ order }: { order: OrderSummary }) {
  const [open, setOpen] = useState(false);
  const { data: detail, isLoading } = useQuery({
    queryKey: ["orders", order.order_id],
    queryFn: () => getOrder(order.order_id),
    enabled: open,
  });

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-subtle"
      >
        <span className="min-w-0">
          <span className="block text-base font-semibold text-ink">
            {new Date(order.approved_at).toLocaleDateString("ko-KR", {
              month: "long",
              day: "numeric",
              weekday: "short",
            })}{" "}
            · 품목 {order.item_count}개
          </span>
          <span className="block text-sm text-ink-3">
            {new Date(order.approved_at).toLocaleTimeString("ko-KR", {
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            확정
            {order.total_estimated_cost > 0 && ` · 예상 ${formatWon(order.total_estimated_cost)}`}
          </span>
        </span>
        <ChevronDown
          className={cn("size-5 shrink-0 text-ink-3 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="border-t border-line-soft bg-subtle px-5 py-4 text-[0.95rem] text-ink-2">
          {isLoading || !detail ? (
            <p className="text-ink-3">불러오는 중…</p>
          ) : (
            <>
              <p>
                {detail.items
                  .map(
                    (i) =>
                      `${i.item_name} ${formatQty(i.final_quantity)}${i.unit}${
                        i.subtotal == null ? "" : ` ${formatWon(i.subtotal)}`
                      }`,
                  )
                  .join(" · ")}
              </p>
              <p className="mt-1 text-sm text-ink-3">{receiptSummary(detail.items)}</p>
              {detail.note && <p className="mt-1 text-sm text-ink-3">메모: {detail.note}</p>}
            </>
          )}
        </div>
      )}
    </li>
  );
}

export default function OrdersPage() {
  const { data: orderPage } = useQuery({
    queryKey: ["orders"],
    queryFn: () => listOrders(),
  });
  const pastOrders = orderPage?.items ?? [];
  const {
    data: aiRecommend,
    isLoading: aiLoading,
    error: aiError,
  } = useQuery({
    queryKey: ["ai-orders-recommend"],
    queryFn: getAIRecommend,
    staleTime: 60_000,
    retry: false,
  });

  const aiRows = useMemo(
    () =>
      (aiRecommend?.recommendations ?? []).map((r) => ({
        item_id: r.item_id,
        defaultQuantity: r.recommended_quantity,
        preselect: r.recommended_quantity > 0,
      })),
    [aiRecommend],
  );
  const ai = useOrderSelection(aiRows);

  const lowConfidenceBadge = aiRecommend?.is_low_confidence ? (
    <span className="rounded-full bg-warn-soft px-2.5 py-0.5 text-sm font-semibold text-warn">
      신뢰도 낮음
    </span>
  ) : null;

  return (
    <DashboardShell active="orders">
      <div className="space-y-6 lg:space-y-8">
        <PageHeader
          title="발주 추천"
          description="AI가 계산한 추천량을 확인하고, 필요한 것만 골라 수량을 고치세요."
        />

        <section className="space-y-3">
          <SectionTitle
            title="AI 예측 발주"
            badge={lowConfidenceBadge}
            description="앞으로 팔릴 양 × 레시피 × 현재 재고·입고 기간을 계산한 추천량이에요."
          />
          {aiLoading ? (
            <EmptyState>계산 중…</EmptyState>
          ) : aiError ? (
            <EmptyState>
              <AlertTriangle className="size-6 text-warn" />
              {aiErrorMessage(aiError)}
            </EmptyState>
          ) : aiRecommend && aiRecommend.recommendations.length > 0 ? (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-line-soft">
                {aiRecommend.recommendations.map((r) => (
                  <OrderItemRow
                    key={r.item_id}
                    name={r.item_name}
                    unit={r.unit}
                    checked={ai.selected.has(r.item_id)}
                    onToggle={() => ai.toggle(r.item_id)}
                    value={ai.quantities[r.item_id] ?? ""}
                    onChange={(v) => ai.setQuantity(r.item_id, v)}
                    badges={
                      <>
                        <Sparkles className="size-4 text-brand" aria-hidden />
                        {r.config_status === "DEFAULT_USED" && (
                          <span
                            title="리드타임·안전재고 미설정 — 기본값(리드타임 1일, 안전재고 0)으로 계산"
                            className="rounded-full bg-subtle px-2 py-0.5 text-sm font-medium text-ink-3"
                          >
                            설정 필요
                          </span>
                        )}
                      </>
                    }
                    facts={
                      <>
                        추천{" "}
                        <strong className="font-bold text-brand">
                          {formatQty(r.recommended_quantity)}
                          {r.unit}
                        </strong>
                        {r.expected_stockout_date ? (
                          <> · {r.expected_stockout_date} 소진 예상</>
                        ) : null}
                      </>
                    }
                    unitPrice={r.unit_price}
                    reason={r.recommendation_reason}
                  />
                ))}
              </ul>
            </Card>
          ) : (
            <EmptyState>AI 추천 결과가 없습니다 (레시피·재고 설정을 확인해주세요).</EmptyState>
          )}
        </section>

        {pastOrders.length > 0 && (
          <section className="space-y-3">
            <SectionTitle title="발주 확정 이력" />
            <Card className="overflow-hidden">
              <ul className="divide-y divide-line-soft">
                {pastOrders.map((order) => (
                  <OrderHistoryRow key={order.order_id} order={order} />
                ))}
              </ul>
            </Card>
          </section>
        )}
      </div>
    </DashboardShell>
  );
}
