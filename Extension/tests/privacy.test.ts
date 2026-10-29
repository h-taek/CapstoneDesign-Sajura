// 개인정보 가리기 (04_fe.md §12.4) — 요소는 남기고 값만 ---

import { buildElements } from "../src/elements";
import { maskShapes } from "../src/privacy";
import { CART_URL, PRODUCT_URL, SEARCH_URL, load } from "./helpers";

describe("위치로 찾는 이름", () => {
  const { elements } = buildElements(load("cart"), CART_URL);
  const all = JSON.stringify(elements);

  it("머리말의 이름 표시와 '마이쿠팡' 링크 설명 글", () => {
    expect(all).not.toContain("홍길동");
    expect(elements.filter((e) => e.text === "---").length).toBeGreaterThanOrEqual(2);
    // 요소는 남긴다
    expect(elements).toContainEqual(expect.objectContaining({ role: "link", text: "로그아웃" }));
    expect(elements).toContainEqual(expect.objectContaining({ role: "link", text: "---" }));
  });

  it("'○○님' 모양만으로는 찾지 않는다 — 머리말 밖은 그대로", () => {
    const doc = load("cart");
    doc.body.insertAdjacentHTML("beforeend", "<p>구매회원님 감사합니다</p>");
    const texts = buildElements(doc, CART_URL).elements.map((e) => e.text);
    expect(texts).toContain("구매회원님 감사합니다");
  });
});

describe("모양으로 찾는 전화번호·이메일·주소", () => {
  it("상품 페이지 판매자 정보", () => {
    const texts = buildElements(load("product"), PRODUCT_URL).elements.map((e) => e.text);
    const all = texts.join("\n");
    expect(all).not.toContain("010-1234-5678");
    expect(all).not.toContain("seller@example.com");
    expect(all).not.toContain("우포로 123");
    expect(texts).toContain("연락처"); // 표의 다른 칸은 남는다
  });

  it("가격·용량·상품 번호는 건드리지 않는다", () => {
    for (const t of ["4,910원", "(100g당 491원)", "양파(중) 10kg × 1개", "92548976689", "( 9,057 )"]) {
      expect(maskShapes(t)).toBe(t);
    }
  });

  it("그림 파일 이름은 가리지 않는다 — '@2x.png'는 이메일, 16진수 속 숫자는 전화번호 모양이다", () => {
    const doc = load("search");
    doc.body.insertAdjacentHTML(
      "beforeend",
      `<img src="https://img1a.coupangcdn.com/image/coupang/search/search_assets_160912@2x.png">
       <img src="https://image.coupangcdn.com/image/bd0101234567c28c36cd488fa0875c0cee56.png">
       <img src="https://image.coupangcdn.com/x.png" alt="문의 010-1234-5678">`,
    );
    const texts = buildElements(doc, SEARCH_URL).elements.map((e) => e.text);
    expect(texts).toContain("search_assets_160912@2x.png");
    expect(texts).toContain("bd0101234567c28c36cd488fa0875c0cee56.png");
    expect(texts).toContain("문의 ---"); // 그림 설명 글은 화면 글이라 가린다
  });

  it("글 속 일부만 가린다 — 주소는 글 전체", () => {
    expect(maskShapes("문의 02-123-4567 또는 a.b@c.co.kr")).toBe("문의 --- 또는 ---");
    expect(maskShapes("서울특별시 송파구 송파대로 570")).toBe("---");
  });
});
