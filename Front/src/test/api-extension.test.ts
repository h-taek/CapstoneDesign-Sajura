// 사주라 크롬 확장 다리 단위 시험 — 확장 없음·시간 초과·ok: false·정상 메시지 (04_fe.md §12.3).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isExtensionRuntimeAvailable,
  openExtension,
  pingExtension,
  runExtension,
  sendExtensionNotice,
  sendExtensionProgress,
  takeNonWowPrices,
} from "../lib/extension";

const TEST_EXT_ID = "cbplmciiejdjhhogkjhehfhdipocmdkf";

interface MockChromeRuntime {
  lastError?: { message?: string } | undefined;
  sendMessage: ReturnType<typeof vi.fn>;
}

function setMockChromeRuntime(runtime?: MockChromeRuntime) {
  if (!runtime) {
    (globalThis as { chrome?: unknown }).chrome = undefined;
    return;
  }
  (globalThis as { chrome?: unknown }).chrome = { runtime };
}

describe("extension 다리 (src/lib/extension.ts)", () => {
  beforeEach(() => {
    setMockChromeRuntime(undefined);
  });

  afterEach(() => {
    setMockChromeRuntime(undefined);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("chrome.runtime이 없으면 확장 없음(ok: false)을 돌려준다", async () => {
    expect(isExtensionRuntimeAvailable(TEST_EXT_ID)).toBe(false);
    const res = await pingExtension({ extensionId: TEST_EXT_ID });
    expect(res).toEqual({ ok: false, error: "확장 없음" });
  });

  it("확장 ID가 비어 있으면 sendMessage를 부르지 않고 확장 없음을 돌려준다", async () => {
    const sendMessage = vi.fn();
    setMockChromeRuntime({ sendMessage });

    expect(isExtensionRuntimeAvailable("")).toBe(false);
    const res = await pingExtension({ extensionId: "" });
    expect(res).toEqual({ ok: false, error: "확장 없음" });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("확장이 시간 안에 답하지 않으면 시간 초과(ok: false)로 끝난다", async () => {
    vi.useFakeTimers();
    const sendMessage = vi.fn(() => {
      // 응답 콜백을 부르지 않아 지연 상황을 재현한다
    });
    setMockChromeRuntime({ sendMessage });

    const pending = pingExtension({ extensionId: TEST_EXT_ID, timeoutMs: 500 });
    await vi.advanceTimersByTimeAsync(500);
    const res = await pending;

    expect(res).toEqual({ ok: false, error: "시간 초과" });
  });

  it("확장이 ok: false를 돌려주면 error 사유를 그대로 전달한다", async () => {
    const sendMessage = vi.fn((_id: string, _msg: unknown, cb?: (response: unknown) => void) => {
      cb?.({ ok: false, error: "작업 탭이 닫혔습니다" });
    });
    setMockChromeRuntime({ sendMessage });

    const res = await runExtension(
      { tool: "click", args: { ref: "12" } },
      { extensionId: TEST_EXT_ID },
    );
    expect(res).toEqual({ ok: false, error: "작업 탭이 닫혔습니다" });
  });

  it("chrome.runtime.lastError가 있으면 그 오류 메시지로 ok: false를 돌려준다", async () => {
    const runtime: MockChromeRuntime = {
      lastError: { message: "Could not establish connection." },
      sendMessage: vi.fn((_id: string, _msg: unknown, cb?: (response: unknown) => void) => {
        cb?.(undefined);
      }),
    };
    setMockChromeRuntime(runtime);

    const res = await openExtension({ extensionId: TEST_EXT_ID });
    expect(res).toEqual({ ok: false, error: "Could not establish connection." });
  });

  it("ping·open·run·take_non_wow_prices·notice·progress 요청을 형식대로 보내고 답을 받는다", async () => {
    const sendMessage = vi.fn(
      (_id: string, msg: { type: string }, cb?: (response: unknown) => void) => {
        switch (msg.type) {
          case "ping":
            cb?.({ ok: true, version: "0.1.0" });
            break;
          case "open":
            cb?.({ ok: true, logged_in: true });
            break;
          case "run":
            cb?.({
              ok: true,
              result: {
                kind: "action",
                ok: true,
                page_changed: false,
                message: null,
                cart_added: {
                  item_id: "1001",
                  product_id: "2001",
                  vendor_item_id: "3001",
                  price: 12900,
                },
              },
              non_wow_prices: [],
            });
            break;
          case "take_non_wow_prices":
            cb?.({
              ok: true,
              non_wow_prices: [
                {
                  item_id: "1001",
                  non_wow_price: 13500,
                  display_price: 12900,
                  unit_price_text: "100g당 1,350원",
                },
              ],
            });
            break;
          case "notice":
          case "progress":
            cb?.({ ok: true });
            break;
        }
      },
    );
    setMockChromeRuntime({ sendMessage });

    const pingRes = await pingExtension({ extensionId: TEST_EXT_ID });
    expect(pingRes).toEqual({ ok: true, version: "0.1.0" });

    const openRes = await openExtension({ extensionId: TEST_EXT_ID });
    expect(openRes).toEqual({ ok: true, logged_in: true });

    const runRes = await runExtension(
      { tool: "click", args: { ref: "7" } },
      { extensionId: TEST_EXT_ID },
    );
    expect(runRes.ok).toBe(true);

    const pricesRes = await takeNonWowPrices(true, { extensionId: TEST_EXT_ID });
    expect(pricesRes).toEqual({
      ok: true,
      non_wow_prices: [
        {
          item_id: "1001",
          non_wow_price: 13500,
          display_price: 12900,
          unit_price_text: "100g당 1,350원",
        },
      ],
    });

    const noticeRes = await sendExtensionNotice("쿠팡에 로그인해 주세요", "사유", {
      extensionId: TEST_EXT_ID,
    });
    expect(noticeRes).toEqual({ ok: true });

    const progressRes = await sendExtensionProgress(
      { kind: "result", status: "ADDED", reason: null },
      { extensionId: TEST_EXT_ID },
    );
    expect(progressRes).toEqual({ ok: true });

    expect(sendMessage).toHaveBeenCalledTimes(6);
    expect(sendMessage).toHaveBeenNthCalledWith(
      1,
      TEST_EXT_ID,
      { type: "ping" },
      expect.any(Function),
    );
    expect(sendMessage).toHaveBeenNthCalledWith(
      4,
      TEST_EXT_ID,
      { type: "take_non_wow_prices", wait: true },
      expect.any(Function),
    );
    // progress는 필드를 바로 붙인다 — 확장의 parseRequest가 이 모양만 받는다 (04_fe.md §12.3)
    expect(sendMessage).toHaveBeenNthCalledWith(
      6,
      TEST_EXT_ID,
      { type: "progress", kind: "result", status: "ADDED", reason: null },
      expect.any(Function),
    );
  });
});
