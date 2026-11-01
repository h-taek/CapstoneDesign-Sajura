// 페이지 쪽(MAIN world)에서 대신 누르기 — `javascript:` 링크(차단 화면의 '이전 화면으로' 등)를 content script가
// 누르면 그 스크립트가 확장 CSP로 막혀 아무 일도 없었다(research/backend/16 §6.15). content script는 요소에
// 표시를 달고 신호만 보내고, 페이지 쪽 스크립트가 받아 누른다. 문서 이벤트는 두 공간이 함께 받는다.

const FLAG = "sajuraClick"; // data-sajura-click
const EVENT = "sajura-click";

/** content script 쪽 — 이 요소를 페이지 쪽에서 눌러 달라고 한다. */
export function requestMainClick(doc: Document, el: HTMLElement): void {
  el.dataset[FLAG] = "1";
  doc.dispatchEvent(new CustomEvent(EVENT));
}

/** 페이지 쪽 — 신호를 받으면 표시한 요소를 누른다. */
export function installMainClick(win: Window): void {
  win.document.addEventListener(EVENT, () => {
    const el = win.document.querySelector<HTMLElement>("[data-sajura-click]");
    if (!el) return;
    delete el.dataset[FLAG];
    el.click();
  });
}
