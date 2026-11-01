// 추천발주 화면 — v2 리디자인 (04_fe.md §4.8, 08_coupang_cart.md §4, 목업 10_orders.html).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HTTPError } from "ky";
import { useEffect, useMemo, useState } from "react";
import { runForecast } from "../api/endpoints/forecast";
import { type OrderRecommendation, getAIRecommend, listOrders } from "../api/endpoints/orders";
import { CoupangCartPanel } from "../components/orders/coupang-cart-panel";
import {
  calculateOrderSummary,
  formatTargetPeriod,
  sortRecommendations,
} from "../components/orders/order-calc";
import { OrderHeader } from "../components/orders/order-header";
import { OrderHistory } from "../components/orders/order-history";
import { RecommendList, type RecommendViewState } from "../components/orders/recommend-list";
import { MainShell } from "../components/shell";
import { useCoupangCart } from "../features/coupang-cart/use-coupang-cart";

export default function OrdersPage() {
  const queryClient = useQueryClient();

  // 1. 추천발주 조회
  const {
    data: aiRecommend,
    isLoading: isAiLoading,
    error: aiError,
    refetch: refetchRecommend,
  } = useQuery({
    queryKey: ["ai-orders-recommend"],
    queryFn: getAIRecommend,
    staleTime: 60_000,
    retry: false,
  });

  // 2. 발주 이력 조회
  const { data: orderPage } = useQuery({
    queryKey: ["orders"],
    queryFn: () => listOrders(1, 20),
    staleTime: 30_000,
  });
  const pastOrders = orderPage?.items ?? [];

  // 3. 소진 시점 오름차순 정렬된 추천 목록
  const sortedRecommendations = useMemo<OrderRecommendation[]>(() => {
    if (!aiRecommend?.recommendations) return [];
    return sortRecommendations(aiRecommend.recommendations);
  }, [aiRecommend]);

  // 4. 선택 및 수량 상태
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  useEffect(() => {
    if (sortedRecommendations.length === 0) return;

    setSelected((prev) => {
      // 기존 선택이 있으면 유지하고, 없는 경우에만 초기화
      if (prev.size > 0) return prev;
      const initial = new Set<string>();
      for (const r of sortedRecommendations) {
        if (r.recommended_quantity > 0) {
          initial.add(r.item_id);
        }
      }
      return initial;
    });

    setQuantities((prev) => {
      const next = { ...prev };
      for (const r of sortedRecommendations) {
        if (next[r.item_id] === undefined) {
          next[r.item_id] = String(r.recommended_quantity);
        }
      }
      return next;
    });
  }, [sortedRecommendations]);

  const handleToggle = (itemId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleQuantityChange = (itemId: string, value: string) => {
    setQuantities((prev) => ({ ...prev, [itemId]: value }));
  };

  // 5. 추천 상태 결정 (loading / notfound / short / aierror / empty / ready)
  const [forecastErrorOverride, setForecastErrorOverride] = useState<RecommendViewState | null>(
    null,
  );

  const viewState = useMemo<RecommendViewState>(() => {
    if (forecastErrorOverride) return forecastErrorOverride;
    if (isAiLoading) return "loading";
    if (aiError) {
      if (aiError instanceof HTTPError) {
        const status = aiError.response.status;
        if (status === 404) return "notfound";
        if (status === 422) return "short";
        return "aierror";
      }
      return "aierror";
    }
    if (!aiRecommend || aiRecommend.recommendations.length === 0) {
      return "empty";
    }
    return "ready";
  }, [isAiLoading, aiError, aiRecommend, forecastErrorOverride]);

  // 6. 예측 수동 실행 (POST /api/forecast/run)
  const { mutate: executeForecast, isPending: isForecastRunning } = useMutation({
    mutationFn: runForecast,
    onSuccess: () => {
      setForecastErrorOverride(null);
      void queryClient.invalidateQueries({ queryKey: ["ai-orders-recommend"] });
    },
    onError: (err) => {
      if (err instanceof HTTPError) {
        const status = err.response.status;
        if (status === 422) {
          setForecastErrorOverride("short");
          return;
        }
      }
      setForecastErrorOverride("aierror");
    },
  });

  // 7. 쿠팡 담기 오케스트레이션 훅
  const {
    status: cartStatus,
    hasExtension,
    isCoupangLoggedIn,
    currentStepInfo,
    itemProgress,
    finishResult,
    errorMessage: cartErrorMessage,
    startCarting,
    reset: resetCart,
  } = useCoupangCart({
    recommendationId: aiRecommend?.recommendation_id,
    onFinished: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void refetchRecommend();
    },
    onConflict: () => void refetchRecommend(),
  });

  // 8. 요약 계산
  const { selectedCount, estimatedTotal, unpricedMessage } = useMemo(
    () => calculateOrderSummary(sortedRecommendations, selected, quantities),
    [sortedRecommendations, selected, quantities],
  );

  const periodText = useMemo(
    () => formatTargetPeriod(aiRecommend?.target_dates),
    [aiRecommend?.target_dates],
  );

  // 담기 시작 핸들러
  const handleStartCarting = () => {
    const items = sortedRecommendations
      .filter((r) => selected.has(r.item_id))
      .map((r) => {
        const rawQty = quantities[r.item_id] ?? String(r.recommended_quantity);
        const finalQuantity = Math.round(Number(rawQty) * 1000) / 1000;
        return {
          item_id: r.item_id,
          final_quantity: finalQuantity,
        };
      })
      .filter((i) => Number.isFinite(i.final_quantity) && i.final_quantity > 0);

    if (items.length === 0) return;
    void startCarting({ items });
  };

  return (
    <MainShell active="orders">
      <OrderHeader
        periodText={periodText}
        isLowConfidence={aiRecommend?.is_low_confidence}
        lowConfidenceReason={aiRecommend?.low_confidence_reason}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5 xl:items-start">
        {/* 왼쪽 3칸: 추천 목록 */}
        <div className="xl:col-span-3">
          <RecommendList
            viewState={viewState}
            isCarting={cartStatus === "carting"}
            recommendations={sortedRecommendations}
            selected={selected}
            quantities={quantities}
            itemProgress={itemProgress}
            isForecastRunning={isForecastRunning}
            onRunForecast={() => executeForecast()}
            onToggle={handleToggle}
            onQuantityChange={handleQuantityChange}
          />
        </div>

        {/* 오른쪽 2칸: 쿠팡 담기 판 및 발주 이력 */}
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start xl:col-span-2 xl:grid-cols-1">
          <CoupangCartPanel
            status={cartStatus}
            hasExtension={hasExtension}
            isCoupangLoggedIn={isCoupangLoggedIn}
            selectedCount={selectedCount}
            estimatedTotal={estimatedTotal}
            unpricedMessage={unpricedMessage}
            currentStepInfo={currentStepInfo}
            finishResult={finishResult}
            recommendations={sortedRecommendations}
            quantities={quantities}
            errorMessage={cartErrorMessage}
            onStartCarting={handleStartCarting}
            onRetryRemaining={selectedCount > 0 ? handleStartCarting : undefined}
            onReset={resetCart}
          />

          <OrderHistory orders={pastOrders} />
        </div>
      </div>
    </MainShell>
  );
}
