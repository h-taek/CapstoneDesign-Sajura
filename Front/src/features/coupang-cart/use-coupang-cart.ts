// 쿠팡 자동 담기 오케스트레이션 훅 — 04_fe.md §4.8, §12.3~§12.8, 08_coupang_cart.md §4.
import { HTTPError } from "ky";
import { useCallback, useEffect, useState } from "react";
import {
  type AutomateFinishResponse,
  type NonWowPrice,
  type StepResult,
  finishOrderAutomation,
  startOrderAutomation,
  stepOrderAutomation,
} from "../../api/endpoints/orders";
import {
  GUARD_REJECTED_TITLE,
  LOGIN_NOTICE,
  TAB_CLOSED_ERROR,
  isExtensionRuntimeAvailable,
  openExtension,
  pingExtension,
  runExtension,
  sendExtensionNotice,
  sendExtensionProgress,
  takeNonWowPrices,
} from "../../lib/extension";

export type CartProgressStatus = "pending" | "carting" | "added" | "failed";

export interface CoupangCartState {
  status: "idle" | "carting" | "result" | "error";
  hasExtension: boolean;
  isCheckingExtension: boolean;
  isCoupangLoggedIn: boolean;
  currentStepInfo: {
    currentTargetName: string;
    currentIndex: number;
    totalTargets: number;
    percent: number;
  };
  itemProgress: Record<string, CartProgressStatus>;
  finishResult: AutomateFinishResponse | null;
  errorMessage: string | null;
}

// 작업 탭을 닫으면 담기를 멈추고 발주를 만들지 않는다 (01_basic_design.md §3.7.4)
const TAB_CLOSED_MESSAGE = "쿠팡 작업 탭을 닫아 담기를 멈췄어요. 발주는 만들지 않았어요.";

export function useCoupangCart({
  recommendationId,
  onFinished,
  onConflict,
}: {
  recommendationId?: string | null | undefined;
  onFinished?: ((result: AutomateFinishResponse) => void) | undefined;
  /** 409 — 이미 확정한 추천안. 호출부가 추천을 새로 받는다 (04_fe.md §4.8) */
  onConflict?: (() => void) | undefined;
}) {
  const [hasExtension, setHasExtension] = useState<boolean>(false);
  const [isCheckingExtension, setIsCheckingExtension] = useState<boolean>(true);
  const [status, setStatus] = useState<"idle" | "carting" | "result" | "error">("idle");
  const [isCoupangLoggedIn, setIsCoupangLoggedIn] = useState<boolean>(true);
  const [currentStepInfo, setCurrentStepInfo] = useState({
    currentTargetName: "",
    currentIndex: 0,
    totalTargets: 0,
    percent: 0,
  });
  const [itemProgress, setItemProgress] = useState<Record<string, CartProgressStatus>>({});
  const [finishResult, setFinishResult] = useState<AutomateFinishResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 확장 설치 여부 확인
  const checkExtension = useCallback(async () => {
    setIsCheckingExtension(true);
    try {
      if (!isExtensionRuntimeAvailable()) {
        setHasExtension(false);
        setIsCheckingExtension(false);
        return false;
      }
      const ping = await pingExtension();
      const ok = ping.ok === true;
      setHasExtension(ok);
      setIsCheckingExtension(false);
      return ok;
    } catch {
      setHasExtension(false);
      setIsCheckingExtension(false);
      return false;
    }
  }, []);

  useEffect(() => {
    void checkExtension();
  }, [checkExtension]);

  const reset = useCallback(() => {
    setStatus("idle");
    setErrorMessage(null);
    setCurrentStepInfo({ currentTargetName: "", currentIndex: 0, totalTargets: 0, percent: 0 });
    setItemProgress({});
  }, []);

  const startCarting = useCallback(
    async (params: {
      items: Array<{ item_id: string; final_quantity: number | string }>;
      note?: string | null;
    }) => {
      setStatus("carting");
      setErrorMessage(null);

      // 1. 작업 탭 열기 및 로그인 확인
      const openRes = await openExtension();
      if (!openRes.ok) {
        setStatus("error");
        setErrorMessage(openRes.error || "쿠팡 작업 탭을 열지 못했습니다");
        return;
      }

      const loggedIn = openRes.logged_in;
      setIsCoupangLoggedIn(loggedIn);

      if (!loggedIn) {
        await sendExtensionNotice(LOGIN_NOTICE.title, LOGIN_NOTICE.detail);
      }

      // 2. 담기 시작 요청
      let runId: string;
      let targets: Array<{ item_id: string; item_name: string }>;
      try {
        const startRes = await startOrderAutomation({
          recommendation_id: recommendationId ?? null,
          items: params.items,
          note: params.note ?? null,
          coupang_logged_in: loggedIn,
        });
        runId = startRes.run_id;
        targets = startRes.targets;
      } catch (err) {
        setStatus("error");
        if (err instanceof HTTPError && err.response.status === 409) {
          setErrorMessage("이미 확정한 추천안이에요. 추천을 새로 불러왔어요.");
          onConflict?.();
        } else {
          setErrorMessage("담기를 시작하지 못했습니다.");
        }
        return;
      }

      // 초기 진행 상태 세팅
      const initialProgress: Record<string, CartProgressStatus> = {};
      for (const t of targets) {
        initialProgress[t.item_id] = "pending";
      }
      setItemProgress(initialProgress);

      const totalSteps = targets.length + 1; // targets + cart_check
      let accumulatedNonWowPrices: NonWowPrice[] = [];

      // 3. targets 순회
      for (let i = 0; i < targets.length; i++) {
        const target = targets[i]!;
        const percent = Math.round(((i + 1) / totalSteps) * 100);
        setCurrentStepInfo({
          currentTargetName: target.item_name,
          currentIndex: i + 1,
          totalTargets: targets.length,
          percent,
        });
        setItemProgress((prev) => ({ ...prev, [target.item_id]: "carting" }));

        await sendExtensionProgress({ kind: "target", name: target.item_name });

        let stepResult: StepResult | null = null;
        let itemCompleted = false;

        while (!itemCompleted) {
          try {
            const stepRes = await stepOrderAutomation(runId, {
              target: target.item_id,
              result: stepResult,
              non_wow_prices: accumulatedNonWowPrices,
            });
            accumulatedNonWowPrices = [];

            if ("action" in stepRes && stepRes.action) {
              const runRes = await runExtension(stepRes.action);
              if (!runRes.ok && runRes.error === TAB_CLOSED_ERROR) {
                setStatus("error");
                setErrorMessage(TAB_CLOSED_MESSAGE);
                return;
              }
              if (!runRes.ok) {
                itemCompleted = true;
                setItemProgress((prev) => ({ ...prev, [target.item_id]: "failed" }));
                await sendExtensionProgress({
                  kind: "result",
                  status: "FAILED",
                  reason: runRes.error,
                });
                break;
              }
              stepResult = runRes.result;
              if (runRes.non_wow_prices && runRes.non_wow_prices.length > 0) {
                accumulatedNonWowPrices.push(...runRes.non_wow_prices);
              }
            } else if ("done" in stepRes && stepRes.done) {
              itemCompleted = true;
              const args = stepRes.done.args as { reason?: string | null } | undefined;
              const reason = args?.reason ?? null;
              // 담김은 직전 동작에 담기 결과가 있었을 때만 — LLM이 사유 없이 끝내도 담긴 것이 아니다
              const added = stepResult?.kind === "action" && stepResult.cart_added != null;
              const resultStatus = added ? "ADDED" : "FAILED";
              setItemProgress((prev) => ({
                ...prev,
                [target.item_id]: added ? "added" : "failed",
              }));
              await sendExtensionProgress({
                kind: "result",
                status: resultStatus,
                reason,
              });
            } else {
              itemCompleted = true;
              break;
            }
          } catch (err) {
            itemCompleted = true;
            setItemProgress((prev) => ({ ...prev, [target.item_id]: "failed" }));

            if (err instanceof HTTPError && err.response.status === 422) {
              let reason = GUARD_REJECTED_TITLE;
              try {
                const body = await err.response.json<{ detail?: { reason?: string } }>();
                if (body?.detail?.reason) {
                  reason = body.detail.reason;
                }
              } catch {
                // 파싱 실패 시 기본 사유 사용
              }
              await sendExtensionNotice(GUARD_REJECTED_TITLE, reason);
              await sendExtensionProgress({
                kind: "result",
                status: "FAILED",
                reason,
              });
            } else {
              await sendExtensionProgress({
                kind: "result",
                status: "FAILED",
                reason: "일시적 오류로 건너뜁니다",
              });
            }
            break;
          }
        }
      }

      // 4. cart_check
      await sendExtensionProgress({ kind: "target", name: "장바구니 검수" });
      let checkCompleted = false;
      let checkStepResult: StepResult | null = null;

      while (!checkCompleted) {
        try {
          const stepRes = await stepOrderAutomation(runId, {
            target: "cart_check",
            result: checkStepResult,
            non_wow_prices: accumulatedNonWowPrices,
          });
          accumulatedNonWowPrices = [];

          if ("action" in stepRes && stepRes.action) {
            const runRes = await runExtension(stepRes.action);
            if (!runRes.ok && runRes.error === TAB_CLOSED_ERROR) {
              setStatus("error");
              setErrorMessage(TAB_CLOSED_MESSAGE);
              return;
            }
            if (!runRes.ok) {
              checkCompleted = true;
              break;
            }
            checkStepResult = runRes.result;
            if (runRes.non_wow_prices && runRes.non_wow_prices.length > 0) {
              accumulatedNonWowPrices.push(...runRes.non_wow_prices);
            }
          } else if ("done" in stepRes && stepRes.done) {
            checkCompleted = true;
          } else {
            checkCompleted = true;
          }
        } catch {
          checkCompleted = true;
          break;
        }
      }

      // 5. finish — 잔여 비회원 가격 수거 및 발주 확정
      try {
        const takeRes = await takeNonWowPrices(true);
        if (takeRes.ok && takeRes.non_wow_prices && takeRes.non_wow_prices.length > 0) {
          accumulatedNonWowPrices.push(...takeRes.non_wow_prices);
        }
      } catch {
        // 비회원 가격 수거 실패해도 finish는 계속
      }

      try {
        const finishRes = await finishOrderAutomation(runId, {
          non_wow_prices: accumulatedNonWowPrices,
        });
        await sendExtensionProgress({ kind: "done" });
        setFinishResult(finishRes);
        setStatus("result");
        onFinished?.(finishRes);
      } catch (err) {
        setStatus("error");
        setErrorMessage("발주 확정 처리에 실패했습니다");
      }
    },
    [recommendationId, onFinished, onConflict],
  );

  return {
    status,
    hasExtension,
    isCheckingExtension,
    isCoupangLoggedIn,
    currentStepInfo,
    itemProgress,
    finishResult,
    errorMessage,
    checkExtension,
    startCarting,
    reset,
  };
}
