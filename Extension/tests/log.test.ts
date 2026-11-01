// 진행 패널 기록 — 동작 문장·말풍선 묶기 (04_fe.md §12.8)

import { type Entry, type Log, clock, emptyLog, layout, sentence } from "../src/log";

describe("동작 문장", () => {
  it("동작마다 정해진 문장", () => {
    expect(sentence({ tool: "read_elements", args: {} }, null)).toBe("화면을 읽는 중이에요");
    expect(sentence({ tool: "scroll", args: { direction: "down" } }, null)).toBe("화면을 내리는 중이에요");
    expect(sentence({ tool: "scroll", args: { direction: "up" } }, null)).toBe("화면을 올리는 중이에요");
    expect(sentence({ tool: "open_url", args: { url: "https://www.coupang.com/vp/products/1?itemId=2" } }, null)).toBe(
      "상품 페이지를 여는 중이에요",
    );
    expect(sentence({ tool: "type_text", args: { ref: "3", text: "페퍼로니 슬라이스 1kg" } }, null)).toBe(
      "'페퍼로니 슬라이스 1kg' 입력하는 중이에요",
    );
  });

  it("클릭 — 요소 글자를 따옴표로, 24자를 넘으면 자른다", () => {
    const click = { tool: "click", args: { ref: "7" } } as const;
    expect(sentence(click, { text: "장바구니 담기", kind: "버튼" })).toBe("'장바구니 담기' 누르는 중이에요");
    expect(sentence(click, { text: "[냉동] 델리 페퍼로니 슬라이스 1kg, 1개", kind: "링크" })).toBe(
      "'[냉동] 델리 페퍼로니 슬라이스 1kg, 1…' 누르는 중이에요",
    );
  });

  it("클릭 — 글자가 없으면 종류 이름, 따옴표 없이", () => {
    const click = { tool: "click", args: { ref: "7" } } as const;
    expect(sentence(click, { text: null, kind: "버튼" })).toBe("버튼 누르는 중이에요");
    expect(sentence(click, { text: null, kind: "링크" })).toBe("링크 누르는 중이에요");
    expect(sentence(click, null)).toBe("버튼 누르는 중이에요");
  });
});

it("시각은 '오전 9:12' 모양", () => {
  expect(clock(new Date(2026, 9, 20, 9, 12).getTime())).toBe("오전 9:12");
  expect(clock(new Date(2026, 9, 20, 0, 5).getTime())).toBe("오전 12:05");
  expect(clock(new Date(2026, 9, 20, 13, 40).getTime())).toBe("오후 1:40");
});

describe("말풍선 묶기", () => {
  const t = 1_000;
  const action = (text: string): Entry => ({ k: "action", text, at: t });
  const make = (entries: Entry[], over: Partial<Log> = {}): Log => ({
    ...emptyLog(),
    startedAt: t,
    running: true,
    entries,
    ...over,
  });

  it("결과가 오면 그 대상의 동작을 접고, 끝난 묶음에 시각을 붙인다", () => {
    const rows = layout(
      make(
        [
          { k: "target", name: "바질", at: t },
          action("상품 페이지를 여는 중이에요"),
          action("'장바구니 담기' 누르는 중이에요"),
          { k: "result", status: "ADDED", reason: null, at: t },
          { k: "target", name: "페퍼로니", at: t },
          action("화면을 읽는 중이에요"),
        ],
        { busy: true },
      ),
    );
    expect(rows).toEqual([
      { side: "out", name: "바질" },
      {
        side: "in",
        folded: ["상품 페이지를 여는 중이에요", "'장바구니 담기' 누르는 중이에요"],
        bubbles: [{ k: "result", status: "ADDED", reason: null }],
        at: t,
      },
      { side: "out", name: "페퍼로니" },
      // 실행 중인 마지막 동작은 현재 표시, 아직 말하는 중이라 시각 없음
      { side: "in", folded: [], bubbles: [{ k: "action", text: "화면을 읽는 중이에요", current: true }], at: null },
    ]);
  });

  it("담기 중이고 실행 중이 아니면 기다림 점", () => {
    const rows = layout(make([{ k: "target", name: "바질", at: t }, action("화면을 읽는 중이에요")]));
    expect(rows.at(-1)).toEqual({
      side: "in",
      folded: [],
      bubbles: [{ k: "action", text: "화면을 읽는 중이에요", current: false }, { k: "wait" }],
      at: null,
    });
  });

  it("대상 밖 알림과 대상 안 알림을 나누고, 끝은 따로 묶는다", () => {
    const rows = layout(
      make(
        [
          { k: "notice", title: "쿠팡에 로그인해 주세요", detail: "로켓프레시", at: t },
          { k: "target", name: "페퍼로니", at: t },
          { k: "notice", title: "요청이 거부되었습니다", detail: "사유", at: t },
          { k: "result", status: "FAILED", reason: null, at: t },
          { k: "done", at: t },
        ],
        { running: false },
      ),
    );
    expect(rows).toEqual([
      {
        side: "in",
        folded: [],
        bubbles: [{ k: "notice", title: "쿠팡에 로그인해 주세요", detail: "로켓프레시", inTarget: false }],
        at: t,
      },
      { side: "out", name: "페퍼로니" },
      {
        side: "in",
        folded: [],
        bubbles: [
          { k: "notice", title: "요청이 거부되었습니다", detail: "사유", inTarget: true },
          { k: "result", status: "FAILED", reason: null },
        ],
        at: t,
      },
      { side: "in", folded: [], bubbles: [{ k: "done" }], at: t },
    ]);
  });

  it("기록이 없고 담기 중이 아니면 비어 있다", () => {
    expect(layout(emptyLog())).toEqual([]);
  });
});
