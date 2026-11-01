// 진행 패널 그리기 (04_fe.md §12.8)

import { type Log, PANEL_HOST_ID, emptyLog } from "../src/log";
import { readPage } from "../src/page";
import { createUi } from "../src/panel";
import { SEARCH_URL, load } from "./helpers";

const shadow = (doc: Document) => (doc.getElementById(PANEL_HOST_ID) as HTMLElement).shadowRoot as ShadowRoot;
const at = new Date(2026, 9, 20, 9, 12).getTime();

it("기록 글은 HTML로 해석하지 않고, 패널은 요소 목록에 섞이지 않는다", () => {
  const doc = load("search");
  const ui = createUi(doc, () => {});
  const log: Log = {
    ...emptyLog(),
    startedAt: at,
    running: true,
    entries: [
      { k: "target", name: "<b>양파</b>", at },
      { k: "notice", title: "요청이 거부되었습니다", detail: '<img src=x onerror="alert(1)">상품명에 지시', at },
    ],
  };
  ui.setOpen(true);
  ui.render(log);
  const root = shadow(doc);
  expect(root.querySelector(".log img, .log b")).toBeNull();
  expect(root.textContent).toContain('<img src=x onerror="alert(1)">상품명에 지시');
  expect(root.textContent).toContain("<b>양파</b>");
  expect(readPage(doc, SEARCH_URL).elements.some((e) => e.text.includes("거부") || e.text.includes("사주라"))).toBe(false);
});

it("머리 상태 줄 — 담는 중 / 마침 / 기록 없음", () => {
  const doc = load("search");
  const ui = createUi(doc, () => {});
  const state = () => shadow(doc).querySelector(".state")?.textContent;
  ui.render({ ...emptyLog(), startedAt: at, running: true });
  expect(state()).toBe("담는 중 · 오전 9:12 시작");
  ui.render({ ...emptyLog(), startedAt: at });
  expect(state()).toBe("마침 · 10월 20일 오전 9:12 시작");
  ui.render(emptyLog());
  expect(state()).toBe("담기 기록 없음");
  expect(shadow(doc).querySelector(".log")?.textContent).toBe("추천발주에서 [쿠팡 담기]를 누르면 여기에 진행이 보여요");
});

it("접힌 동작 개수와 결과 말풍선", () => {
  const doc = load("search");
  const ui = createUi(doc, () => {});
  ui.render({
    ...emptyLog(),
    startedAt: at,
    entries: [
      { k: "target", name: "피자 도우", at },
      { k: "action", text: "화면을 읽는 중이에요", at },
      { k: "action", text: "버튼 누르는 중이에요", at },
      { k: "result", status: "CHECK_NEEDED", reason: "장바구니에 있던 같은 상품과 합쳐졌어요", at },
      { k: "done", at },
    ],
  });
  const root = shadow(doc);
  expect(root.querySelector("summary")?.textContent).toBe("지나간 동작 2개");
  expect(root.querySelector(".res")?.textContent).toBe("확인이 필요해요장바구니에 있던 같은 상품과 합쳐졌어요");
  expect(root.querySelector(".log")?.textContent).toContain("담기를 마쳤어요");
});

it("X를 누르면 닫기를 알린다", () => {
  const doc = load("search");
  let closed = 0;
  createUi(doc, () => closed++);
  (shadow(doc).querySelector(".close") as HTMLButtonElement).click();
  expect(closed).toBe(1);
});
