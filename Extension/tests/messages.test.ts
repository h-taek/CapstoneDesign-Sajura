// PWA ↔ 확장 메시지 형식 (04_fe.md §12.3·§12.4)

import { parseRequest } from "../src/messages";

it("동작 메시지", () => {
  expect(parseRequest({ type: "run", action: { tool: "click", args: { ref: "12" } } })).toEqual({
    type: "run",
    action: { tool: "click", args: { ref: "12" } },
  });
  expect(parseRequest({ type: "run", action: { tool: "read_elements", args: {} } })).toEqual({
    type: "run",
    action: { tool: "read_elements", args: {} },
  });
});

it("입력 글자는 50자로 자른다", () => {
  const req = parseRequest({
    type: "run",
    action: { tool: "type_text", args: { ref: "3", text: "가".repeat(80) } },
  });
  expect(req).toEqual({ type: "run", action: { tool: "type_text", args: { ref: "3", text: "가".repeat(50) } } });
});

it("주소 열기는 쿠팡 상품 페이지만", () => {
  const open = (url: string) => parseRequest({ type: "run", action: { tool: "open_url", args: { url } } });
  expect(open("https://www.coupang.com/vp/products/1?itemId=2")).not.toBeNull();
  expect(open("https://www.coupang.com/np/search?q=x")).toBeNull();
  expect(open("https://evil.example/vp/products/1")).toBeNull();
});

it("형식이 다르면 null", () => {
  for (const bad of [
    null,
    "run",
    { type: "eval", code: "1" },
    { type: "run", action: { tool: "finish_item", args: {} } },
    { type: "run", action: { tool: "click", args: { ref: 1 } } },
    { type: "run", action: { tool: "scroll", args: { direction: "left" } } },
    { type: "notice", title: "x".repeat(101), detail: null },
  ]) {
    expect(parseRequest(bad)).toBeNull();
  }
});

it("시작·비회원 가격·알림", () => {
  expect(parseRequest({ type: "open" })).toEqual({ type: "open" });
  expect(parseRequest({ type: "take_non_wow_prices", wait: true })).toEqual({
    type: "take_non_wow_prices",
    wait: true,
  });
  expect(parseRequest({ type: "notice", title: "요청이 거부되었습니다", detail: "사유" })).toEqual({
    type: "notice",
    title: "요청이 거부되었습니다",
    detail: "사유",
  });
});
