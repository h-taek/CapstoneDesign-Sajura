// 진행 패널 기록 (04_fe.md §12.8). background만 쓰고 chrome.storage.session의 "log"에 둔다.
// 패널은 이 기록을 구독해 그린다. 여기는 기록 모양·동작 문장·말풍선 묶기만 — chrome API는 쓰지 않는다.

import type { Action } from "./messages";

/** 패널·테두리 빛·커서를 그리는 요소 — 요소 목록에서 뺀다 (§12.4). */
export const PANEL_HOST_ID = "sajura-ext";
export const LABEL_MAX = 24;

export type Status = "ADDED" | "CHECK_NEEDED" | "FAILED";

export type Entry =
  | { k: "target"; name: string; at: number }
  | { k: "action"; text: string; at: number }
  | { k: "result"; status: Status; reason: string | null; at: number }
  | { k: "notice"; title: string; detail: string | null; at: number }
  | { k: "done"; at: number };

export interface Log {
  startedAt: number | null;
  running: boolean; // open부터 progress done까지 — 테두리 빛
  busy: boolean; // 동작 실행 중 — 아니면 기다림 점
  closed: boolean; // 작업 탭에서 X로 닫았다. 다음 open에서 다시 연다
  entries: Entry[];
}

export const emptyLog = (): Log => ({ startedAt: null, running: false, busy: false, closed: false, entries: [] });

const clip = (text: string): string => {
  const chars = [...text.replace(/\s+/g, " ").trim()];
  return chars.length > LABEL_MAX ? `${chars.slice(0, LABEL_MAX).join("")}…` : chars.join("");
};

/** 누를 요소의 이름 — 글자가 있으면 따옴표로, 없으면 종류 이름(버튼·링크). */
export interface ClickTarget {
  text: string | null;
  kind: "버튼" | "링크";
}

export function sentence(a: Action, target: ClickTarget | null): string {
  switch (a.tool) {
    case "read_elements":
      return "화면을 읽는 중이에요";
    case "click": {
      const name = target?.text ? `'${clip(target.text)}'` : (target?.kind ?? "버튼");
      return `${name} 누르는 중이에요`;
    }
    case "type_text":
      return `'${clip(a.args.text)}' 입력하는 중이에요`;
    case "scroll":
      return a.args.direction === "down" ? "화면을 내리는 중이에요" : "화면을 올리는 중이에요";
    case "open_url":
      return "상품 페이지를 여는 중이에요";
  }
}

/** '오전 9:12' */
export function clock(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  return `${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** '10월 20일' */
export function day(ms: number): string {
  const d = new Date(ms);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export type Bubble =
  | { k: "action"; text: string; current: boolean }
  | { k: "wait" }
  | { k: "result"; status: Status; reason: string | null }
  | { k: "notice"; title: string; detail: string | null; inTarget: boolean }
  | { k: "done" };

/** 오른쪽 말풍선(대상) 또는 왼쪽 묶음(확장이 하는 말). 결과가 오면 그때까지의 동작은 접는다. */
export type Row =
  | { side: "out"; name: string }
  | { side: "in"; folded: string[]; bubbles: Bubble[]; at: number | null };

type InRow = Extract<Row, { side: "in" }>;

export function layout(log: Log): Row[] {
  const rows: Row[] = [];
  let group: InRow | null = null;
  let inTarget = false;
  const open = (): InRow => {
    if (!group) {
      group = { side: "in", folded: [], bubbles: [], at: null };
      rows.push(group);
    }
    return group;
  };

  for (const e of log.entries) {
    if (e.k === "target") {
      rows.push({ side: "out", name: e.name });
      group = null;
      inTarget = true;
      continue;
    }
    if (e.k === "done") group = null; // 끝은 따로 묶는다
    const g = open();
    g.at = e.at;
    if (e.k === "action") g.bubbles.push({ k: "action", text: e.text, current: false });
    else if (e.k === "notice") g.bubbles.push({ k: "notice", title: e.title, detail: e.detail, inTarget });
    else if (e.k === "result") {
      g.folded.push(...g.bubbles.flatMap((b) => (b.k === "action" ? [b.text] : [])));
      g.bubbles = g.bubbles.filter((b) => b.k !== "action");
      g.bubbles.push({ k: "result", status: e.status, reason: e.reason });
      group = null; // 이 대상은 끝났다
      inTarget = false;
    } else {
      g.bubbles.push({ k: "done" });
      group = null;
    }
  }

  const last = log.entries[log.entries.length - 1];
  if (log.busy && last?.k === "action") {
    const b = (rows[rows.length - 1] as InRow).bubbles.at(-1);
    if (b?.k === "action") b.current = true;
  } else if (log.running) {
    open().bubbles.push({ k: "wait" });
  }
  // 아직 말하는 중인 마지막 묶음에는 시각을 붙이지 않는다
  const tail = rows[rows.length - 1];
  if (log.running && tail?.side === "in") tail.at = null;
  return rows;
}
