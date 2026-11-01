// 쿠팡 담기 판 컴포넌트 — 04_fe.md §4.8, 목업 10_orders.html lines 180~212.
import type { AutomateFinishResponse, OrderRecommendation } from "../../api/endpoints/orders";
import { formatQty, formatWon } from "../../lib/format";
import { formatDayWithWeekday } from "./order-calc";

interface CoupangCartPanelProps {
  status: "idle" | "carting" | "result" | "error";
  hasExtension: boolean;
  isCoupangLoggedIn: boolean;
  selectedCount: number;
  estimatedTotal: number;
  unpricedMessage: string | null;
  currentStepInfo: {
    currentTargetName: string;
    currentIndex: number;
    totalTargets: number;
    percent: number;
  };
  finishResult: AutomateFinishResponse | null;
  recommendations: OrderRecommendation[];
  quantities: Record<string, string>;
  errorMessage: string | null;
  onStartCarting: () => void;
  onRetryRemaining?: (() => void) | undefined;
  onReset: () => void;
}

export function CoupangCartPanel({
  status,
  hasExtension,
  isCoupangLoggedIn,
  selectedCount,
  estimatedTotal,
  unpricedMessage,
  currentStepInfo,
  finishResult,
  recommendations,
  quantities,
  errorMessage,
  onStartCarting,
  onRetryRemaining,
  onReset,
}: CoupangCartPanelProps) {
  // 품목 정보 맵
  const itemMap = new Map(recommendations.map((r) => [r.item_id, r]));

  if (status === "result" && finishResult) {
    const addedItems = finishResult.items.filter((i) => i.status === "ADDED");
    const checkNeededItems = finishResult.items.filter((i) => i.status === "CHECK_NEEDED");
    const failedItems = finishResult.items.filter((i) => i.status === "FAILED");

    const totalSuccessful = addedItems.length + checkNeededItems.length;

    const approvedDayText = finishResult.approved_at
      ? formatDayWithWeekday(new Date(finishResult.approved_at))
      : "";

    const formatItemList = (items: typeof finishResult.items) =>
      items
        .map((i) => {
          const rec = itemMap.get(i.item_id);
          const name = rec?.item_name ?? i.item_id;
          const qty = quantities[i.item_id] ?? (rec ? String(rec.recommended_quantity) : "");
          const unit = rec?.unit ?? "";
          return qty ? `${name} ${formatQty(qty)} ${unit}` : name;
        })
        .join(" · ");

    return (
      <section className="rounded-2xl p-5 glass-card">
        <div>
          <h2 className="text-lg font-bold text-ink">
            {totalSuccessful > 0
              ? `${totalSuccessful}개를 담고 발주를 확정했어요`
              : "발주를 확정하지 못했어요"}
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            {approvedDayText} · 예상 {formatWon(finishResult.total_estimated_cost)} · 발주 이력 맨
            위
          </p>

          <ul className="mt-4 space-y-3 text-sm">
            {addedItems.length > 0 && (
              <li>
                <p className="font-semibold text-ok">담김 {addedItems.length}</p>
                <p className="mt-0.5 text-ink">{formatItemList(addedItems)}</p>
              </li>
            )}
            {checkNeededItems.length > 0 && (
              <li>
                <p className="font-semibold text-warn">확인 필요 {checkNeededItems.length}</p>
                <p className="mt-0.5 text-ink">{formatItemList(checkNeededItems)}</p>
                <p className="mt-0.5 text-ink-2">
                  장바구니에 있던 같은 상품과 합쳐져 수량이 더 많아요. 결제 전에 줄여 주세요
                </p>
              </li>
            )}
            {failedItems.length > 0 && (
              <li>
                <p className="font-semibold text-danger">담지 못함 {failedItems.length}</p>
                <p className="mt-0.5 text-ink">{formatItemList(failedItems)}</p>
                <p className="mt-0.5 text-ink-2">
                  {failedItems[0]?.reason || "발주 수량에 맞는 상품을 찾지 못했어요"}
                  {finishResult.manual_guide_url ? (
                    <>
                      {" "}
                      ·{" "}
                      <a
                        href={finishResult.manual_guide_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-brand"
                      >
                        직접 담는 방법
                      </a>
                    </>
                  ) : null}
                </p>
              </li>
            )}
          </ul>

          {!isCoupangLoggedIn && (
            <p className="mt-4 text-xs text-ink-2">
              쿠팡에 로그인하지 않아 로켓프레시 상품은 빼고 골랐어요
            </p>
          )}

          <a
            href="https://cart.coupang.com/cartView.pang"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-full bg-brand text-base font-semibold text-white hover:bg-brand-strong"
          >
            쿠팡 장바구니 열기
          </a>

          {onRetryRemaining && selectedCount > 0 && (
            <button
              type="button"
              onClick={onRetryRemaining}
              className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-full border border-white/80 text-base font-semibold text-ink-2 hover:bg-white/30"
            >
              고른 {selectedCount}개 다시 담기 · {formatWon(estimatedTotal)}
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl p-5 glass-card">
      <h2 className="text-lg font-bold text-ink">쿠팡 담기</h2>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <dt className="text-xs text-ink-2">고른 품목</dt>
          <dd className="tabular mt-1 text-[1.75rem] leading-none font-bold tracking-tight text-ink">
            {selectedCount}개
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-2">예상 합계</dt>
          <dd className="tabular mt-1 text-[1.75rem] leading-none font-bold tracking-tight text-ink">
            {formatWon(estimatedTotal)}
          </dd>
        </div>
      </dl>

      {unpricedMessage ? <p className="mt-2 text-xs text-ink-2">{unpricedMessage}</p> : null}

      {status === "error" && errorMessage && (
        <div className="mt-3 rounded-xl bg-danger/10 p-3 text-sm text-danger">
          <p>{errorMessage}</p>
          <button type="button" onClick={onReset} className="mt-2 text-xs font-semibold underline">
            다시 시도
          </button>
        </div>
      )}

      {status === "carting" ? (
        <div className="mt-5">
          <p className="flex items-baseline justify-between text-sm">
            <span className="font-semibold text-brand">담는 중</span>
            <span className="tabular text-ink-2">
              {currentStepInfo.currentIndex} / {currentStepInfo.totalTargets}
            </span>
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/60">
            <div
              className="h-full rounded-full bg-brand transition-all duration-300"
              style={{ width: `${currentStepInfo.percent}%` }}
            />
          </div>
          <p className="mt-2.5 text-xs text-ink-2">작업 탭을 닫으면 멈추고, 발주는 만들지 않아요</p>
        </div>
      ) : !hasExtension ? (
        <>
          <button
            type="button"
            disabled
            className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-ink-4 text-base font-semibold text-white"
          >
            쿠팡 담기
          </button>
          <p className="mt-2.5 text-sm font-medium text-ink-2">
            PC 크롬에서 사주라 확장으로 담아 주세요
          </p>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={onStartCarting}
            disabled={selectedCount === 0}
            className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-brand text-base font-semibold text-white hover:bg-brand-strong disabled:opacity-50"
          >
            쿠팡 담기
          </button>
          <p className="mt-2.5 text-xs text-ink-2">
            장바구니에 담기만 해요. 결제는 쿠팡에서 확인한 뒤 직접 해요
          </p>
        </>
      )}
    </section>
  );
}
