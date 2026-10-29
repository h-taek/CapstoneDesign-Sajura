// content script — 쿠팡 탭마다 들어가지만 background가 명령을 보낸 작업 탭에서만 움직인다.
// 명령은 확장 내부(background)에서만 온다.

import { click, fetchNonWow, loggedIn, readPage, scroll, showNotice, typeText } from "./page";

export type Command =
  | { cmd: "read" }
  | { cmd: "click"; ref: string }
  | { cmd: "type"; ref: string; text: string }
  | { cmd: "scroll"; direction: "up" | "down" }
  | { cmd: "login" }
  | { cmd: "fetch"; url: string }
  | { cmd: "notice"; title: string; detail: string | null };

async function handle(c: Command): Promise<unknown> {
  switch (c.cmd) {
    case "read":
      return readPage(document, location.href);
    case "click":
      return click(document, location.href, c.ref);
    case "type":
      return typeText(c.ref, c.text);
    case "scroll":
      scroll(window, c.direction);
      return { ok: true, message: null, cart_added: null };
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
