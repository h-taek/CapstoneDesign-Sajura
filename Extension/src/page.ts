// 쿠팡 탭 안의 동작 (04_fe.md §12.4~§12.7). content.ts가 background의 명령을 받아 부른다.
// DOM만 다루고 chrome API는 쓰지 않는다 — 저장한 화면으로 시험한다.

import { DIALOGS, WORK_FLAG } from "./dialogGuard";
import { type Snapshot, buildElements, pageProduct, parseNonWowPrice } from "./elements";
import type { ClickTarget } from "./log";
import { requestMainClick } from "./mainClick";
import type { CartAdded, ElementsResult } from "./messages";
import { PRODUCT_URL_PREFIX } from "./messages";
import { type FetchResult, isBlockedPage } from "./nonwow";

export const CART_ADDED_TEXTS = ["담기 완료", "장바구니에 담겼습니다"];
const CART_WAIT_MS = 4000;
const POLL_MS = 200;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface ClickResult {
  ok: boolean;
  message: string | null;
  cart_added: CartAdded | null;
}

let snapshot: Snapshot | null = null;

/** 이 탭을 작업 탭으로 표시한다 — 페이지 쪽 스크립트가 알림·확인 창을 띄우지 않고 글을 적어 둔다. */
export function claimWorkTab(doc: Document): void {
  if (doc.documentElement.dataset[WORK_FLAG] === "1") return;
  doc.documentElement.dataset[WORK_FLAG] = "1";
  try {
    // 다음 페이지가 열리는 맨 처음부터 알림 창을 막게 탭에 남긴다 (dialogGuard.ts)
    doc.defaultView?.sessionStorage.setItem(WORK_FLAG, "1");
  } catch {
    // 저장소를 못 쓰면 이 페이지만 막는다
  }
}

/** 문서에 적힌 알림 글을 꺼낸다 — 동작 결과의 메시지나 요소 목록 끝의 '알림'으로 LLM에 넘긴다. */
export function takeDialogs(doc: Document = document): string[] {
  const root = doc.documentElement;
  const raw = root.dataset[DIALOGS];
  delete root.dataset[DIALOGS];
  try {
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

const hasDialogs = (doc: Document) => Boolean(doc.documentElement.dataset[DIALOGS]);

export function readPage(
  doc: Document,
  url: string,
): ElementsResult & { wowCards: Snapshot["wowCards"]; blocked: boolean } {
  snapshot = buildElements(doc, url);
  // 앞선 동작 뒤에 뜬 알림 창은 목록 끝에 '알림' 요소로 붙인다. 번호는 누를 수 없는 이름
  const alerts = takeDialogs(doc).map((text, i) => ({ ref: `알림${i + 1}`, role: "alert", text, depth: 0 }));
  return {
    kind: "elements",
    url: url.slice(0, 2000),
    elements: [...snapshot.elements, ...alerts],
    wowCards: snapshot.wowCards,
    blocked: isBlockedPage(pageText(doc)), // 쿠팡 차단 화면 — background가 새로고침한다
  };
}

function target(ref: string): Element | null {
  const el = snapshot?.refs.get(ref) ?? null;
  return el?.isConnected ? el : null;
}

function pageText(doc: Document): string {
  const body = doc.body as HTMLElement | null;
  return body?.innerText ?? body?.textContent ?? "";
}

const count = (text: string, word: string) => text.split(word).length - 1;

/** 담기 완료 표시가 클릭 전보다 새로 나타났는가. 리뷰 글에 같은 말이 있어도 늘어난 것만 본다. */
export function cartAddedAppeared(before: string, after: string): boolean {
  return CART_ADDED_TEXTS.some((w) => count(after, w) > count(before, w));
}

/** 담기 버튼('장바구니 담기' 등)을 누른 것인가 — 그때만 담기 완료 표시를 기다린다. */
function isCartButton(el: Element): boolean {
  const btn = el.closest("button, a, [role=button]") ?? el;
  return (btn.textContent ?? "").includes("담기");
}

/** 진행 패널 문장에 쓸 누를 요소의 이름 (§12.8). 그림 파일 이름·아이콘 클래스 이름은 글자로 치지 않는다. */
export function clickTarget(ref: string): ClickTarget {
  const el = target(ref);
  const e = snapshot?.elements.find((x) => x.ref === ref);
  const text = e && !snapshot?.names.has(ref) && e.text.trim() ? e.text : null;
  return { text, kind: el?.closest("a[href]") ? "링크" : "버튼" };
}

/** point: 누르기 직전에 부른다 — 진행 패널 커서를 요소로 옮긴다. */
export async function click(
  doc: Document,
  url: string,
  ref: string,
  point?: (el: Element) => Promise<void>,
): Promise<ClickResult> {
  const found = target(ref);
  if (!found) return { ok: false, message: "요소 없음", cart_added: null };
  if (!snapshot?.elements.find((e) => e.ref === ref)?.clickable) {
    return { ok: false, message: "누를 수 없는 요소", cart_added: null };
  }
  // 링크·버튼 안의 글자를 골랐으면 그 링크·버튼을 누른다 — 카드 안 '할인' 글자는 눌러도 열리지 않았다
  const el = found.closest("button, a[href], [role=button]") ?? found;
  // 링크는 새 탭으로 열리지 않게 한다
  el.closest("a")?.removeAttribute("target");
  // 화면 밖 버튼은 눌러도 담기가 되지 않았다(research/backend/16 §6.12) — 먼저 화면 안으로
  el.scrollIntoView?.({ block: "center" });
  await sleep(300);
  await point?.(el);
  const waitCart = url.startsWith(PRODUCT_URL_PREFIX) && isCartButton(el);
  const before = waitCart ? pageText(doc) : "";
  // `javascript:` 링크는 여기서 누르면 확장 CSP가 막는다 — 페이지 쪽에서 누른다
  if (/^\s*javascript:/i.test(el.getAttribute("href") ?? "")) requestMainClick(doc, el as HTMLElement);
  else (el as HTMLElement).click();
  if (!waitCart) return { ok: true, message: null, cart_added: null };
  for (let t = 0; t < CART_WAIT_MS; t += POLL_MS) {
    await sleep(POLL_MS);
    if (hasDialogs(doc)) break; // 담기 대신 알림 창이 떴다
    if (cartAddedAppeared(before, pageText(doc))) {
      const product = pageProduct(buildElements(doc, url).elements);
      return { ok: true, message: product ? null : "담은 상품을 읽지 못함", cart_added: product };
    }
  }
  return { ok: true, message: null, cart_added: null };
}

export function typeText(ref: string, text: string): ClickResult {
  const el = target(ref);
  if (!el) return { ok: false, message: "요소 없음", cart_added: null };
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
    return { ok: false, message: "입력칸이 아님", cart_added: null };
  }
  el.focus();
  // 화면 프레임워크가 값 바뀜을 알아채게 원래 setter로 넣고 이벤트를 보낸다
  const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, text);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return { ok: true, message: null, cart_added: null };
}

export function scroll(win: Window, direction: "up" | "down"): void {
  win.scrollBy({ top: (direction === "down" ? 1 : -1) * win.innerHeight * 0.8 });
}

export function loggedIn(doc: Document): boolean {
  return doc.querySelector('a[href*="logout"]') !== null;
}

/** 와우 카드 링크 받기 — 같은 출처 fetch(쿠키 포함). 상품 페이지 주소만. */
export async function fetchNonWow(url: string, fetcher: typeof fetch = fetch): Promise<FetchResult> {
  if (!url.startsWith(PRODUCT_URL_PREFIX)) return { ok: false };
  const res = await fetcher(url, { credentials: "include" });
  if (!res.ok) return { ok: false };
  const html = await res.text();
  if (isBlockedPage(html)) return { ok: false };
  return { ok: true, price: parseNonWowPrice(html) };
}
