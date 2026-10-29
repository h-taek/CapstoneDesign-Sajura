// PWA ↔ 확장 메시지 (04_fe.md §12.3·§12.4). PWA가 externally_connectable로 보낸다.
// 실행 결과 형식은 02_implementation_design.md §3.7 automate/step의 result다.

export const PRODUCT_URL_PREFIX = "https://www.coupang.com/vp/products/";
export const TEXT_MAX = 50;

export interface PageElement {
  ref: string;
  role: string;
  text: string;
  depth: number;
  product_id?: string;
  item_id?: string;
  vendor_item_id?: string;
  non_wow_price?: number;
}

export interface ElementsResult {
  kind: "elements";
  url: string;
  elements: PageElement[];
}

export interface CartAdded {
  item_id: string;
  product_id: string;
  vendor_item_id: string;
  price: number;
}

export interface ActionResult {
  kind: "action";
  ok: boolean;
  page_changed: boolean;
  message: string | null;
  cart_added: CartAdded | null;
}

export type StepResult = ElementsResult | ActionResult;

export interface NonWowPrice {
  item_id: string;
  non_wow_price: number;
  display_price: number;
  unit_price_text: string | null;
}

export type Action =
  | { tool: "read_elements"; args: Record<string, never> }
  | { tool: "click"; args: { ref: string } }
  | { tool: "type_text"; args: { ref: string; text: string } }
  | { tool: "scroll"; args: { direction: "up" | "down" } }
  | { tool: "open_url"; args: { url: string } };

export type Request =
  | { type: "ping" }
  | { type: "open" } // 작업 탭을 열고 로그인 여부를 확인한다. 한 담기의 시작
  | { type: "run"; action: Action } // 동작 하나
  | { type: "take_non_wow_prices"; wait: boolean } // 받은 비회원 가격. wait면 남은 받기를 끝낸 뒤
  | { type: "notice"; title: string; detail: string | null }; // 작업 탭에 알림(일반 텍스트)

export type Response =
  | { ok: true; version: string } // ping
  | { ok: true; logged_in: boolean } // open
  | { ok: true; result: StepResult; non_wow_prices: NonWowPrice[] } // run
  | { ok: true; non_wow_prices: NonWowPrice[] } // take_non_wow_prices
  | { ok: true } // notice
  | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown, max = 2000): v is string => typeof v === "string" && v.length <= max;

function parseAction(v: unknown): Action | null {
  if (!isObj(v) || !isObj(v.args)) return null;
  const a = v.args;
  switch (v.tool) {
    case "read_elements":
      return { tool: "read_elements", args: {} };
    case "click":
      return isStr(a.ref, 20) ? { tool: "click", args: { ref: a.ref } } : null;
    case "type_text":
      return isStr(a.ref, 20) && typeof a.text === "string"
        ? { tool: "type_text", args: { ref: a.ref, text: a.text.slice(0, TEXT_MAX) } }
        : null;
    case "scroll":
      return a.direction === "up" || a.direction === "down"
        ? { tool: "scroll", args: { direction: a.direction } }
        : null;
    case "open_url":
      return isStr(a.url) && a.url.startsWith(PRODUCT_URL_PREFIX)
        ? { tool: "open_url", args: { url: a.url } }
        : null;
    default:
      return null;
  }
}

/** 받은 메시지 검사 — 형식이 다르면 null. */
export function parseRequest(v: unknown): Request | null {
  if (!isObj(v)) return null;
  switch (v.type) {
    case "ping":
    case "open":
      return { type: v.type };
    case "run": {
      const action = parseAction(v.action);
      return action ? { type: "run", action } : null;
    }
    case "take_non_wow_prices":
      return { type: "take_non_wow_prices", wait: v.wait === true };
    case "notice":
      return isStr(v.title, 100) && (v.detail === null || isStr(v.detail, 500))
        ? { type: "notice", title: v.title, detail: v.detail }
        : null;
    default:
      return null;
  }
}
