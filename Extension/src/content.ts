// content script — 쿠팡 탭마다 들어가지만 background가 명령을 보낸 작업 탭에서만 움직인다.
// 명령은 확장 내부(background)에서만 온다.

import {
  type ClickResult,
  claimWorkTab,
  click,
  fetchNonWow,
  loggedIn,
  readPage,
  scroll,
  showNotice,
  takeDialogs,
  typeText,
} from "./page";
import { PRODUCT_URL_PREFIX } from "./messages";

export type Command =
  | { cmd: "read" }
  | { cmd: "click"; ref: string }
  | { cmd: "type"; ref: string; text: string }
  | { cmd: "scroll"; direction: "up" | "down" }
  | { cmd: "navigate"; url: string }
  | { cmd: "login" }
  | { cmd: "fetch"; url: string }
  | { cmd: "notice"; title: string; detail: string | null };

/** 동작 결과에 그사이 뜬 알림 창 글을 붙인다. */
function withDialogs(r: ClickResult): ClickResult {
  const notes = takeDialogs(document);
  if (!notes.length) return r;
  return { ...r, message: [r.message, ...notes].filter(Boolean).join(" / ").slice(0, 200) };
}

async function handle(c: Command): Promise<unknown> {
  claimWorkTab(document); // 명령을 받은 탭이 작업 탭이다
  switch (c.cmd) {
    case "read":
      return readPage(document, location.href);
    case "click":
      return withDialogs(await click(document, location.href, c.ref));
    case "type":
      return withDialogs(typeText(c.ref, c.text));
    case "scroll":
      scroll(window, c.direction);
      return withDialogs({ ok: true, message: null, cart_added: null });
    case "navigate":
      // 페이지 안 이동 — 쿠팡 안에서 넘어온 요청이 된다. 탭에 주소를 바로 넣으면 차단 화면이 왔다
      // (research/backend/16 §6.13). 상품 페이지 주소만 받는다
      if (!c.url.startsWith(PRODUCT_URL_PREFIX)) return { ok: false };
      setTimeout(() => location.assign(c.url), 50); // 답을 먼저 보낸다
      return { ok: true };
    case "login":
      return { logged_in: loggedIn(document) };
    case "fetch":
      return fetchNonWow(c.url);
    case "notice":
      showNotice(document, c.title, c.detail);
      return { ok: true };
  }
}

chrome.runtime.onMessage.addListener((msg: Command, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return false;
  handle(msg).then(reply, (e) => reply({ error: String(e) }));
  return true; // 답을 비동기로 보낸다
});
