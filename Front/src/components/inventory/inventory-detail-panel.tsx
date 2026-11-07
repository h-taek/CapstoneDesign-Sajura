// 재고 상세 판 — 입고 대기, 로트 목록/등록/수정/폐기, 쿠팡 상품 및 30일 단가 추세, 재료 설정, 재료 삭제 (04_fe.md §4.6, 09_inventory.html).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  type AdjustmentReason,
  type InventoryItem,
  type Lot,
  type PendingOrderItem,
  addLot,
  disposeLot,
  getPriceTrends,
  listLots,
  updateInventoryItem,
  updateLot,
} from "../../api/endpoints/inventory";
import { receiveOrderItem, skipOrderItem } from "../../api/endpoints/orders";
import { formatMonthDay } from "../../lib/format";
import { calculatePriceChange } from "../../lib/price-trend";
import { FollowPanel } from "../shell/follow-panel";
import { daysUntil } from "./stock-status";

const REASON_LABEL: Record<AdjustmentReason, string> = {
  STOCKTAKE: "실사 조정",
  EXPIRY_CORRECTION: "소비기한 정정",
  OTHER: "기타",
};

function fmtQty(v: number | string): string {
  return Number(v).toLocaleString("ko-KR", { maximumFractionDigits: 3 });
}

function todayIso(): string {
  return new Date().toLocaleDateString("sv-SE");
}

export interface InventoryDetailPanelProps {
  item: InventoryItem;
  onClose: () => void;
  onDelete: () => void;
  isItemExpiredOrUrgent?: boolean;
}

export function InventoryDetailPanel({
  item,
  onClose,
  onDelete,
  isItemExpiredOrUrgent = false,
}: InventoryDetailPanelProps) {
  const queryClient = useQueryClient();
  const [showAddLot, setShowAddLot] = useState(false);
  const [editLotId, setEditLotId] = useState<string | null>(null);
  const [disposeLotId, setDisposeLotId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // 로트 및 입고 대기 목록 조회
  const { data: lotData } = useQuery({
    queryKey: ["inventory", item.item_id, "lots"],
    queryFn: () => listLots(item.item_id),
  });
  const lots = lotData?.lots ?? [];
  const pendingOrders = lotData?.pending_orders ?? [];

  // 쿠팡 상품 30일 단가 추세 조회
  const { data: priceTrendsData } = useQuery({
    queryKey: ["inventory-price-trends", 30],
    queryFn: () => getPriceTrends(30),
    staleTime: 60_000,
  });

  const currentTrendItem = priceTrendsData?.items.find((it) => it.item_id === item.item_id);
  const trendPoints = currentTrendItem?.points ?? [];
  const priceChange = calculatePriceChange(trendPoints);

  const refreshLots = () => {
    queryClient.invalidateQueries({ queryKey: ["inventory"] });
    queryClient.invalidateQueries({ queryKey: ["inventory", item.item_id, "lots"] });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
  };

  // 재료 설정 수정 (임계값, 안전재고, 리드타임)
  const [threshold, setThreshold] = useState(String(item.low_stock_threshold));
  const [safety, setSafety] = useState(item.safety_stock != null ? String(item.safety_stock) : "");
  const [leadTime, setLeadTime] = useState(
    item.lead_time_days != null ? String(item.lead_time_days) : "",
  );

  const updateItemMutation = useMutation({
    mutationFn: () =>
      updateInventoryItem(item.item_id, {
        low_stock_threshold: threshold === "" ? 0 : Number(threshold),
        safety_stock: safety === "" ? null : Number(safety),
        lead_time_days: leadTime === "" ? null : Number(leadTime),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      window.alert("재료 설정이 저장되었습니다.");
    },
    onError: () => window.alert("재료 설정 저장에 실패했습니다."),
  });

  // 로트 추가
  const [addQty, setAddQty] = useState("");
  const [addPrice, setAddPrice] = useState("");
  const [addReceivedAt, setAddReceivedAt] = useState(todayIso());
  const [addExpiry, setAddExpiry] = useState("");

  const addLotMutation = useMutation({
    mutationFn: () =>
      addLot(item.item_id, {
        quantity: Number(addQty),
        purchase_price: Number(addPrice),
        received_at: addReceivedAt,
        expiry_date: addExpiry || null,
      }),
    onSuccess: () => {
      setShowAddLot(false);
      setAddQty("");
      setAddPrice("");
      setAddExpiry("");
      refreshLots();
    },
    onError: () => window.alert("입고 등록에 실패했습니다."),
  });

  // 소비기한 표시
  const nearestExpiry = item.nearest_expiry_date;
  let expiryDisplay = "—";
  if (nearestExpiry) {
    const diffDays = daysUntil(nearestExpiry, new Date());
    expiryDisplay =
      diffDays < 0 ? `${-diffDays}일 지남` : diffDays === 0 ? "D-Day" : `D-${diffDays}`;
  }

  return (
    <FollowPanel
      title={item.name}
      onClose={onClose}
      aria-label={`${item.name} 상세`}
      className="lg:col-span-2"
      fit
    >
      {/* 상단 요약 DL */}
      <dl className="mt-3 grid grid-cols-3 gap-2 rounded-xl glass-card p-3">
        <div>
          <dt className="text-xs text-ink-2">총 수량</dt>
          <dd
            className={`tabular mt-1 text-lg leading-none font-bold ${
              item.needs_check || item.total_quantity <= item.low_stock_threshold
                ? "text-danger"
                : "text-ink"
            }`}
          >
            {fmtQty(item.total_quantity)} {item.unit}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-2">소비기한</dt>
          <dd
            className={`tabular mt-1 text-lg leading-none font-bold ${
              isItemExpiredOrUrgent ? "text-danger" : "text-ink"
            }`}
          >
            {expiryDisplay}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-2">재주문 임계값</dt>
          <dd className="tabular mt-1 text-lg leading-none font-bold text-ink">
            {fmtQty(item.low_stock_threshold)} {item.unit}
          </dd>
        </div>
      </dl>

      {/* needs_check 경고문구 */}
      {item.needs_check && (
        <p className="mt-3 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">
          기록상 재고 없이 판매가 차감됐어요. 입고를 등록하거나 로트 수정으로 수량을 맞추세요.
        </p>
      )}

      {/* 입고 대기 카드 목록 */}
      {pendingOrders.length > 0 && (
        <section className="mt-6">
          <h3 className="text-sm font-bold text-ink">입고 대기</h3>
          {pendingOrders.map((pending) => (
            <PendingOrderCard
              key={pending.order_item_id}
              pending={pending}
              unit={item.unit}
              onDone={refreshLots}
            />
          ))}
        </section>
      )}

      {/* 로트 목록 및 입고 등록 */}
      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink">
            로트<span className="ml-1 font-normal text-ink-2">{lots.length}</span>
          </h3>
          <button
            type="button"
            onClick={() => setShowAddLot((v) => !v)}
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-strong"
          >
            <Plus className="size-4" />
            입고 등록
          </button>
        </div>

        {/* 입고 등록 폼 */}
        {showAddLot && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (Number(addQty) > 0 && addPrice !== "" && addReceivedAt) {
                addLotMutation.mutate();
              }
            }}
            className="mt-2 rounded-xl glass-card p-3.5"
          >
            <div className="grid grid-cols-2 gap-2.5">
              <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
                입고 수량 ({item.unit})
                <input
                  type="number"
                  step="any"
                  value={addQty}
                  onChange={(e) => setAddQty(e.target.value)}
                  className="h-10 w-full rounded-lg border border-white/80 bg-transparent px-3 text-[0.95rem] font-normal text-ink focus:border-brand focus:outline-none"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
                구매 금액 (원)
                <input
                  type="number"
                  value={addPrice}
                  onChange={(e) => setAddPrice(e.target.value)}
                  className="h-10 w-full rounded-lg border border-white/80 bg-transparent px-3 text-[0.95rem] font-normal text-ink focus:border-brand focus:outline-none"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
                입고일
                <input
                  type="date"
                  value={addReceivedAt}
                  onChange={(e) => setAddReceivedAt(e.target.value)}
                  className="h-10 w-full rounded-lg border border-white/80 bg-transparent px-3 text-[0.95rem] font-normal text-ink focus:border-brand focus:outline-none"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
                소비기한 (선택)
                <input
                  type="date"
                  value={addExpiry}
                  onChange={(e) => setAddExpiry(e.target.value)}
                  className="h-10 w-full rounded-lg border border-white/80 bg-transparent px-3 text-[0.95rem] font-normal text-ink focus:border-brand focus:outline-none"
                />
              </label>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setShowAddLot(false)}
                className="h-10 rounded-lg border border-white/80 px-4 text-sm font-semibold text-ink-2 hover:bg-white/30"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={addLotMutation.isPending}
                className="h-10 flex-1 rounded-lg bg-brand text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-60"
              >
                {addLotMutation.isPending ? "등록 중…" : "등록"}
              </button>
            </div>
          </form>
        )}

        {/* 로트 리스트 */}
        {lots.length === 0 ? (
          <p className="mt-2 rounded-xl glass-card px-3.5 py-4 text-center text-sm text-ink-2">
            등록된 로트가 없어요. 입고를 등록하세요.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-white/70 rounded-xl glass-card px-3.5">
            {lots.map((lot) => {
              const expiryText = lot.expiry_date ? formatMonthDay(lot.expiry_date) : "—";
              const receivedText = `${formatMonthDay(lot.received_at)} 입고`;

              const isEditing = editLotId === lot.lot_id;
              const isDisposing = disposeLotId === lot.lot_id;

              return (
                <li key={lot.lot_id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="tabular text-[0.95rem] font-bold text-ink">
                        {fmtQty(lot.remaining_quantity)} {item.unit}
                        <span className="ml-1 text-sm font-medium text-ink-2">
                          / {fmtQty(lot.quantity)} {item.unit}
                        </span>
                      </p>
                      <p className="tabular mt-0.5 text-xs text-ink-2">
                        {receivedText} · 기한{" "}
                        <span className={lot.expiry_date ? "" : "text-ink-2"}>{expiryText}</span> ·{" "}
                        {lot.purchase_price.toLocaleString("ko-KR")}원
                      </p>
                    </div>
                    <div className="flex shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditLotId((id) => (id === lot.lot_id ? null : lot.lot_id));
                          setDisposeLotId(null);
                        }}
                        className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-brand hover:bg-brand-soft"
                      >
                        수정
                      </button>
                      {lot.remaining_quantity > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setDisposeLotId((id) => (id === lot.lot_id ? null : lot.lot_id));
                            setEditLotId(null);
                          }}
                          className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-danger hover:bg-danger-soft"
                        >
                          폐기
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 로트 수정 폼 */}
                  {isEditing && (
                    <EditLotForm
                      item={item}
                      lot={lot}
                      onClose={() => setEditLotId(null)}
                      onDone={() => {
                        setEditLotId(null);
                        refreshLots();
                      }}
                    />
                  )}

                  {/* 로트 폐기 폼 */}
                  {isDisposing && (
                    <DisposeLotForm
                      item={item}
                      lot={lot}
                      onClose={() => setDisposeLotId(null)}
                      onDone={() => {
                        setDisposeLotId(null);
                        refreshLots();
                      }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 쿠팡 상품 섹션 */}
      <section className="mt-6">
        <h3 className="text-sm font-bold text-ink">쿠팡 상품</h3>
        {item.coupang_product ? (
          <div className="mt-2 rounded-xl glass-card p-3.5">
            <p className="text-sm leading-snug font-semibold text-ink">
              {item.coupang_product.product_name}
            </p>
            <p className="mt-0.5 text-xs text-ink-2">
              {item.coupang_product.option_name ? `${item.coupang_product.option_name} · ` : ""}
              판매가{" "}
              {item.coupang_product.sale_price != null
                ? `${item.coupang_product.sale_price.toLocaleString("ko-KR")}원`
                : "—"}
            </p>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="tabular text-lg leading-none font-bold tracking-tight text-ink">
                {item.unit_price != null ? item.unit_price.toLocaleString("ko-KR") : "단가 미설정"}
                {item.unit_price != null && (
                  <span className="ml-0.5 text-xs font-medium text-ink-2">원/{item.unit}</span>
                )}
              </span>
              {priceChange && priceChange.rate > 0 && (
                <span
                  className={`tabular inline-flex items-center gap-0.5 text-sm font-bold ${
                    priceChange.direction === "up" ? "text-up" : "text-down"
                  }`}
                >
                  {priceChange.direction === "up" ? (
                    <ArrowUp className="size-3" />
                  ) : (
                    <ArrowDown className="size-3" />
                  )}
                  {priceChange.rate}%
                </span>
              )}
              {priceChange && <span className="text-xs text-ink-2">30일 전 대비</span>}
            </div>

            {/* 단가 그래프 SVG (목업 형식: data-chart="area" data-smooth data-min="auto") */}
            {trendPoints.length >= 2 ? (
              <PriceTrendSvg points={trendPoints} />
            ) : (
              <p className="mt-2 text-xs text-ink-3">단가 이력이 부족합니다.</p>
            )}
          </div>
        ) : (
          <div className="mt-2 rounded-xl glass-card p-3.5">
            <p className="text-sm text-ink-2">단가 미설정</p>
            <p className="mt-1 text-xs text-ink-3">
              추천발주에서 쿠팡 담기를 실행하면 상품과 단가가 연결돼요.
            </p>
          </div>
        )}
      </section>

      {/* 재료 설정 접기/펼치기 및 삭제 */}
      <section className="mt-6 border-t border-white/70 pt-4">
        <button
          type="button"
          aria-expanded={isSettingsOpen}
          onClick={() => setIsSettingsOpen((v) => !v)}
          className="flex w-full items-center justify-between text-sm font-bold text-ink"
        >
          재료 설정
          <ChevronDown
            className={`size-4 text-ink-2 transition-transform ${isSettingsOpen ? "rotate-180 text-brand" : ""}`}
          />
        </button>

        {isSettingsOpen && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateItemMutation.mutate();
            }}
            className="mt-3 grid grid-cols-3 gap-2.5"
          >
            <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
              재주문 임계값 ({item.unit})
              <input
                type="number"
                step="any"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="h-10 w-full rounded-lg border border-white/80 bg-transparent px-3 text-[0.95rem] font-normal text-ink focus:border-brand focus:outline-none"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
              안전재고 ({item.unit})
              <input
                type="number"
                step="any"
                value={safety}
                onChange={(e) => setSafety(e.target.value)}
                placeholder="선택"
                className="h-10 w-full rounded-lg border border-white/80 bg-transparent px-3 text-[0.95rem] font-normal text-ink focus:border-brand focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
              리드타임 (일)
              <input
                type="number"
                value={leadTime}
                onChange={(e) => setLeadTime(e.target.value)}
                placeholder="선택"
                className="h-10 w-full rounded-lg border border-white/80 bg-transparent px-3 text-[0.95rem] font-normal text-ink focus:border-brand focus:outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={updateItemMutation.isPending}
              className="col-span-3 h-10 rounded-lg bg-brand text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-60"
            >
              {updateItemMutation.isPending ? "저장 중…" : "저장"}
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={onDelete}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-danger hover:underline"
        >
          <Trash2 className="size-4" />
          재료 삭제
        </button>
      </section>
    </FollowPanel>
  );
}

/** 입고 대기 카드 부품 (04_fe.md §4.6.1) */
function PendingOrderCard({
  pending,
  unit,
  onDone,
}: {
  pending: PendingOrderItem;
  unit: string;
  onDone: () => void;
}) {
  const [qty, setQty] = useState(String(Number(pending.final_quantity)));
  const [price, setPrice] = useState(pending.subtotal != null ? String(pending.subtotal) : "");
  const [receivedAt, setReceivedAt] = useState(todayIso());
  const [expiry, setExpiry] = useState("");

  const receiveMutation = useMutation({
    mutationFn: () =>
      receiveOrderItem(pending.order_item_id, {
        quantity: Number(qty),
        purchase_price: Number(price),
        received_at: receivedAt,
        expiry_date: expiry || null,
      }),
    onSuccess: onDone,
    onError: () => window.alert("입고 처리에 실패했습니다."),
  });

  const skipMutation = useMutation({
    mutationFn: () => skipOrderItem(pending.order_item_id),
    onSuccess: onDone,
    onError: () => window.alert("입고 안 함 처리에 실패했습니다."),
  });

  const titleDate = `${formatMonthDay(pending.approved_at)} 확정 발주`;
  const subtotalText =
    pending.subtotal != null ? ` · ${pending.subtotal.toLocaleString("ko-KR")}원` : "";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (Number(qty) > 0 && price !== "" && receivedAt) {
          receiveMutation.mutate();
        }
      }}
      className="mt-2 rounded-xl glass-card p-3.5"
    >
      <p className="text-sm font-semibold text-ink">
        {titleDate}{" "}
        <span className="font-normal text-ink-2">
          · {fmtQty(pending.final_quantity)} {unit}
          {subtotalText}
        </span>
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
          입고 수량 ({unit})
          <input
            type="number"
            step="any"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="h-10 w-full rounded-full border border-white/80 bg-[rgb(46_32_120/0.065)] px-4 text-[0.95rem] font-normal text-ink focus:border-brand focus:outline-none"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
          구매 금액 (원)
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="h-10 w-full rounded-full border border-white/80 bg-[rgb(46_32_120/0.065)] px-4 text-[0.95rem] font-normal text-ink focus:border-brand focus:outline-none"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
          입고일
          <input
            type="date"
            value={receivedAt}
            onChange={(e) => setReceivedAt(e.target.value)}
            className="h-10 w-full rounded-full border border-white/80 bg-[rgb(46_32_120/0.065)] px-4 text-[0.95rem] font-normal text-ink focus:border-brand focus:outline-none"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
          소비기한 (선택)
          <input
            type="date"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            className="h-10 w-full rounded-full border border-white/80 bg-[rgb(46_32_120/0.065)] px-4 text-[0.95rem] font-normal text-ink focus:border-brand focus:outline-none"
          />
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={skipMutation.isPending}
          onClick={() => skipMutation.mutate()}
          className="h-10 rounded-lg border border-white/80 px-4 text-sm font-semibold text-ink-2 hover:bg-white/30 disabled:opacity-60"
        >
          입고 안 함
        </button>
        <button
          type="submit"
          disabled={receiveMutation.isPending}
          className="h-10 flex-1 rounded-lg bg-brand text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-60"
        >
          {receiveMutation.isPending ? "입고 처리 중…" : "입고 처리"}
        </button>
      </div>
    </form>
  );
}

/** 로트 수정 폼 */
function EditLotForm({
  item,
  lot,
  onClose,
  onDone,
}: {
  item: InventoryItem;
  lot: Lot;
  onClose: () => void;
  onDone: () => void;
}) {
  const [remaining, setRemaining] = useState(String(Number(lot.remaining_quantity)));
  const [expiry, setExpiry] = useState(lot.expiry_date ?? "");
  const [reason, setReason] = useState<AdjustmentReason>("STOCKTAKE");
  const [memo, setMemo] = useState("");

  const updateMutation = useMutation({
    mutationFn: () => {
      const n = Number(remaining);
      return updateLot(item.item_id, lot.lot_id, {
        ...(n !== Number(lot.remaining_quantity) && { remaining_quantity: n }),
        ...((expiry || null) !== lot.expiry_date && { expiry_date: expiry || null }),
        reason,
        memo: memo || null,
      });
    },
    onSuccess: onDone,
    onError: () => window.alert("로트 수정에 실패했습니다."),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (remaining !== "" && Number(remaining) >= 0) {
          updateMutation.mutate();
        }
      }}
      className="mt-3 grid grid-cols-2 gap-2.5 rounded-lg p-3"
    >
      <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
        잔여 수량 ({item.unit})
        <input
          type="number"
          step="any"
          value={remaining}
          onChange={(e) => setRemaining(e.target.value)}
          className="h-10 w-full rounded-lg border border-white/80 bg-[rgb(46_32_120/0.065)] px-3 text-[0.95rem] font-normal text-ink focus:border-brand focus:outline-none"
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
        소비기한
        <input
          type="date"
          value={expiry}
          onChange={(e) => setExpiry(e.target.value)}
          className="h-10 w-full rounded-lg border border-white/80 bg-[rgb(46_32_120/0.065)] px-3 text-[0.95rem] font-normal text-ink focus:border-brand focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
        수정 사유
        <span className="relative block">
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as AdjustmentReason)}
            className="h-10 w-full appearance-none rounded-lg border border-white/80 bg-[rgb(46_32_120/0.065)] pr-8 pl-2.5 text-[0.95rem] font-normal text-ink focus:border-brand focus:outline-none"
          >
            {(Object.keys(REASON_LABEL) as AdjustmentReason[]).map((r) => (
              <option key={r} value={r}>
                {REASON_LABEL[r]}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-ink-2" />
        </span>
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
        메모 (선택)
        <input
          value={memo}
          maxLength={255}
          onChange={(e) => setMemo(e.target.value)}
          className="h-10 w-full rounded-lg border border-white/80 bg-[rgb(46_32_120/0.065)] px-3 text-[0.95rem] font-normal text-ink focus:border-brand focus:outline-none"
        />
      </label>
      <div className="col-span-2 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="h-10 rounded-lg border border-white/80 px-4 text-sm font-semibold text-ink-2 hover:bg-white/30"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={updateMutation.isPending}
          className="h-10 flex-1 rounded-lg bg-brand text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-60"
        >
          {updateMutation.isPending ? "저장 중…" : "저장"}
        </button>
      </div>
    </form>
  );
}

/** 로트 폐기 폼 */
function DisposeLotForm({
  item,
  lot,
  onClose,
  onDone,
}: {
  item: InventoryItem;
  lot: Lot;
  onClose: () => void;
  onDone: () => void;
}) {
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");

  const disposeMutation = useMutation({
    mutationFn: () =>
      disposeLot(item.item_id, {
        lot_id: lot.lot_id,
        quantity: Number(qty),
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

  const maxQty = Number(lot.remaining_quantity);
  const n = Number(qty);
  const valid = n > 0 && n <= maxQty;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) disposeMutation.mutate();
      }}
      className="mt-3 grid grid-cols-2 gap-2.5 rounded-lg p-3"
    >
      <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
        폐기 수량 ({item.unit}, 최대 {fmtQty(maxQty)})
        <input
          type="number"
          step="any"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="h-10 w-full rounded-lg border border-white/80 bg-[rgb(46_32_120/0.065)] px-3 text-[0.95rem] font-normal text-ink focus:border-brand focus:outline-none"
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
        폐기 사유 (선택)
        <input
          value={reason}
          maxLength={255}
          placeholder="소비기한 만료"
          onChange={(e) => setReason(e.target.value)}
          className="h-10 w-full rounded-lg border border-white/80 bg-[rgb(46_32_120/0.065)] px-3 text-[0.95rem] font-normal text-ink placeholder:text-ink-4 focus:border-brand focus:outline-none"
        />
      </label>
      <div className="col-span-2 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="h-10 rounded-lg border border-white/80 px-4 text-sm font-semibold text-ink-2 hover:bg-white/30"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={!valid || disposeMutation.isPending}
          className="h-10 flex-1 rounded-lg bg-danger text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          폐기
        </button>
      </div>
    </form>
  );
}

/** 목업의 mockup.js renderChart("area", smooth, auto-min, no y/x labels)와 일치하는 SVG */
function PriceTrendSvg({ points }: { points: Array<{ date: string; unit_price: number | null }> }) {
  const valid = points.filter((p) => p.unit_price !== null && p.unit_price > 0);
  if (valid.length < 2) return null;

  const values = valid.map((p) => p.unit_price!);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const span = maxVal - minVal || maxVal * 0.1 || 1;
  const lo = minVal - span * 0.35;
  const hi = maxVal + span * 0.25;

  const W = 300;
  const H = 80;
  const B = 4;
  const L = 2;
  const R = 2;

  const x = (i: number) => L + ((W - L - R) / (values.length - 1)) * i;
  const y = (v: number) => 4 + (H - B - 4) * (1 - (v - lo) / (hi - lo));

  const pts = values.map((v, i) => [x(i), y(v)] as [number, number]);

  // Catmull-Rom to cubic bezier
  let pathD = `M${pts[0]![0]},${pts[0]![1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i - 1] ?? pts[i]!;
    const b = pts[i]!;
    const c = pts[i + 1]!;
    const e = pts[i + 2] ?? c;
    const cp1x = b[0] + (c[0] - a[0]) / 6;
    const cp1y = b[1] + (c[1] - a[1]) / 6;
    const cp2x = c[0] - (e[0] - b[0]) / 6;
    const cp2y = c[1] - (e[1] - b[1]) / 6;
    pathD += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${c[0]},${c[1]}`;
  }

  const lastPt = pts[pts.length - 1]!;
  const firstPt = pts[0]!;
  const areaD = `${pathD} L${lastPt[0]},${H - B} L${firstPt[0]},${H - B}Z`;

  return (
    <div className="mt-2 h-20 w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        role="img"
        aria-label="30일 단가 추세 그래프"
      >
        <title>30일 단가 추세 그래프</title>
        <defs>
          <linearGradient id="inv-price-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#6b4eff" stopOpacity="0.22" />
            <stop offset="1" stopColor="#6b4eff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="#e3e6eb" />
        <path d={areaD} fill="url(#inv-price-grad)" className="chart-fade" />
        <path
          d={pathD}
          pathLength={1}
          fill="none"
          stroke="#6b4eff"
          strokeWidth="2.5"
          className="chart-line"
        />
      </svg>
    </div>
  );
}
