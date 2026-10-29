// 요소 목록 — 저장한 검색·상품·장바구니 화면 (04_fe.md §12.4·§12.5)

import { buildElements, pageProduct, priceOf } from "../src/elements";
import type { PageElement } from "../src/messages";
import { CART_URL, PRODUCT_URL, SEARCH_URL, load } from "./helpers";

/** 서버(read_cards)와 같은 방법으로 상품 요소 아래 깊이 요소를 모은다. */
function below(elements: PageElement[], i: number): PageElement[] {
  const out: PageElement[] = [];
  for (const c of elements.slice(i + 1)) {
    if (c.depth <= elements[i].depth) break;
    out.push(c);
  }
  return out;
}

describe("검색 결과", () => {
  const { elements, refs, wowCards } = buildElements(load("search"), SEARCH_URL);
  const cards = elements.map((e, i) => [e, i] as const).filter(([e]) => e.item_id);

  it("카드 링크에 상품 고유 ID와 상품명", () => {
    const [card] = cards[0];
    expect(card).toMatchObject({
      role: "link",
      text: "국내산 울팜 아삭 달달 단단한 창녕 양파, 1개, 양파(중) 1kg",
      product_id: "8783459207",
      item_id: "28626905951",
      vendor_item_id: "92548976689",
    });
  });

  it("가격·할인 표시·단위가격·별점·리뷰 수가 카드 아래 깊이에 있다", () => {
    const [, i] = cards[0];
    const texts = below(elements, i).map((e) => [e.role, e.text]);
    expect(texts).toContainEqual(["deletion", "7,900원"]);
    expect(texts).toContainEqual(["text", "4,910원"]);
    expect(texts).toContainEqual(["text", "(100g당 491원)"]);
    expect(texts).toContainEqual(["text", "쿠폰할인"]);
    expect(texts).toContainEqual(["text", "별점 4.5"]);
    expect(texts).toContainEqual(["text", "( 9,057 )"]);
    // 서버 규칙: 취소선이 아닌 첫 'N원'이 표시 가격
    const display = below(elements, i)
      .filter((e) => e.role !== "deletion")
      .map((e) => priceOf(e.text))
      .find((p) => p !== null);
    expect(display).toBe(4910);
  });

  it("상품명은 카드 링크 글자로 한 번만 담는다", () => {
    const [, i] = cards[0];
    const name = elements[i].text;
    expect(below(elements, i).filter((e) => e.text === name && e.role === "text")).toEqual([]);
  });

  it("글자 없는 그림은 파일 이름 — 로켓프레시", () => {
    const [, i] = cards[1];
    expect(below(elements, i)).toContainEqual(
      expect.objectContaining({ role: "image", text: "logo_fresh_medium.png" }),
    );
  });

  it("광고 표시와 글자 없는 버튼도 담는다", () => {
    const [, i] = cards[2];
    const roles = below(elements, i).map((e) => `${e.role}:${e.text}`);
    expect(roles).toContain("text:광고");
    expect(roles).toContain("button:");
  });

  it("숨긴 요소는 빼고, 번호는 1부터 차례로", () => {
    expect(elements.some((e) => e.text === "식품")).toBe(false);
    expect(elements.map((e) => e.ref)).toEqual(elements.map((_, i) => String(i + 1)));
    expect(refs.get("1")).toBeDefined();
  });

  it("검색창·검색 버튼", () => {
    expect(elements).toContainEqual(expect.objectContaining({ role: "textbox", text: "양파" }));
    expect(elements).toContainEqual(expect.objectContaining({ role: "button", text: "" }));
  });

  it("와우 할인 카드만, 같은 itemId는 한 번", () => {
    expect(wowCards).toEqual([
      {
        item_id: "3301",
        url: "https://www.coupang.com/vp/products/7700?itemId=3301&vendorItemId=3300",
        display_price: 9600,
        unit_price_text: "(100g당 1,200원)",
      },
    ]);
  });
});

describe("상품 페이지", () => {
  const { elements } = buildElements(load("product"), PRODUCT_URL);
  const i = elements.findIndex((e) => e.role === "heading");

  it("제목에 상품 고유 ID와 비회원 가격", () => {
    expect(elements[i]).toMatchObject({
      text: "국내산 울팜 아삭 달달 단단한 창녕 양파, 1개, 양파(중) 1kg",
      product_id: "8783459207",
      item_id: "28626905951",
      vendor_item_id: "92548976689",
      non_wow_price: 4910,
    });
  });

  it("가격 영역을 제목 아래 깊이로 옮긴다 — 취소선은 deletion", () => {
    const texts = below(elements, i).map((e) => `${e.role}:${e.text}`);
    expect(texts).toEqual([
      "text:37%",
      "text:4,910원",
      "text:(100g당 491원)",
      "deletion:7,900원",
      "text:990원",
      "text:쿠폰할인",
      "deletion:5,900원",
    ]);
    // 가격 영역은 원래 자리에 다시 나오지 않는다
    expect(elements.filter((e) => e.text === "37%")).toHaveLength(1);
  });

  it("담기 결과용 상품 — 제목의 ID와 첫 표시 가격", () => {
    expect(pageProduct(elements)).toEqual({
      product_id: "8783459207",
      item_id: "28626905951",
      vendor_item_id: "92548976689",
      price: 4910,
    });
  });

  it("주소에 vendorItemId가 없으면 페이지 데이터에서 읽는다", () => {
    const linked = "https://www.coupang.com/vp/products/8783459207?itemId=28626905951";
    const head = buildElements(load("product"), linked).elements.find((e) => e.role === "heading");
    expect(head?.vendor_item_id).toBe("92548976689");
  });

  it("수량 버튼·담기 버튼", () => {
    const buttons = elements.filter((e) => e.role === "button").map((e) => e.text);
    expect(buttons).toEqual(expect.arrayContaining(["수량빼기", "수량더하기", "장바구니 담기"]));
  });
});

describe("장바구니", () => {
  const { elements } = buildElements(load("cart"), CART_URL);

  it("역할 없는 '삭제' 글자도 누를 수 있는 요소로 담는다", () => {
    expect(elements).toContainEqual(expect.objectContaining({ role: "text", text: "삭제" }));
  });

  it("수량 칸과 글자 없는 아이콘은 클래스 이름", () => {
    const names = elements.filter((e) => e.role === "image").map((e) => e.text);
    expect(names).toContain("minus-icon minus-icon-disable");
    expect(names).toContain("plus-icon");
    expect(elements).toContainEqual(expect.objectContaining({ role: "textbox", text: "1" }));
    expect(elements).toContainEqual(expect.objectContaining({ role: "checkbox", text: "선택됨" }));
  });

  it("상품 ID가 없는 장바구니 링크는 상품 카드로 보지 않는다", () => {
    expect(elements.some((e) => e.item_id)).toBe(false);
  });
});
