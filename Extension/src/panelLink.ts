// 진행 패널 연결 (04_fe.md §12.8) — 기록(chrome.storage.session "log")을 구독해 패널을 그린다.
// 쿠팡 탭은 content.ts가, 확장 버튼을 누른 다른 탭은 viewer.ts가 부른다. 같은 탭에서는 하나만 둔다.
//
// 작업 탭: 기록이 X로 닫히지 않았으면 패널, 담기 중이면 테두리 빛·커서.
// 다른 탭: 확장 버튼으로 연 동안만 패널(기록 보기). 빛·커서는 그리지 않는다.

import { type Log, emptyLog, viewLog } from "./log";
import { type PanelUi, createUi } from "./panel";

/** content script → background 메시지 (확장 안쪽만). */
export type PanelMessage = { panel: "hello" } | { panel: "close" } | { panel: "open" };

export interface PanelLink {
  show(): void;
  pointAt(el: Element): Promise<void>;
}

type WithPanel = typeof globalThis & { __sajuraPanel?: PanelLink };

/** 이 탭의 패널 연결. 이미 있으면 그것을 돌려준다(content script와 viewer가 같은 공간에서 돈다). */
export function attachPanel(): PanelLink {
  const g = globalThis as WithPanel;
  g.__sajuraPanel ??= link();
  return g.__sajuraPanel;
}

const send = (m: PanelMessage) => chrome.runtime.sendMessage(m).catch(() => undefined);

function link(): PanelLink {
  let ui: PanelUi | null = null;
  let log: Log = emptyLog();
  let work = false;
  let shownHere = false; // 다른 탭에서 확장 버튼으로 열었다

  const sync = () => {
    const view = viewLog(log, Date.now());
    const open = work ? !log.closed : shownHere;
    const glow = work && view.running;
    if (!open && !glow && !ui) return;
    ui ??= createUi(document, () => {
      if (work) void send({ panel: "close" });
      else {
        shownHere = false;
        sync();
      }
    });
    ui.setOpen(open);
    ui.setGlow(glow);
    if (open) ui.render(view);
  };
  // 기록이 바뀌지 않아도 기다린 시간이 지나면 끊김으로 다시 그린다
  setInterval(() => {
    if (log.running) sync();
  }, 5_000);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "session" || !("log" in changes)) return;
    log = (changes.log.newValue as Log | undefined) ?? emptyLog();
    sync();
  });

  const ready = Promise.all([send({ panel: "hello" }), chrome.storage.session.get("log")])
    .then(([hello, saved]) => {
      work = (hello as { work?: boolean } | undefined)?.work === true;
      log = (saved.log as Log | undefined) ?? emptyLog();
      sync();
    })
    .catch(() => undefined);

  return {
    show() {
      void ready.then(() => {
        if (work) void send({ panel: "open" });
        else {
          shownHere = true;
          sync();
        }
      });
    },
    pointAt: (el) => ui?.pointAt(el) ?? Promise.resolve(),
  };
}
