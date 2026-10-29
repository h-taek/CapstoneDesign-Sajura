// 요소 목록 만들기 (04_fe.md §12.4·§12.5). 쿠팡 화면 구조 실측: research/backend/16 §6.12.
//
// 글자가 있는 요소, 링크·버튼·입력칸, 그림을 화면 순서대로 번호를 붙여 담는다. 깊이는 담긴
// 조상 요소 수다. 상품 고유 ID는 검색 결과 카드 링크와 상품 페이지 제목에 붙이고, 상품 페이지의
// 가격 영역은 제목 아래 깊이로 옮긴다. 서버는 ID가 붙은 요소 아래 깊이의 요소를 그 상품 값으로 읽는다.

import type { PageElement } from "./messages";
import { MASK, headerNameZone, isMyCoupangLabel, maskShapes } from "./privacy";

const SKIP = new Set(["script", "style", "noscript", "template", "iframe", "head", "link", "meta", "svg"]);
const TEXT_MAX = 300;
const DIGITS = /^\d{1,20}$/;
const PHOTO = /\.(jpe?g|webp)$/i;
const DISCOUNT_LABELS = new Set(["할인", "쿠폰할인", "와우할인", "와우쿠폰할인"]);
// 서버의 쿠팡 단위가격 모양과 같다 — '100g당 2,348원'·'(1구당 430원)'
const UNIT_PRICE = /^\(?\s*([\d.,]+)\s*([^\d\s]+?)\s*당\s*([\d,]+)\s*원\s*\)?$/;

export interface ProductIds {
  product_id: string;
  item_id: string;
  vendor_item_id: string;
}

/** 와우 할인 카드 — 확장이 링크를 뒤에서 받아 비회원 가격을 읽는다 (§12.5). */
export interface WowCard {
  item_id: string;
  url: string;
  display_price: number;
  unit_price_text: string | null;
}

export interface Snapshot {
  elements: PageElement[];
  refs: Map<string, Element>; // 번호 → 요소. 그 화면에서만 쓴다
  wowCards: WowCard[];
}

/** 쿠팡 상품 페이지 주소의 상품 고유 ID. vendorItemId가 주소에 없으면 null로 둔다. */
export function productIds(
  href: string,
  base: string,
): (Omit<ProductIds, "vendor_item_id"> & { vendor_item_id: string | null }) | null {
  let u: URL;
  try {
    u = new URL(href, base);
  } catch {
    return null;
  }
  if (!/(^|\.)coupang\.com$/.test(u.hostname)) return null;
  const m = u.pathname.match(/^\/vp\/products\/(\d{1,20})\/?$/);
  const item = u.searchParams.get("itemId");
  const vendor = u.searchParams.get("vendorItemId");
  if (!m || !item || !DIGITS.test(item)) return null;
  return {
    product_id: m[1],
    item_id: item,
    vendor_item_id: vendor && DIGITS.test(vendor) ? vendor : null,
  };
}

/** 페이지 데이터의 비회원 가격 — `nonWowMemberPrice":{"price":4910` (따옴표가 \" 로 바뀐 모양 포함). */
export function parseNonWowPrice(html: string): number | null {
  const m = html.match(/nonWowMemberPrice\\*"\s*:\s*\{\s*\\*"price\\*"\s*:\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

/** 'N원' 글자의 금액. 서버(read_cards)와 같은 규칙. */
export function priceOf(text: string): number | null {
  const t = text.trim();
  if (!t.endsWith("원")) return null;
  const digits = t.slice(0, -1).trim().replace(/,/g, "");
  return /^\d+$/.test(digits) && Number(digits) > 0 ? Number(digits) : null;
}

export const isUnitPriceText = (text: string): boolean => UNIT_PRICE.test(text.trim());

const clip = (text: string): string => text.replace(/\s+/g, " ").trim().slice(0, TEXT_MAX);

function ownText(el: Element): string {
  let s = "";
  for (const n of el.childNodes) if (n.nodeType === 3) s += ` ${n.textContent ?? ""}`;
  return clip(s);
}

function className(el: Element): string {
  const c = el.getAttribute("class");
  return c ?? "";
}

function hidden(el: Element): boolean {
  if (el.hasAttribute("hidden") || el.getAttribute("aria-hidden") === "true") return true;
  if (el instanceof HTMLInputElement && el.type === "hidden") return true;
  // 실제 크롬에서는 화면 계산으로 숨김(display:none 등)을 거른다. 화면 밖은 숨김이 아니다
  const check = (el as Element & { checkVisibility?: () => boolean }).checkVisibility;
  return typeof check === "function" && !check.call(el);
}

function isDeletion(el: Element): boolean {
  if (["del", "s", "strike"].includes(el.localName)) return true;
  if (className(el).includes("line-through")) return true;
  try {
    return getComputedStyle(el).textDecorationLine.includes("line-through");
  } catch {
    return false;
  }
}

function fileName(src: string): string {
  return src.split(/[?#]/)[0].split("/").pop() ?? "";
}

/** 글자 없는 아이콘의 이름 — 배경 그림 파일 이름, 없으면 'icon'이 든 클래스 이름. */
function iconName(el: Element): string | null {
  const icons = className(el)
    .split(/\s+/)
    .filter((c) => /icon/i.test(c))
    .map((c) => c.replace(/^(twc-|fw-)?(bg-)?/, ""));
  if (icons.length) return [...new Set(icons)].join(" ");
  try {
    const bg = getComputedStyle(el).backgroundImage;
    const m = bg.match(/url\("?([^")]+)"?\)/);
    if (m && !m[1].startsWith("data:")) return fileName(m[1]);
  } catch {
    // 화면 계산을 못 하면 이름 없음
  }
  return null;
}

/** 요소 하나의 종류와 글자. 담지 않을 요소면 null. */
function describe(el: Element): { role: string; text: string } | null {
  const tag = el.localName;
  if (el instanceof HTMLInputElement) {
    if (el.type === "checkbox" || el.type === "radio") {
      return { role: el.type, text: el.checked ? "선택됨" : "선택 안 됨" };
    }
    return { role: "textbox", text: clip(el.value || el.placeholder || "") };
  }
  if (el instanceof HTMLTextAreaElement) return { role: "textbox", text: clip(el.value) };
  if (el instanceof HTMLSelectElement) {
    return { role: "select", text: clip(el.selectedOptions[0]?.textContent ?? "") };
  }
  if (el instanceof HTMLImageElement) {
    const alt = clip(el.alt);
    if (alt) return { role: "image", text: alt };
    // 글자 없는 그림은 배지 파일 이름만. 사진(jpg·webp)과 파일 이름 없는 내장 그림(data:)은 뺀다
    const src = el.getAttribute("src") ?? "";
    const name = src.startsWith("data:") ? "" : fileName(src);
    return name && !PHOTO.test(name) ? { role: "image", text: name } : null;
  }
  const label = clip(el.getAttribute("aria-label") ?? "");
  const own = ownText(el);
  const title = clip(el.getAttribute("title") ?? "");
  if (tag === "a" && el.hasAttribute("href")) return { role: "link", text: label || own || title };
  if (tag === "button" || el.getAttribute("role") === "button") {
    return { role: "button", text: label || own || title };
  }
  if (own) {
    if (/^h[1-6]$/.test(tag)) return { role: "heading", text: own };
    return { role: isDeletion(el) ? "deletion" : "text", text: own };
  }
  if (el.children.length === 0) {
    const icon = iconName(el);
    if (icon) return { role: "image", text: icon };
  }
  return null;
}

/** 검색 결과 카드 링크의 상품명 — 상품명 칸, 없으면 사진 설명 글. */
function cardName(a: Element): string {
  const name = a.querySelector('[class*="productName"]');
  if (name?.textContent) return clip(name.textContent);
  const img = a.querySelector("img[alt]");
  return clip(img?.getAttribute("alt") ?? a.textContent ?? "");
}

function rating(el: Element): string | null {
  if (!className(el).includes("ProductRating_productRating")) return null;
  const full = el.querySelectorAll('[class*="fullRating"]').length;
  const half = el.querySelectorAll('[class*="halfRating"]').length;
  return full + half > 0 ? `별점 ${full + half * 0.5}` : null;
}

interface ProductPage {
  title: Element;
  priceBox: Element | null;
  ids: ProductIds;
  nonWow: number | null;
}

/** 상품 페이지면 제목·가격 영역·상품 고유 ID. vendorItemId는 주소, 없으면 페이지 데이터에서. */
function productPage(doc: Document, url: string): ProductPage | null {
  const ids = productIds(url, url);
  const title = doc.querySelector("h1.product-title") ?? doc.querySelector("h1");
  if (!ids || !title) return null;
  const html = doc.documentElement.innerHTML;
  // 연결 상품 주소(/vp/products/{productId}?itemId=…)에는 vendorItemId가 없다. 페이지 데이터의
  // 상품 주소에서 같은 itemId에 붙은 값을 찾는다 (research/backend/16 §6.12)
  const vendor =
    ids.vendor_item_id ??
    html.match(new RegExp(`itemId=${ids.item_id}&(?:amp;)?vendorItemId=(\\d{1,20})`))?.[1] ??
    html.match(new RegExp(`items/${ids.item_id}/vendoritems/(\\d{1,20})`))?.[1] ??
    null;
  if (!vendor) return null;
  return {
    title,
    priceBox: doc.querySelector(".price-container"),
    ids: { ...ids, vendor_item_id: vendor },
    nonWow: parseNonWowPrice(html),
  };
}

export function buildElements(doc: Document, url: string): Snapshot {
  const elements: PageElement[] = [];
  const refs = new Map<string, Element>();
  const cardLinks = new Map<number, string>(); // 상품 카드 링크 요소의 위치 → 링크 주소
  const product = productPage(doc, url);
  const zone = headerNameZone(doc);

  const emit = (el: Element, role: string, text: string, depth: number, extra = {}): number => {
    const ref = String(elements.length + 1);
    elements.push({ ref, role, text, depth, ...extra });
    refs.set(ref, el);
    return elements.length - 1;
  };

  // masked: 머리말 이름 표시 안이라 글자를 모두 가린다. dup: 상품 링크의 상품명과 같은 글자는 다시 담지 않는다
  const walk = (el: Element, depth: number, masked: boolean, dup: string | null, moved = false) => {
    if (SKIP.has(el.localName) || el.id === "sajura-notice" || hidden(el)) return;
    if (product && el === product.priceBox && !moved) return; // 제목 아래로 옮겨 담는다

    if (product && el === product.title) {
      emit(el, "heading", ownText(el) || clip(el.textContent ?? ""), depth, {
        ...product.ids,
        ...(product.nonWow ? { non_wow_price: product.nonWow } : {}),
      });
      if (product.priceBox) walk(product.priceBox, depth + 1, false, null, true);
      return;
    }

    if (el.localName === "a" && el.hasAttribute("href")) {
      const ids = productIds(el.getAttribute("href") ?? "", url);
      if (ids?.vendor_item_id) {
        const name = cardName(el);
        const i = emit(el, "link", name, depth, ids);
        cardLinks.set(i, new URL(el.getAttribute("href") ?? "", url).href);
        for (const c of el.children) walk(c, depth + 1, masked, name);
        return;
      }
    }

    const stars = rating(el);
    if (stars) {
      emit(el, "text", stars, depth);
      for (const c of el.children) walk(c, depth + 1, masked, dup);
      return;
    }

    const info = describe(el);
    if (info === null || (dup !== null && info.text === dup && info.role !== "link")) {
      for (const c of el.children) walk(c, depth, masked, dup);
      return;
    }
    let text = maskShapes(info.text);
    let maskChildren = masked;
    if (masked || isMyCoupangLabel(text)) text = MASK;
    else if (zone?.contains(el) && /님$/.test(text)) {
      // '<이름> 님'이 한 글자 조각이거나, '님'만 떨어져 이름이 앞 요소·자식 요소에 있다
      text = MASK;
      maskChildren = true;
      const prev = elements[elements.length - 1];
      const prevEl = prev && refs.get(prev.ref);
      if (prev && prevEl && zone.contains(prevEl) && !prevEl.contains(el)) prev.text = MASK;
    }
    emit(el, info.role, text, depth);
    for (const c of el.children) walk(c, depth + 1, maskChildren, dup);
  };

  if (doc.body) walk(doc.body, 0, false, null);
  return { elements, refs, wowCards: wowCards(elements, cardLinks) };
}

/** 검색 결과의 와우 할인 카드('와우할인'·'와우쿠폰할인'). 같은 itemId는 처음 카드만. */
function wowCards(elements: PageElement[], cardLinks: Map<number, string>): WowCard[] {
  const out = new Map<string, WowCard>();
  for (const [i, url] of cardLinks) {
    const el = elements[i];
    if (!el.item_id || out.has(el.item_id)) continue;
    const below: PageElement[] = [];
    for (const c of elements.slice(i + 1)) {
      if (c.depth <= el.depth) break;
      below.push(c);
    }
    const label = below.find((c) => DISCOUNT_LABELS.has(c.text.trim()))?.text;
    if (!label?.includes("와우")) continue;
    const display = below
      .filter((c) => c.role !== "deletion")
      .map((c) => priceOf(c.text))
      .find((p) => p !== null);
    if (display == null) continue;
    const unit = below.find((c) => isUnitPriceText(c.text))?.text.trim() ?? null;
    out.set(el.item_id, { item_id: el.item_id, url, display_price: display, unit_price_text: unit });
  }
  return [...out.values()];
}

/** 상품 페이지 요소 목록의 상품 — 제목의 상품 고유 ID와 그 아래 첫 표시 가격 (담기 결과용). */
export function pageProduct(elements: PageElement[]): (ProductIds & { price: number }) | null {
  const i = elements.findIndex((e) => e.role === "heading" && e.item_id && e.vendor_item_id);
  if (i < 0) return null;
  const head = elements[i];
  let price: number | null = null;
  for (const c of elements.slice(i + 1)) {
    if (c.depth <= head.depth) break;
    if (c.role !== "deletion" && (price = priceOf(c.text)) !== null) break;
  }
  if (price === null || !head.product_id || !head.item_id || !head.vendor_item_id) return null;
  return {
    product_id: head.product_id,
    item_id: head.item_id,
    vendor_item_id: head.vendor_item_id,
    price,
  };
}
