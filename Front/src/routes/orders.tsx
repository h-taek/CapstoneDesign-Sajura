// 발주추천 화면 — Figma "발주추천"(node 9:989) 셸 적용.
// 재고 임계값 기반(GET /api/inventory/reorder-suggestions) 추천과, AI 서버(GET /api/orders/recommend
// — 수요예측 × 메뉴 비중 분해 × 레시피(BOM) × 재고/리드타임/안전재고) 기반 추천을 함께 제공.
// 두 표 모두 체크박스 선택 + 수량 인라인 수정 후 POST /api/orders/approve로 확정한다. AI 추천은
// recommendation_id를 실어 수정 이력이 남고, 임계값 추천은 추천안 없는 발주(null)로 기록된다.
// 쿠팡 자동 담기·실제 입고 반영은 후속 작업 — 확정 = 기록만, 재고 수량은 자동 변경되지 않음.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HTTPError } from "ky";
import { AlertTriangle, CheckCircle2, ChevronDown, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { type ReorderSuggestion, getReorderSuggestions } from "../api/endpoints/inventory";
import {
  type OrderApproveRequest,
  type OrderStatus,
  type OrderSummary,
  approveOrder,
  getAIRecommend,
  getOrder,
  listOrders,
} from "../api/endpoints/orders";
import { DashboardShell } from "../components/dashboard/shell";
import { Button } from "../components/ui/button";

// 로딩 중 기본값이 렌더마다 새 배열이 되면 선택 상태 초기화 effect가 반복된다
const NO_SUGGESTIONS: ReorderSuggestion[] = [];

const STATUS_LABEL: Record<OrderStatus, string> = {
  APPROVED: "확정",
  AUTOMATED: "자동 담기 완료",
  MANUAL_REQUIRED: "수동 처리 필요",
};

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

  // DB가 소수 셋째 자리까지 받는다 (08_schema.md §3.20 DECIMAL(10,3))
  const items = rows
    .filter((r) => selected.has(r.item_id))
    .map((r) => ({
      item_id: r.item_id,
      final_quantity: Math.round(Number(quantities[r.item_id]) * 1000) / 1000,
    }))
    .filter((i) => Number.isFinite(i.final_quantity) && i.final_quantity > 0);

  return { selected, quantities, toggle, setQuantity, items };
}

function useApprove() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: OrderApproveRequest) => approveOrder(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

function SelectCell({
  name,
  checked,
  onToggle,
}: { name: string; checked: boolean; onToggle: () => void }) {
  return (
    <td className="px-4 py-3">
      <input
        type="checkbox"
        aria-label={`${name} 선택`}
        checked={checked}
        onChange={onToggle}
        className="size-4 accent-[#7a5eff]"
      />
    </td>
  );
}

function QuantityCell({
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
  return (
    <td className="px-4 py-3">
      <div className="flex items-center gap-2">
        <input
          type="number"
          step="any"
          min={0}
          aria-label={`${name} 발주 수량`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-9 w-24 rounded-lg border border-[#d1d5dc] px-2 text-sm disabled:bg-[#f3f4f6] disabled:text-[#99a1af]"
        />
        <span className="text-[#99a1af]">{unit}</span>
      </div>
    </td>
  );
}

function ApprovedNotice() {
  return (
    <p className="flex items-center gap-1.5 text-sm text-emerald-600">
      <CheckCircle2 className="size-4" /> 발주가 확정되었습니다. 실제 주문·입고 처리는 직접
      진행해주세요.
    </p>
  );
}

function OrderHistoryRow({ order }: { order: OrderSummary }) {
  const [open, setOpen] = useState(false);
  const { data: detail, isLoading } = useQuery({
    queryKey: ["orders", order.order_id],
    queryFn: () => getOrder(order.order_id),
    enabled: open,
  });

  return (
    <div className="rounded-xl border border-[#d1d5dc] bg-white text-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <span className="text-[#364153]">
          {new Date(order.approved_at).toLocaleString("ko-KR")} · 품목 {order.item_count}개
        </span>
        <span className="flex items-center gap-2 text-xs text-[#99a1af]">
          {STATUS_LABEL[order.status]}
          <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && (
        <div className="border-t border-[#eef1f4] px-4 py-3 text-[#364153]">
          {isLoading || !detail ? (
            <p className="text-[#99a1af]">불러오는 중…</p>
          ) : (
            <>
              <p>
                {detail.items.map((i) => `${i.item_name} ${i.final_quantity}${i.unit}`).join(", ")}
              </p>
              {detail.note && <p className="mt-1 text-xs text-[#99a1af]">메모: {detail.note}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  const { data: suggestions = NO_SUGGESTIONS, isLoading } = useQuery({
    queryKey: ["reorder-suggestions"],
    queryFn: getReorderSuggestions,
  });
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

  const thresholdRows = useMemo(
    () =>
      suggestions.map((s) => ({
        item_id: s.item_id,
        defaultQuantity: s.suggested_order_quantity,
        preselect: true,
      })),
    [suggestions],
  );
  const aiRows = useMemo(
    () =>
      (aiRecommend?.recommendations ?? []).map((r) => ({
        item_id: r.item_id,
        defaultQuantity: r.recommended_quantity,
        preselect: r.recommended_quantity > 0,
      })),
    [aiRecommend],
  );
  const threshold = useOrderSelection(thresholdRows);
  const ai = useOrderSelection(aiRows);
  const thresholdApprove = useApprove();
  const aiApprove = useApprove();

  const handleThresholdApprove = () => {
    if (threshold.items.length === 0) return;
    thresholdApprove.mutate({ recommendation_id: null, items: threshold.items });
  };
  const handleAiApprove = () => {
    if (!aiRecommend || ai.items.length === 0) return;
    aiApprove.mutate({ recommendation_id: aiRecommend.recommendation_id, items: ai.items });
  };

  return (
    <DashboardShell active="orders">
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-[#101828]">발주 추천</h1>
          <p className="text-sm text-[#99a1af]">
            재고관리에 등록한 임계값 기준 추천과, 아래 AI 수요예측 기반 추천을 함께 제공합니다.
          </p>
        </header>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#364153]">재주문이 필요한 재료</h2>
            {suggestions.length > 0 && (
              <Button
                onClick={handleThresholdApprove}
                disabled={threshold.items.length === 0 || thresholdApprove.isPending}
                className="h-10 rounded-full bg-[#7a5eff] px-5 text-sm font-semibold hover:bg-[#6a4eef]"
              >
                {thresholdApprove.isPending
                  ? "확정 중…"
                  : `임계값 추천 발주 확정 (${threshold.items.length})`}
              </Button>
            )}
          </div>
          {isLoading ? (
            <p className="text-sm text-[#99a1af]">불러오는 중…</p>
          ) : suggestions.length === 0 ? (
            <div className="flex h-[120px] items-center justify-center rounded-xl border border-dashed border-[#d1d5dc] bg-white text-sm text-[#99a1af]">
              현재 재주문이 필요한 재료가 없습니다.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[#d1d5dc] bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#fafafa] text-[#61646b]">
                  <tr>
                    <th className="w-10 px-4 py-3" />
                    <th className="px-4 py-3 font-medium">재료</th>
                    <th className="px-4 py-3 font-medium">현재 수량</th>
                    <th className="px-4 py-3 font-medium">임계값</th>
                    <th className="px-4 py-3 font-medium">발주 수량</th>
                  </tr>
                </thead>
                <tbody>
                  {suggestions.map((s) => (
                    <tr key={s.item_id} className="border-t border-[#eef1f4]">
                      <SelectCell
                        name={s.name}
                        checked={threshold.selected.has(s.item_id)}
                        onToggle={() => threshold.toggle(s.item_id)}
                      />
                      <td className="px-4 py-3 font-medium text-[#364153]">
                        <span className="flex items-center gap-2">
                          <AlertTriangle className="size-4 text-red-500" />
                          {s.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#364153]">
                        {s.current_quantity} {s.unit}
                      </td>
                      <td className="px-4 py-3 text-[#364153]">
                        {s.low_stock_threshold} {s.unit}
                      </td>
                      <QuantityCell
                        name={s.name}
                        unit={s.unit}
                        value={threshold.quantities[s.item_id] ?? ""}
                        disabled={!threshold.selected.has(s.item_id)}
                        onChange={(v) => threshold.setQuantity(s.item_id, v)}
                      />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {thresholdApprove.isSuccess && <ApprovedNotice />}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-[#364153]">AI 예측 발주</h2>
              {aiRecommend?.is_low_confidence && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">
                  신뢰도 낮음
                </span>
              )}
            </div>
            {aiRecommend && aiRecommend.recommendations.length > 0 && (
              <Button
                onClick={handleAiApprove}
                disabled={ai.items.length === 0 || aiApprove.isPending}
                className="h-10 rounded-full bg-[#7a5eff] px-5 text-sm font-semibold hover:bg-[#6a4eef]"
              >
                {aiApprove.isPending ? "확정 중…" : `AI 추천 발주 확정 (${ai.items.length})`}
              </Button>
            )}
          </div>
          <p className="text-sm text-[#99a1af]">
            매출 예측 × 메뉴별 판매 비중 × 레시피(재료 구성) × 재고/리드타임/안전재고를 반영한
            참고치입니다. 위 표와 별개로 재고 임계값이 아직 안 걸려도 미리 보여줄 수 있습니다.
          </p>
          {aiLoading ? (
            <p className="text-sm text-[#99a1af]">계산 중…</p>
          ) : aiError ? (
            <div className="flex items-start gap-2 rounded-xl border border-dashed border-[#d1d5dc] bg-white p-6">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
              <p className="text-sm text-[#99a1af]">{aiErrorMessage(aiError)}</p>
            </div>
          ) : aiRecommend && aiRecommend.recommendations.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-[#d1d5dc] bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#fafafa] text-[#61646b]">
                  <tr>
                    <th className="w-10 px-4 py-3" />
                    <th className="px-4 py-3 font-medium">재료</th>
                    <th className="px-4 py-3 font-medium">추천 수량</th>
                    <th className="px-4 py-3 font-medium">발주 수량</th>
                    <th className="px-4 py-3 font-medium">예상 소진일</th>
                    <th className="px-4 py-3 font-medium">근거</th>
                  </tr>
                </thead>
                <tbody>
                  {aiRecommend.recommendations.map((r) => (
                    <tr key={r.item_id} className="border-t border-[#eef1f4]">
                      <SelectCell
                        name={r.item_name}
                        checked={ai.selected.has(r.item_id)}
                        onToggle={() => ai.toggle(r.item_id)}
                      />
                      <td className="px-4 py-3 font-medium text-[#364153]">
                        <span className="flex items-center gap-2">
                          <Sparkles className="size-4 text-[#7a5eff]" />
                          {r.item_name}
                          {r.config_status === "DEFAULT_USED" && (
                            <span
                              title="리드타임·안전재고 미설정 — 기본값(리드타임 1일, 안전재고 0)으로 계산"
                              className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-xs font-normal text-[#61646b]"
                            >
                              설정 필요
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#7a5eff]">
                        {r.recommended_quantity} {r.unit}
                      </td>
                      <QuantityCell
                        name={r.item_name}
                        unit={r.unit}
                        value={ai.quantities[r.item_id] ?? ""}
                        disabled={!ai.selected.has(r.item_id)}
                        onChange={(v) => ai.setQuantity(r.item_id, v)}
                      />
                      <td className="px-4 py-3 text-[#364153]">
                        {r.expected_stockout_date ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#99a1af]">
                        {r.recommendation_reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex h-[100px] items-center justify-center rounded-xl border border-dashed border-[#d1d5dc] bg-white text-sm text-[#99a1af]">
              AI 추천 결과가 없습니다 (레시피·재고 설정을 확인해주세요).
            </div>
          )}
          {aiApprove.isSuccess && <ApprovedNotice />}
        </section>

        {pastOrders.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-[#364153]">발주 확정 이력</h2>
            <div className="space-y-2">
              {pastOrders.map((order) => (
                <OrderHistoryRow key={order.order_id} order={order} />
              ))}
            </div>
          </section>
        )}
      </div>
    </DashboardShell>
  );
}
