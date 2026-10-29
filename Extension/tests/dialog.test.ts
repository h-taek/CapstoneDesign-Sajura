// 작업 탭의 알림·확인 창 (research/backend/16 §6.12 — 알림 창이 뜨면 탭 스크립트가 멈춘다)

import { installDialogGuard } from "../src/dialogGuard";
import { claimWorkTab, click, readPage, takeDialogs } from "../src/page";
import { PRODUCT_URL, SEARCH_URL, load } from "./helpers";

describe("페이지 쪽 알림 창 가로채기", () => {
  const native = { alert: vi.fn(), confirm: vi.fn(() => true) };
  beforeAll(() => {
    window.alert = native.alert;
    window.confirm = native.confirm;
    installDialogGuard(window);
    claimWorkTab(document);
  });
  afterEach(() => takeDialogs());

  it("작업 탭이면 띄우지 않고 글을 넘긴다. 확인 창은 취소", () => {
    window.alert("서버에서 오류가 발생하였습니다.");
    expect(window.confirm("장바구니로 이동할까요?")).toBe(false);
    expect(native.alert).not.toHaveBeenCalled();
    expect(native.confirm).not.toHaveBeenCalled();
    expect(takeDialogs()).toEqual(["알림: 서버에서 오류가 발생하였습니다.", "확인 창(취소함): 장바구니로 이동할까요?"]);
  });

  it("작업 탭이 아니면 그대로 띄운다", () => {
    delete document.documentElement.dataset.sajuraWork;
    window.alert("다른 탭");
    expect(native.alert).toHaveBeenCalledWith("다른 탭");
    document.documentElement.dataset.sajuraWork = "1";
  });

  it("다음 요소 목록 끝에 누를 수 없는 '알림' 요소로 붙는다", () => {
    window.alert("품절된 상품입니다");
    const els = readPage(load("search"), SEARCH_URL).elements;
    expect(els.at(-1)).toEqual({ ref: "알림1", role: "alert", text: "알림: 품절된 상품입니다", depth: 0 });
  });

  it("담기 버튼 뒤 알림 창이 뜨면 담기 완료를 더 기다리지 않는다", async () => {
    const doc = load("product");
    const ref = readPage(doc, PRODUCT_URL).elements.find((e) => e.text === "장바구니 담기")?.ref as string;
    doc.querySelector(".prod-cart-btn")?.addEventListener("click", () => {
      setTimeout(() => window.alert("서버에서 오류가 발생하였습니다."), 50);
    });
    const start = Date.now();
    expect((await click(doc, PRODUCT_URL, ref)).cart_added).toBeNull();
    expect(Date.now() - start).toBeLessThan(1500);
    expect(takeDialogs()).toEqual(["알림: 서버에서 오류가 발생하였습니다."]);
  });
});

it("카드 안 글자를 골라도 카드 링크를 누른다", async () => {
  const doc = load("search");
  const els = readPage(doc, SEARCH_URL).elements;
  const discount = els.find((e) => e.text === "쿠폰할인")?.ref as string;
  const a = doc.querySelector("#product-list a") as HTMLAnchorElement;
  const clicked: EventTarget[] = [];
  a.addEventListener("click", (e) => {
    clicked.push(e.currentTarget as EventTarget);
    e.preventDefault();
  });
  await click(doc, SEARCH_URL, discount);
  expect(clicked).toEqual([a]);
});
