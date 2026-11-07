// 추천발주 목록 컴포넌트 — 04_fe.md §4.8, 목업 10_orders.html.
import { Check } from "lucide-react";
import type { OrderRecommendation } from "../../api/endpoints/orders";
import type { CartProgressStatus } from "../../features/coupang-cart/use-coupang-cart";
import { formatQty, formatWon } from "../../lib/format";
import { cn } from "../../lib/utils";
import { calculateItemEstimate, formatStockoutDate } from "./order-calc";

export type RecommendViewState = "loading" | "notfound" | "short" | "aierror" | "empty" | "ready";

interface RecommendListProps {
  viewState: RecommendViewState;
  isCarting: boolean;
  recommendations: OrderRecommendation[];
  selected: Set<string>;
  quantities: Record<string, string>;
  itemProgress: Record<string, CartProgressStatus>;
  isForecastRunning: boolean;
  onRunForecast: () => void;
  onToggle: (itemId: string) => void;
  onQuantityChange: (itemId: string, value: string) => void;
}

export function RecommendList({
  viewState,
  isCarting,
  recommendations,
  selected,
  quantities,
  itemProgress,
  isForecastRunning,
  onRunForecast,
  onToggle,
  onQuantityChange,
}: RecommendListProps) {
  if (viewState === "loading") {
    return (
      <p className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl px-6 py-10 text-center text-[0.95rem] text-ink-2 glass-card">
        추천을 계산하는 중…
      </p>
    );
  }

  if (viewState === "notfound") {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl px-6 py-10 text-center text-[0.95rem] text-ink-2 glass-card">
        <p>아직 오늘 예측이 없어요</p>
        <button
          type="button"
          onClick={onRunForecast}
          disabled={isForecastRunning}
          className="inline-flex h-11 items-center rounded-full bg-brand px-6 text-[0.95rem] font-semibold text-white hover:bg-brand-strong disabled:opacity-50"
        >
          {isForecastRunning ? "계산하는 중…" : "지금 계산하기"}
        </button>
        <p className="text-sm">수십 초쯤 걸려요</p>
      </div>
    );
  }

  if (viewState === "short") {
    return (
      <p className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl px-6 py-10 text-center text-[0.95rem] text-ink-2 glass-card">
        판매 이력이 10일 이상 쌓이면 추천이 나와요
      </p>
    );
  }

  if (viewState === "aierror") {
    return (
      <p className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl px-6 py-10 text-center text-[0.95rem] text-ink-2 glass-card">
        AI 서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요
      </p>
    );
  }

  if (viewState === "empty" || recommendations.length === 0) {
    return (
      <p className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl px-6 py-10 text-center text-[0.95rem] text-ink-2 glass-card">
        추천할 재료가 없어요. 메뉴 레시피와 재고를 확인해 주세요
      </p>
    );
  }

  return (
    <section className="rounded-2xl px-4 glass-card lg:px-5">
      <div className="hidden items-center pt-4 pb-1 text-xs font-semibold text-ink-2 lg:grid lg:grid-cols-[2.5rem_minmax(0,1fr)_4.5rem_8.5rem_6rem] lg:gap-x-4">
        <span />
        <span>재료 · 추천 근거</span>
        <span className="text-center">소진 예상</span>
        <span className="text-center">발주 수량</span>
        <span className="text-center">예상 금액</span>
      </div>
      <ul className="divide-y divide-white/70">
        {recommendations.map((item) => {
          const isSelected = selected.has(item.item_id);
          const rawQty = quantities[item.item_id] ?? String(item.recommended_quantity);
          const estimate = calculateItemEstimate(item.unit_price, rawQty);
          const progressStatus = itemProgress[item.item_id] ?? "pending";
          const formattedStockout = formatStockoutDate(item.expected_stockout_date);

          return (
            <li
              key={item.item_id}
              className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-4 lg:grid-cols-[2.5rem_minmax(0,1fr)_4.5rem_8.5rem_6rem] lg:gap-x-4"
            >
              {/* 체크박스 */}
              <div className="col-start-1 row-span-2 row-start-1 -ml-2 self-center">
                <label className="flex size-10 shrink-0 cursor-pointer items-center justify-center">
                  <input
                    type="checkbox"
                    aria-label={`${item.item_name} 선택`}
                    checked={isSelected}
                    disabled={isCarting}
                    onChange={() => onToggle(item.item_id)}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full border-2 peer-focus-visible:ring-4 peer-focus-visible:ring-brand-soft",
                      isSelected
                        ? "border-brand bg-brand text-white"
                        : "border-ink-3 text-transparent",
                    )}
                  >
                    <Check className="size-4" strokeWidth={3} />
                  </span>
                </label>
              </div>

              {/* 재료명 */}
              <p
                className={cn(
                  "col-start-2 row-start-1 truncate text-[1.05rem] font-bold text-ink",
                  !isSelected && "opacity-60",
                )}
              >
                {item.item_name}
              </p>

              {/* 소진 예상 */}
              <p
                className={cn(
                  "tabular col-start-2 row-start-3 self-center whitespace-nowrap text-sm text-ink-2 lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:text-center lg:text-[0.95rem] lg:text-ink",
                  !isSelected && "opacity-60",
                )}
              >
                <span className="lg:hidden">소진 예상 </span>
                {!isSelected ? "—" : formattedStockout}
              </p>

              {/* 발주 수량 — 담는 중일 때는 텍스트 + 진행 뱃지, 평소에는 직접 입력칸 */}
              {isCarting ? (
                <p className="tabular text-right lg:text-center col-start-3 row-start-3 lg:col-start-4 lg:row-span-2 lg:row-start-1 lg:self-center">
                  <span className="block text-[0.95rem] font-bold text-ink">
                    {isSelected ? `${formatQty(rawQty)} ${item.unit}` : `0 ${item.unit}`}
                  </span>
                  {!isSelected ? (
                    <span className="block text-xs font-semibold text-ink-2">고르지 않음</span>
                  ) : progressStatus === "added" ? (
                    <span className="block text-xs font-semibold text-ok">담김</span>
                  ) : progressStatus === "carting" ? (
                    <span className="block text-xs font-semibold text-brand">담는 중…</span>
                  ) : progressStatus === "failed" ? (
                    <span className="block text-xs font-semibold text-danger">담지 못함</span>
                  ) : (
                    <span className="block text-xs font-semibold text-ink-2">대기</span>
                  )}
                </p>
              ) : (
                <label
                  className={cn(
                    "relative block w-28 lg:w-full col-start-3 row-start-3 lg:col-start-4 lg:row-span-2 lg:row-start-1 lg:self-center",
                    !isSelected && "opacity-60",
                  )}
                >
                  <span className="sr-only">{item.item_name} 발주 수량</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    inputMode="decimal"
                    aria-label={`${item.item_name} 발주 수량`}
                    value={rawQty}
                    disabled={!isSelected}
                    onChange={(e) => onQuantityChange(item.item_id, e.target.value)}
                    className="tabular h-10 w-full rounded-full border border-white/80 bg-[rgb(46_32_120/0.065)] pr-10 pl-4 text-right text-[0.95rem] font-bold text-ink focus:border-brand focus:outline-none disabled:text-ink-3"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm text-ink-2">
                    {item.unit}
                  </span>
                </label>
              )}

              {/* 예상 금액 & 단가 */}
              <div
                className={cn(
                  "tabular col-start-3 row-start-1 text-right lg:col-start-5 lg:row-span-2 lg:self-center lg:text-center",
                  !isSelected && "opacity-60",
                )}
              >
                {item.unit_price == null ? (
                  <p className="text-right text-sm text-ink-2 lg:text-center">단가 미설정</p>
                ) : !isSelected ? (
                  <p className="text-[1.05rem] font-bold text-ink">—</p>
                ) : (
                  <>
                    <p className="text-[1.05rem] font-bold text-ink">{formatWon(estimate ?? 0)}</p>
                    <p className="hidden text-xs text-ink-2 lg:block">
                      {formatQty(item.unit_price)}원/{item.unit}
                    </p>
                  </>
                )}
              </div>

              {/* 추천 근거 — 웹은 한 줄로 자르고 마우스오버로 전체, 앱은 마우스가 없어 줄을 넘겨 전체를 보인다 */}
              <p
                title={item.recommendation_reason}
                className={cn(
                  "col-[2/4] row-start-2 text-sm text-ink-2 lg:col-[2/3] lg:truncate",
                  !isSelected && "opacity-60",
                )}
              >
                {item.config_status === "DEFAULT_USED" ? (
                  <>
                    <span className="font-semibold text-warn">기본값으로 계산</span> ·{" "}
                  </>
                ) : null}
                {item.recommendation_reason}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
