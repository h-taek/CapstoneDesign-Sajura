// 진행 패널·테두리 빛·커서 그리기 (04_fe.md §12.8). 목업: docs/plan/mockup/v2/14_extension-panel.html.
// 쿠팡 화면 스타일과 섞이지 않게 shadow root 하나에 그린다. 기록의 글은 textContent로만 넣는다(HTML로 해석하지 않는다).
// DOM만 다루고 chrome API는 쓰지 않는다 — 연결은 panelLink.ts.

import { type Bubble, type Log, PANEL_HOST_ID, type Row, clock, day, layout } from "./log";

const ICONS = {
  cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  loader: '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
};
type IconName = keyof typeof ICONS;

const EMPTY_TEXT = "추천발주에서 [쿠팡 담기]를 누르면 여기에 진행이 보여요";
const DONE_TITLE = "담기를 마쳤어요";
const DONE_TEXT = "장바구니에서 수량을 확인하고 결제해 주세요. 결과는 사주라 추천발주 화면에도 있어요";
const RESULT = {
  ADDED: { icon: "check", cls: "ok", text: "담았어요" },
  CHECK_NEEDED: { icon: "alert", cls: "warn", text: "확인이 필요해요" },
  FAILED: { icon: "x", cls: "bad", text: "담지 못했어요" },
} as const;
const CURSOR_MOVE_MS = 450;
const CURSOR_PRESS_MS = 250;

const GRAD = "linear-gradient(180deg, #6447bb 0%, #885faf 50%, #af78a2 100%)";
const CSS = `
:host { all: initial; }
* { box-sizing: border-box; margin: 0; }
.panel { position: fixed; right: 16px; bottom: 16px; width: 360px; max-height: min(480px, calc(100vh - 32px));
  display: flex; flex-direction: column; border-radius: 24px; pointer-events: auto;
  font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif;
  color: #111827; word-break: keep-all; -webkit-font-smoothing: antialiased;
  background: rgb(236 231 255 / 0.62); -webkit-backdrop-filter: blur(24px) saturate(170%); backdrop-filter: blur(24px) saturate(170%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.7), 0 24px 60px -20px rgb(100 71 187 / 0.45); }
.panel[hidden] { display: none; }
.panel::before { content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 2px; background: ${GRAD};
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor;
  mask-composite: exclude; pointer-events: none; }
svg { display: block; flex-shrink: 0; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.avatar { display: flex; align-items: center; justify-content: center; flex-shrink: 0; border-radius: 9999px; color: #fff; background: ${GRAD}; }
.head { display: flex; align-items: center; gap: 10px; padding: 14px 16px 12px; border-bottom: 1px solid rgb(100 71 187 / 0.1); }
.head .avatar { width: 36px; height: 36px; }
.head .who { min-width: 0; flex: 1; }
.head .name { font-size: 15px; font-weight: 700; }
.head .state { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #374151; }
.head .dot { width: 6px; height: 6px; border-radius: 9999px; background: #138a4a; }
.close { all: unset; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; margin-right: -4px;
  border-radius: 9999px; color: #374151; cursor: pointer; }
.close:hover { background: rgb(255 255 255 / 0.6); color: #111827; }
.close:focus-visible { outline: 3px solid #e2dbff; }
.log { min-height: 0; flex: 1; overflow-y: auto; padding: 16px 14px; display: flex; flex-direction: column; gap: 12px;
  scrollbar-width: thin; scrollbar-color: rgb(100 71 187 / 0.3) transparent; }
.out { display: flex; justify-content: flex-end; }
.out p { max-width: 75%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 8px 14px; border-radius: 16px 16px 6px 16px;
  color: #fff; font-weight: 600; background: linear-gradient(160deg, #6447bb 0%, #885faf 100%); box-shadow: 0 4px 12px -6px rgb(100 71 187 / 0.6); }
.in { display: flex; align-items: flex-end; gap: 8px; }
.in .avatar { width: 28px; height: 28px; }
.col { display: flex; min-width: 0; flex-direction: column; align-items: flex-start; gap: 4px; }
.b { max-width: 100%; background: rgb(255 255 255 / 0.78); box-shadow: 0 1px 2px rgb(100 71 187 / 0.08); }
.say { padding: 8px 14px; border-radius: 16px 16px 16px 6px; color: #374151; }
.say strong { display: block; color: #111827; font-weight: 600; }
.act { padding: 6px 12px; border-radius: 12px; font-size: 13px; color: #6b7280; }
.act.now { display: flex; align-items: center; gap: 6px; font-weight: 600; color: #111827; }
.act.now span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.act.now svg { color: #6447bb; animation: spin 1s linear infinite; }
.wait { display: flex; align-items: center; gap: 4px; padding: 10px 12px; border-radius: 12px; }
.wait i { width: 6px; height: 6px; border-radius: 9999px; background: #885faf; animation: dot 1.2s infinite ease-in-out both; }
.wait i:nth-child(2) { animation-delay: 0.15s; }
.wait i:nth-child(3) { animation-delay: 0.3s; }
.res { padding: 8px 14px; border-radius: 16px 16px 16px 6px; font-weight: 600; }
.res .label { display: flex; align-items: center; gap: 6px; }
.res .why { display: block; margin-top: 2px; font-weight: 400; color: #374151; }
.ok { color: #138a4a; } .warn { color: #b45309; } .bad { color: #d92d20; }
.note { display: flex; gap: 8px; padding: 10px 14px; border-radius: 16px 16px 16px 6px; background: rgb(255 244 224 / 0.9); }
.note.bad { background: rgb(253 236 236 / 0.9); }
.note svg { margin-top: 3px; }
.note .t { display: block; font-weight: 600; color: #111827; }
.note .d { display: block; color: #374151; }
.time { padding-left: 4px; font-size: 11px; color: #6b7280; font-variant-numeric: tabular-nums; }
details summary { display: inline-flex; align-items: center; gap: 4px; padding: 0 4px; list-style: none; cursor: pointer; font-size: 12px; color: #6b7280; }
details summary::-webkit-details-marker { display: none; }
details summary:hover { color: #374151; }
details[open] summary svg { transform: rotate(180deg); }
details ol { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; margin-top: 4px; padding: 0; list-style: none; }
.glow { position: fixed; inset: 0; pointer-events: none;
  box-shadow: inset 0 0 60px 4px rgb(100 71 187 / 0.32), inset 0 0 140px 20px rgb(136 95 175 / 0.18), inset 0 -80px 120px -60px rgb(175 120 162 / 0.4);
  animation: glow-in 0.8s ease-out both, breathe 2.4s ease-in-out 0.8s infinite; }
.glow[hidden], .cursor[hidden] { display: none; }
.cursor { position: fixed; top: 0; left: 0; pointer-events: none; transition: transform ${CURSOR_MOVE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1);
  filter: drop-shadow(0 2px 4px rgb(100 71 187 / 0.45)); }
.cursor svg { margin: -2px 0 0 -2px; stroke: none; }
.cursor .ripple { position: absolute; top: -14px; left: -14px; width: 28px; height: 28px; border-radius: 9999px; border: 2px solid #885faf; opacity: 0; }
.cursor.press .ripple { animation: ripple 0.6s ease-out; }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes dot { 0%, 80%, 100% { opacity: 0.25; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-2px); } }
@keyframes glow-in { from { opacity: 0; } }
@keyframes breathe { 0%, 100% { opacity: 0.65; } 50% { opacity: 1; } }
@keyframes ripple { from { transform: scale(0.3); opacity: 1; } to { transform: scale(1.4); opacity: 0; } }
`;
const CURSOR_SVG =
  '<svg width="22" height="24" viewBox="0 0 22 24"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6447bb"/><stop offset="1" stop-color="#af78a2"/></linearGradient></defs><path d="M2 2 L2 19 L7 14.5 L10.5 22 L14 20.5 L10.5 13 L17 13 Z" fill="url(#g)" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface PanelUi {
  render(log: Log): void;
  setOpen(open: boolean): void;
  setGlow(on: boolean): void;
  /** 커서를 요소 가운데로 옮기고 누르는 모양을 보인다. 실제 클릭은 부르는 쪽이 한다. */
  pointAt(el: Element): Promise<void>;
}

export function createUi(doc: Document, onClose: () => void): PanelUi {
  const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
    const el = doc.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const icon = (name: IconName, size: number, cls?: string): HTMLElement => {
    const box = h("span");
    box.style.display = "contents";
    // 아이콘 모양은 고정 문자열이다 — 기록 글은 여기에 들어가지 않는다
    box.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24"${cls ? ` class="${cls}"` : ""}>${ICONS[name]}</svg>`;
    return box;
  };
  const avatar = (size: number): HTMLElement => {
    const a = h("span", "avatar");
    a.setAttribute("aria-hidden", "true");
    a.append(icon("cart", size));
    return a;
  };

  doc.getElementById(PANEL_HOST_ID)?.remove();
  const host = h("div");
  host.id = PANEL_HOST_ID;
  host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
  const root = host.attachShadow({ mode: "open" });
  const style = h("style", undefined, CSS);

  const glow = h("div", "glow");
  glow.hidden = true;
  const cursor = h("div", "cursor");
  cursor.hidden = true;
  cursor.innerHTML = `<i class="ripple"></i>${CURSOR_SVG}`;

  const panel = h("section", "panel");
  panel.setAttribute("role", "log");
  panel.setAttribute("aria-label", "사주라 쿠팡 담기 진행");
  panel.hidden = true;
  const head = h("header", "head");
  const who = h("div", "who");
  const state = h("p", "state");
  who.append(h("p", "name", "사주라"), state);
  const close = h("button", "close");
  close.type = "button";
  close.setAttribute("aria-label", "닫기");
  close.append(icon("x", 20));
  close.addEventListener("click", onClose);
  head.append(avatar(16), who, close);
  const list = h("div", "log");
  panel.append(head, list);

  root.append(style, glow, cursor, panel);
  (doc.body ?? doc.documentElement).append(host);

  const opened = new Set<number>(); // 펼친 '지나간 동작' — 다시 그려도 유지한다
  let shown = 0;
  let pos = { x: (doc.defaultView?.innerWidth ?? 0) / 2, y: (doc.defaultView?.innerHeight ?? 0) / 2 };

  const bubble = (b: Bubble): HTMLElement => {
    switch (b.k) {
      case "action": {
        if (!b.current) return h("p", "b act", b.text);
        const p = h("p", "b act now");
        p.append(icon("loader", 14), h("span", undefined, b.text));
        return p;
      }
      case "wait": {
        const p = h("p", "b wait");
        p.setAttribute("aria-label", "다음 동작을 정하는 중");
        p.append(h("i"), h("i"), h("i"));
        return p;
      }
      case "result": {
        const r = RESULT[b.status];
        const p = h("p", "b res");
        const label = h("span", `label ${r.cls}`);
        label.append(icon(r.icon, 16), doc.createTextNode(r.text));
        p.append(label);
        if (b.reason) p.append(h("span", "why", b.reason));
        return p;
      }
      case "notice": {
        // 대상 밖 알림(비로그인)은 경고색, 대상 안 알림(거부)은 위험색
        const div = h("div", b.inTarget ? "b note bad" : "b note");
        const text = h("span");
        text.append(h("span", "t", b.title));
        if (b.detail) text.append(h("span", "d", b.detail));
        div.append(icon("alert", 16, b.inTarget ? "bad" : "warn"), text);
        return div;
      }
      case "done": {
        const p = h("p", "b say");
        p.append(h("strong", undefined, DONE_TITLE), doc.createTextNode(DONE_TEXT));
        return p;
      }
    }
  };

  const row = (r: Row, i: number): HTMLElement => {
    if (r.side === "out") {
      const div = h("div", "out");
      div.append(h("p", undefined, r.name));
      return div;
    }
    const div = h("div", "in");
    const col = h("div", "col");
    if (r.folded.length) {
      const d = h("details");
      d.open = opened.has(i);
      d.addEventListener("toggle", () => (d.open ? opened.add(i) : opened.delete(i)));
      const s = h("summary", undefined, `지나간 동작 ${r.folded.length}개`);
      s.append(icon("chevron", 14));
      const ol = h("ol");
      for (const t of r.folded) ol.append(h("li", "b act", t));
      d.append(s, ol);
      col.append(d);
    }
    for (const b of r.bubbles) col.append(bubble(b));
    if (r.at !== null) col.append(h("p", "time", clock(r.at)));
    div.append(avatar(14), col);
    return div;
  };

  return {
    render(log) {
      state.replaceChildren();
      if (log.running && log.startedAt !== null) {
        state.append(h("i", "dot"), doc.createTextNode(`담는 중 · ${clock(log.startedAt)} 시작`));
      } else if (log.startedAt !== null) {
        state.textContent = `마침 · ${day(log.startedAt)} ${clock(log.startedAt)} 시작`;
      } else {
        state.textContent = "담기 기록 없음";
      }
      const rows = layout(log);
      if (!rows.length) {
        list.replaceChildren(row({ side: "in", folded: [], bubbles: [], at: null }, 0));
        list.querySelector(".col")?.append(h("p", "b say", EMPTY_TEXT));
      } else {
        list.replaceChildren(...rows.map(row));
      }
      // 새 말풍선이 오면 맨 아래로
      const count = log.entries.length + (log.busy ? 1 : 0);
      if (count !== shown) list.scrollTop = list.scrollHeight;
      shown = count;
    },
    setOpen(open) {
      const was = !panel.hidden;
      panel.hidden = !open;
      if (open && !was) list.scrollTop = list.scrollHeight;
    },
    setGlow(on) {
      glow.hidden = !on;
      cursor.hidden = !on;
      if (on) cursor.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
    },
    async pointAt(el) {
      if (glow.hidden) return;
      const r = el.getBoundingClientRect();
      pos = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      cursor.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
      await sleep(CURSOR_MOVE_MS);
      cursor.classList.remove("press");
      void cursor.offsetWidth; // 같은 자리를 다시 눌러도 동그라미가 퍼지게
      cursor.classList.add("press");
      await sleep(CURSOR_PRESS_MS);
    },
  };
}
