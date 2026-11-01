// 사주라 크롬 확장 다리 (04_fe.md §12.3·§12.6·§12.7, Extension/src/messages.ts).
// PWA가 externally_connectable(chrome.runtime.sendMessage)로 확장에 메시지를 보낸다.
import type { AgentCall } from "../api/endpoints/orders";

export type Status = "ADDED" | "CHECK_NEEDED" | "FAILED";

export interface PageElement {
  ref: string;
  role: string;
  text: string;
  depth: number;
  product_id?: string | null;
  item_id?: string | null;
  vendor_item_id?: string | null;
  non_wow_price?: number | null;
}

export interface ElementsResult {
  kind: "elements";
  url: string;
  elements: PageElement[];
}

export interface CartAdded {
  item_id: string;
  product_id: string;
  vendor_item_id?: string | null;
  price: number;
}

export interface ActionResult {
  kind: "action";
  ok: boolean;
  page_changed: boolean;
  message?: string | null;
  cart_added?: CartAdded | null;
}

export type StepResult = ElementsResult | ActionResult;

export interface NonWowPrice {
  item_id: string;
  non_wow_price: number;
  display_price: number;
  unit_price_text?: string | null;
}

export type Action =
  | { tool: "read_elements"; args: Record<string, never> }
  | { tool: "click"; args: { ref: string } }
  | { tool: "type_text"; args: { ref: string; text: string } }
  | { tool: "scroll"; args: { direction: "up" | "down" } }
  | { tool: "open_url"; args: { url: string } };

export type Progress =
  | { kind: "target"; name: string }
  | { kind: "result"; status: Status; reason: string | null }
  | { kind: "done" };

export type Request =
  | { type: "ping" }
  | { type: "open" }
  | { type: "run"; action: Action | AgentCall }
  | { type: "take_non_wow_prices"; wait: boolean }
  | { type: "notice"; title: string; detail: string | null }
  | { type: "progress"; progress: Progress };

export interface ErrorResponse {
  ok: false;
  error: string;
}

export type PingResponse = { ok: true; version: string } | ErrorResponse;

export type OpenResponse = { ok: true; logged_in: boolean } | ErrorResponse;

export type RunResponse =
  | { ok: true; result: StepResult; non_wow_prices: NonWowPrice[] }
  | ErrorResponse;

export type TakeNonWowPricesResponse = { ok: true; non_wow_prices: NonWowPrice[] } | ErrorResponse;

export type AckResponse = { ok: true } | ErrorResponse;

export type Response =
  | { ok: true; version: string }
  | { ok: true; logged_in: boolean }
  | { ok: true; result: StepResult; non_wow_prices: NonWowPrice[] }
  | { ok: true; non_wow_prices: NonWowPrice[] }
  | { ok: true }
  | ErrorResponse;

// 04_fe.md §12.6 비로그인 알림 및 §12.7 분류기 거부 제목 상수.
export const LOGIN_NOTICE = {
  title: "쿠팡에 로그인해 주세요",
  detail: "로그인하지 않으면 로켓프레시 상품은 담을 수 없습니다",
} as const;

export const GUARD_REJECTED_TITLE = "요청이 거부되었습니다";

// 확장은 페이지 로딩 20초·비회원 가격 대기 60초를 스스로 끊는다. 그보다 길게 기다린다
export const DEFAULT_EXTENSION_TIMEOUT_MS = 90_000;
export const PING_TIMEOUT_MS = 3_000;

// 점주가 쿠팡 작업 탭을 닫았을 때 확장이 돌려주는 오류 (Extension/src/background.ts)
export const TAB_CLOSED_ERROR = "작업 탭이 없습니다";

export interface ExtensionCallOptions {
  extensionId?: string;
  timeoutMs?: number;
}

interface ChromeRuntimeLike {
  lastError?: { message?: string } | undefined;
  sendMessage?: (
    extensionId: string,
    message: unknown,
    callback?: (response: unknown) => void,
  ) => unknown;
}

function getChromeRuntime(): ChromeRuntimeLike | undefined {
  return (globalThis as { chrome?: { runtime?: ChromeRuntimeLike } }).chrome?.runtime;
}

export function getExtensionId(overrideId?: string): string {
  if (overrideId !== undefined) return overrideId.trim();
  const envId = import.meta.env.VITE_EXTENSION_ID;
  return typeof envId === "string" ? envId.trim() : "";
}

export function isExtensionRuntimeAvailable(overrideId?: string): boolean {
  const runtime = getChromeRuntime();
  const extId = getExtensionId(overrideId);
  return Boolean(extId && runtime && typeof runtime.sendMessage === "function");
}

function normalizeResponse<T extends Response>(raw: unknown): T | ErrorResponse {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "확장 없음" };
  }
  const obj = raw as { ok?: unknown; error?: unknown };
  if (obj.ok === true) {
    return raw as T;
  }
  if (obj.ok === false) {
    return {
      ok: false,
      error: typeof obj.error === "string" && obj.error ? obj.error : "확장 오류",
    };
  }
  return { ok: false, error: "확장 없음" };
}

// chrome.runtime.sendMessage 호출 — 확장이 없거나 시간 초과·오류면 { ok: false, error }를 돌려준다.
export function sendExtensionMessage<T extends Response = Response>(
  request: Request,
  options: ExtensionCallOptions = {},
): Promise<T | ErrorResponse> {
  const runtime = getChromeRuntime();
  const sendMessage = runtime?.sendMessage;
  const extId = getExtensionId(options.extensionId);
  if (!extId || !runtime || typeof sendMessage !== "function") {
    return Promise.resolve({ ok: false, error: "확장 없음" });
  }

  const timeoutMs =
    options.timeoutMs ?? (request.type === "ping" ? PING_TIMEOUT_MS : DEFAULT_EXTENSION_TIMEOUT_MS);

  return new Promise<T | ErrorResponse>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ ok: false, error: "시간 초과" });
    }, timeoutMs);

    const finish = (res: T | ErrorResponse) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(res);
    };

    try {
      const maybePromise = sendMessage.call(runtime, extId, request, (raw: unknown) => {
        if (settled) return;
        const lastError = runtime.lastError?.message;
        if (lastError) {
          finish({ ok: false, error: lastError });
          return;
        }
        finish(normalizeResponse<T>(raw));
      });

      if (maybePromise && typeof (maybePromise as Promise<unknown>).then === "function") {
        (maybePromise as Promise<unknown>).then(
          (raw) => {
            if (settled) return;
            const lastError = runtime.lastError?.message;
            if (lastError) {
              finish({ ok: false, error: lastError });
              return;
            }
            finish(normalizeResponse<T>(raw));
          },
          (err: unknown) => {
            finish({
              ok: false,
              error: err instanceof Error && err.message ? err.message : "확장 없음",
            });
          },
        );
      }
    } catch (err) {
      finish({
        ok: false,
        error: err instanceof Error && err.message ? err.message : "확장 없음",
      });
    }
  });
}

// ping — 확장 설치·활성 여부 및 버전 확인.
export function pingExtension(options?: ExtensionCallOptions): Promise<PingResponse> {
  return sendExtensionMessage<PingResponse>({ type: "ping" }, options);
}

// open — 쿠팡 작업 탭을 열고 로그인 여부 확인.
export function openExtension(options?: ExtensionCallOptions): Promise<OpenResponse> {
  return sendExtensionMessage<OpenResponse>({ type: "open" }, options);
}

export const openCoupangTab = openExtension;

// run — 담기 에이전트가 정한 동작 하나를 실행하고 결과와 비회원 가격을 받는다.
export function runExtension(
  action: Action | AgentCall,
  options?: ExtensionCallOptions,
): Promise<RunResponse> {
  return sendExtensionMessage<RunResponse>({ type: "run", action }, options);
}

export const run = runExtension;

// take_non_wow_prices — 확장이 뒤에서 받은 비회원 가격을 수거한다 (finish 직전에는 wait: true).
export function takeNonWowPrices(
  wait: boolean,
  options?: ExtensionCallOptions,
): Promise<TakeNonWowPricesResponse> {
  return sendExtensionMessage<TakeNonWowPricesResponse>(
    { type: "take_non_wow_prices", wait },
    options,
  );
}

// notice — 진행 패널에 일반 텍스트 알림 말풍선을 더한다 (§12.6 비로그인, §12.7 거부 사유).
export function sendExtensionNotice(
  title: string,
  detail: string | null = null,
  options?: ExtensionCallOptions,
): Promise<AckResponse> {
  return sendExtensionMessage<AckResponse>({ type: "notice", title, detail }, options);
}

export const notice = sendExtensionNotice;

// progress — 진행 패널에 대상·결과·끝 말풍선을 더한다 (§12.8).
export function sendExtensionProgress(
  progressPayload: Progress,
  options?: ExtensionCallOptions,
): Promise<AckResponse> {
  return sendExtensionMessage<AckResponse>(
    { type: "progress", progress: progressPayload },
    options,
  );
}

export const reportProgress = sendExtensionProgress;
