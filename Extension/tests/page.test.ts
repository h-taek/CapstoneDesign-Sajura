// 쿠팡 탭 안의 동작 — 클릭·입력·담기 완료·비회원 가격 받기·알림 (04_fe.md §12.4·§12.5·§12.7)

import {
  cartAddedAppeared,
  click,
  fetchNonWow,
  loggedIn,
  readPage,
  showNotice,
  typeText,
} from "../src/page";
import { CART_URL, PRODUCT_URL, SEARCH_URL, load } from "./helpers";

const refOf = (doc: Document, url: string, pred: (t: string, role: string) => boolean): string => {
  const page = readPage(doc, url);
  const el = page.elements.find((e) => pred(e.text, e.role));
  if (!el) throw new Error("요소 없음");
  return el.ref;
};

describe("클릭", () => {
  it("없는 번호면 '요소 없음'", async () => {
    const doc = load("search");
    readPage(doc, SEARCH_URL);
    expect(await click(doc, SEARCH_URL, "9999")).toEqual({
      ok: false,
      message: "요소 없음",
      cart_added: null,
    });
  });

  it("링크는 새 탭 속성을 지우고 누른다", async () => {
    const doc = load("search");
    const ref = refOf(doc, SEARCH_URL, (t, r) => r === "link" && t.startsWith("국내산 울팜"));
    const a = doc.querySelector("#product-list a") as HTMLAnchorElement;
    let clicked = false;
    a.addEventListener("click", (e) => {
      clicked = true;
      e.preventDefault();
    });
    const r = await click(doc, SEARCH_URL, ref);
    expect(r.ok).toBe(true);
    expect(clicked).toBe(true);
    expect(a.hasAttribute("target")).toBe(false);
  });

  it("상품 페이지 담기 버튼 — 담기 완료가 새로 나타나면 담기 결과", async () => {
    const doc = load("product");
    const ref = refOf(doc, PRODUCT_URL, (t, r) => r === "button" && t === "장바구니 담기");
    doc.querySelector(".prod-cart-btn")?.addEventListener("click", () => {
      setTimeout(() => doc.body.insertAdjacentHTML("beforeend", "<div>990원 할인받고 담기 완료</div>"), 100);
    });
    expect(await click(doc, PRODUCT_URL, ref)).toEqual({
      ok: true,
      message: null,
      cart_added: {
        product_id: "8783459207",
        item_id: "28626905951",
        vendor_item_id: "92548976689",
        price: 4910,
      },
    });
  });

  it("리뷰에 같은 말이 있어도 새로 늘어난 것만 담기 완료로 본다", () => {
    const review = "장바구니에 담겼습니다 라는 말 보고 바로 샀어요";
    expect(cartAddedAppeared(review, review)).toBe(false);
    expect(cartAddedAppeared(review, `${review} 상품이 장바구니에 담겼습니다`)).toBe(true);
  });

  it("담기 버튼이 아니면 담기 완료를 기다리지 않는다", async () => {
    const doc = load("product");
    const ref = refOf(doc, PRODUCT_URL, (t) => t === "수량빼기");
    const start = Date.now();
    expect((await click(doc, PRODUCT_URL, ref)).cart_added).toBeNull();
    expect(Date.now() - start).toBeLessThan(1500);
  });
});

describe("입력", () => {
  it("값을 넣고 input·change 이벤트를 보낸다", () => {
    const doc = load("search");
    const ref = refOf(doc, SEARCH_URL, (_, r) => r === "textbox");
    const input = doc.querySelector("input[name=q]") as HTMLInputElement;
    const events: string[] = [];
    input.addEventListener("input", () => events.push("input"));
    input.addEventListener("change", () => events.push("change"));
    expect(typeText(ref, "계란").ok).toBe(true);
    expect(input.value).toBe("계란");
    expect(events).toEqual(["input", "change"]);
  });

  it("입력칸이 아니면 실패", () => {
    const doc = load("cart");
    const ref = refOf(doc, CART_URL, (t) => t === "삭제");
    expect(typeText(ref, "x")).toMatchObject({ ok: false, message: "입력칸이 아님" });
  });
});

it("로그인 확인 — 머리말 '로그아웃' 링크", () => {
  expect(loggedIn(load("search"))).toBe(false);
  expect(loggedIn(load("cart"))).toBe(true);
});

describe("비회원 가격 받기", () => {
  const html = (body: string, status = 200) =>
    vi.fn(async () => new Response(body, { status })) as unknown as typeof fetch;
  const url = "https://www.coupang.com/vp/products/7700?itemId=3301&vendorItemId=3300";

  it("받은 HTML의 nonWowMemberPrice", async () => {
    const f = html('self.__next_f.push([1,"{\\"nonWowMemberPrice\\":{\\"price\\":9900}}"])');
    expect(await fetchNonWow(url, f)).toEqual({ ok: true, price: 9900 });
    expect(f).toHaveBeenCalledWith(url, { credentials: "include" });
  });

  it("차단 페이지·오류 응답·상품 페이지가 아닌 주소는 실패", async () => {
    expect(await fetchNonWow(url, html("요청하신 페이지의 사용권한이 없습니다"))).toEqual({ ok: false });
    expect(await fetchNonWow(url, html("", 403))).toEqual({ ok: false });
    const f = html("");
    expect(await fetchNonWow("https://evil.example/vp/products/1", f)).toEqual({ ok: false });
    expect(f).not.toHaveBeenCalled();
  });
});

it("거부 사유는 HTML로 해석하지 않는다", () => {
  const doc = load("search");
  showNotice(doc, "요청이 거부되었습니다", '<img src=x onerror="alert(1)">상품명에 지시');
  const box = doc.getElementById("sajura-notice") as HTMLElement;
  expect(box.querySelector("img")).toBeNull();
  expect(box.textContent).toContain('<img src=x onerror="alert(1)">상품명에 지시');
  // 알림은 다음 요소 목록에 섞이지 않는다
  expect(readPage(doc, SEARCH_URL).elements.some((e) => e.text.includes("거부"))).toBe(false);
});
