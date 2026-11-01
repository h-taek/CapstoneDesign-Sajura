// 서비스 워커 — PWA의 메시지를 받아 작업 탭에서 동작을 실행한다 (04_fe.md §12.3·§12.4).
// 담기를 시작할 때 연 작업 탭 하나에서만 움직이고, 서버는 부르지 않는다.
// 진행 패널 기록(§12.8)은 여기서만 쓴다. 패널은 chrome.storage.session의 기록을 구독한다.

import type { Command } from "./content";
import type { WowCard } from "./elements";
import { type ClickTarget, type Log, emptyLog, sentence } from "./log";
import {
  type Action,
  type ActionResult,
  type ElementsResult,
  type Request,
  type Response,
  parseRequest,
} from "./messages";
import { type FetchResult, NonWowQueue, type QueueState, emptyState } from "./nonwow";
import type { ClickResult } from "./page";
import type { PanelMessage } from "./panelLink";

const HOME = "https://www.coupang.com/";
const LOAD_TIMEOUT_MS = 20_000;
const NAV_GRACE_MS = 1500; // 클릭 뒤 이 안에 화면이 바뀌기 시작하면 바뀐 것으로 본다
const SETTLE_MS = 800; // 다 뜬 뒤 화면 그리기를 기다린다
const REPLY_TIMEOUT_MS = 15_000; // 탭 명령 하나의 답 — 클릭 뒤 담기 완료 기다리기(4초)보다 길게

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface Session {
  tabId: number | null;
  queue: QueueState;
}

let session: Session | null = null;
let queue: NonWowQueue | null = null;

const persist = () => chrome.storage.session.set({ session });

// 패널(content script)이 기록을 읽고 바뀜을 받게 한다
void chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" });

let log: Log | null = null;
let logChain: Promise<void> = Promise.resolve();

/** 기록 고치기 — 하나씩 차례로 저장한다. */
function editLog(fn: (l: Log) => void): Promise<void> {
  logChain = logChain
    .then(async () => {
      log ??= ((await chrome.storage.session.get("log")).log as Log | undefined) ?? emptyLog();
      fn(log);
      await chrome.storage.session.set({ log });
    })
    .catch(() => undefined);
  return logChain;
}

async function load(): Promise<{ session: Session; queue: NonWowQueue }> {
  if (!session || !queue) {
    const saved = (await chrome.storage.session.get("session")).session as Session | undefined;
    session = saved ?? { tabId: null, queue: emptyState() };
    queue = new NonWowQueue(session.queue, fetchViaTab, sleep, persist);
    queue.add([]); // 서비스 워커가 쉬었다 깨어났으면 남은 받기를 이어 간다
  }
  return { session, queue };
}

async function tabState(tabId: number): Promise<chrome.tabs.Tab | null> {
  try {
    return await chrome.tabs.get(tabId);
  } catch {
    return null;
  }
}

async function waitComplete(tabId: number): Promise<void> {
  for (let t = 0; t < LOAD_TIMEOUT_MS; t += 200) {
    const tab = await tabState(tabId);
    if (!tab || tab.status === "complete") return;
    await sleep(200);
  }
}

class NoReply extends Error {}

/** 탭이 이 시간 안에 답하지 않으면 실패로 본다 — 알림 창이 떠 있으면 탭 스크립트가 멈춘다. */
function within<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_, rej) => {
    timer = setTimeout(() => rej(new NoReply("확장 응답 없음 — 쿠팡 탭에 알림 창이 떠 있을 수 있습니다")), ms);
  });
  return Promise.race([p, limit]).finally(() => clearTimeout(timer));
}

/** content script에 명령. 화면이 막 바뀌어 아직 준비되지 않았으면 잠시 뒤 다시 보낸다. */
async function send<T>(tabId: number, command: Command, retry = true): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      const reply = await within(chrome.tabs.sendMessage(tabId, command), REPLY_TIMEOUT_MS);
      if (reply && typeof reply === "object" && "error" in reply) throw new Error(String(reply.error));
      return reply as T;
    } catch (e) {
      if (e instanceof NoReply || !retry || i >= 20) throw e;
      await sleep(500);
    }
  }
}

async function fetchViaTab(url: string): Promise<FetchResult> {
  const tabId = session?.tabId;
  if (tabId == null) return { ok: false };
  return send<FetchResult>(tabId, { cmd: "fetch", url });
}

/** 동작 뒤 화면이 바뀌었는지 보고, 바뀌었으면 다 뜰 때까지 기다린다. */
async function settle(tabId: number, beforeUrl: string | undefined): Promise<boolean> {
  let changed = false;
  for (let t = 0; t < NAV_GRACE_MS; t += 100) {
    const tab = await tabState(tabId);
    if (!tab) return false;
    if (tab.status === "loading" || tab.url !== beforeUrl) {
      changed = true;
      break;
    }
    await sleep(100);
  }
  if (changed) {
    await waitComplete(tabId);
    await sleep(SETTLE_MS);
  }
  return changed;
}

const action = (r: Partial<ClickResult> & { page_changed: boolean }): ActionResult => ({
  kind: "action",
  ok: r.ok ?? true,
  page_changed: r.page_changed,
  message: r.message ?? null,
  cart_added: r.cart_added ?? null,
});

async function run(tabId: number, a: Action, q: NonWowQueue): Promise<ElementsResult | ActionResult> {
  const before = (await tabState(tabId))?.url;
  switch (a.tool) {
    case "read_elements": {
      await waitComplete(tabId);
      const page = await send<ElementsResult & { wowCards: WowCard[] }>(tabId, { cmd: "read" });
      q.add(page.wowCards);
      return { kind: "elements", url: page.url, elements: page.elements };
    }
    case "click": {
      let r: ClickResult;
      try {
        r = await send<ClickResult>(tabId, { cmd: "click", ref: a.args.ref }, false);
      } catch (e) {
        if (e instanceof NoReply) return action({ ok: false, message: e.message, page_changed: false });
        // 클릭으로 화면이 바뀌면 content script가 답하기 전에 사라진다
        r = { ok: true, message: null, cart_added: null };
      }
      return action({ ...r, page_changed: await settle(tabId, before) });
    }
    case "type_text": {
      const r = await send<ClickResult>(tabId, { cmd: "type", ...a.args });
      return action({ ...r, page_changed: false });
    }
    case "scroll":
      await send(tabId, { cmd: "scroll", direction: a.args.direction });
      return action({ page_changed: false });
    case "open_url":
      try {
        await send(tabId, { cmd: "navigate", url: a.args.url }, false);
      } catch {
        // 쿠팡 페이지가 아니라 content script가 없으면 탭에 주소를 넣는다
        await chrome.tabs.update(tabId, { url: a.args.url });
      }
      await sleep(300);
      await waitComplete(tabId);
      await sleep(SETTLE_MS);
      return action({ page_changed: true });
  }
}

async function handle(req: Request): Promise<Response> {
  if (req.type === "ping") return { ok: true, version: chrome.runtime.getManifest().version };
  if (req.type === "notice") {
    await editLog((l) => l.entries.push({ k: "notice", title: req.title, detail: req.detail, at: Date.now() }));
    return { ok: true };
  }
  if (req.type === "progress") {
    const p = req.progress;
    const at = Date.now();
    await editLog((l) => {
      if (p.kind === "target") l.entries.push({ k: "target", name: p.name, at });
      else if (p.kind === "result") l.entries.push({ k: "result", status: p.status, reason: p.reason, at });
      else {
        l.entries.push({ k: "done", at });
        l.running = false;
        l.busy = false;
      }
    });
    return { ok: true };
  }
  const { session: s } = await load();

  if (req.type === "open") {
    // 새 담기 — 기록을 비우고 작업 탭에 패널을 연다
    await editLog((l) => Object.assign(l, emptyLog(), { startedAt: Date.now(), running: true }));
    const tab = await chrome.tabs.create({ url: HOME, active: true });
    if (tab.id == null) return { ok: false, error: "작업 탭을 열지 못했습니다" };
    // 새 담기 — 받은 와우 카드 기록을 비운다
    session = { tabId: tab.id, queue: emptyState() };
    queue = new NonWowQueue(session.queue, fetchViaTab, sleep, persist);
    await persist();
    await waitComplete(tab.id);
    const { logged_in } = await send<{ logged_in: boolean }>(tab.id, { cmd: "login" });
    return { ok: true, logged_in };
  }

  const q = queue as NonWowQueue;
  if (req.type === "take_non_wow_prices") {
    return { ok: true, non_wow_prices: await q.take(req.wait) };
  }

  if (s.tabId == null || !(await tabState(s.tabId))) return { ok: false, error: "작업 탭이 없습니다" };
  const target =
    req.action.tool === "click"
      ? await send<ClickTarget>(s.tabId, { cmd: "label", ref: req.action.args.ref }, false).catch(() => null)
      : null;
  const text = sentence(req.action, target);
  await editLog((l) => {
    l.entries.push({ k: "action", text, at: Date.now() });
    l.busy = true;
  });
  try {
    const result = await run(s.tabId, req.action, q);
    return { ok: true, result, non_wow_prices: await q.take(false) };
  } finally {
    await editLog((l) => {
      l.busy = false;
    });
  }
}

chrome.runtime.onMessageExternal.addListener((msg, _sender, reply) => {
  const req = parseRequest(msg);
  if (!req) {
    reply({ ok: false, error: "형식 오류" } satisfies Response);
    return false;
  }
  handle(req).then(reply, (e) => reply({ ok: false, error: String(e) } satisfies Response));
  return true;
});

// 진행 패널 (§12.8) — 이 탭이 작업 탭인지, X로 닫기, 확장 버튼으로 다시 열기
chrome.runtime.onMessage.addListener((msg: PanelMessage, sender, reply) => {
  if (sender.id !== chrome.runtime.id || !msg || typeof msg !== "object" || !("panel" in msg)) return false;
  const work = async () => (await load()).session.tabId === sender.tab?.id && sender.tab?.id != null;
  (async () => {
    if (msg.panel === "hello") return { work: await work() };
    if (await work()) await editLog((l) => (l.closed = msg.panel === "close"));
    return {};
  })().then(reply, () => reply({}));
  return true;
});

// 확장 버튼 — 누른 탭에 패널을 연다. 크롬 내부 화면처럼 그릴 수 없는 탭이면 아무것도 하지 않는다
chrome.action.onClicked.addListener((tab) => {
  if (tab.id == null) return;
  chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["viewer.js"] }).catch(() => undefined);
});

// 작업 탭을 닫으면 담기가 멈춘다 — 빛·기다림 점을 거둔다
chrome.tabs.onRemoved.addListener(async (tabId) => {
  if ((await load()).session.tabId !== tabId) return;
  await editLog((l) => {
    l.running = false;
    l.busy = false;
  });
});
