// 휴대폰 전체 화면 판 — 뒤로 가기가 이전 화면으로 나가지 않고 판만 닫는다.
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useBackToClose } from "../lib/use-back-to-close";

function setAppLayout(app: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: app }) as unknown as typeof matchMedia;
}

const panelId = () => (window.history.state as { panelId?: number } | null)?.panelId;

describe("useBackToClose", () => {
  afterEach(async () => {
    Reflect.deleteProperty(window, "matchMedia");
    // 남은 판 기록을 비워 다음 시험에 넘기지 않는다
    while (panelId() !== undefined) {
      window.history.back();
      await new Promise((r) => setTimeout(r, 10));
    }
  });

  it("앱 폭에서 판이 열리면 기록을 쌓고, 뒤로 가기로 판만 닫는다", async () => {
    setAppLayout(true);
    const onClose = vi.fn();
    const before = window.history.length;
    renderHook(() => useBackToClose(true, onClose));

    expect(window.history.length).toBe(before + 1);
    expect(panelId()).toBeDefined();

    window.history.back();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("버튼으로 닫으면 쌓아 둔 기록을 지운다", async () => {
    setAppLayout(true);
    const onClose = vi.fn();
    const { rerender } = renderHook(({ open }) => useBackToClose(open, onClose), {
      initialProps: { open: true },
    });
    expect(panelId()).toBeDefined();

    rerender({ open: false });
    await waitFor(() => expect(panelId()).toBeUndefined());
    expect(onClose).not.toHaveBeenCalled();
  });

  it("겹친 판은 뒤로 가기마다 위에서부터 하나씩 닫는다", async () => {
    setAppLayout(true);
    const closeDay = vi.fn();
    const closeMenu = vi.fn();
    renderHook(() => {
      useBackToClose(true, closeDay);
      useBackToClose(true, closeMenu);
    });

    window.history.back();
    await waitFor(() => expect(closeMenu).toHaveBeenCalledTimes(1));
    expect(closeDay).not.toHaveBeenCalled();
  });

  it("판이 열린 채 다른 화면으로 갔다 돌아오면 남은 판 기록은 건너뛴다", async () => {
    setAppLayout(true);
    const { unmount } = renderHook(() => useBackToClose(true, vi.fn()));
    const stale = panelId();
    // 라우터가 다른 화면으로 옮긴 것처럼 새 기록을 쌓고 판을 내린다
    window.history.pushState({ route: "orders" }, "");
    unmount();

    window.history.back();
    // 남은 판 기록(stale)에 머물지 않고 그 아래 기록까지 내려간다
    expect(stale).toBeDefined();
    await waitFor(() => {
      expect((window.history.state as { route?: string } | null)?.route).toBeUndefined();
      expect(panelId()).toBeUndefined();
    });
  });

  it("웹 폭은 옆에 붙는 판이라 기록을 쌓지 않는다", () => {
    setAppLayout(false);
    const before = window.history.length;
    renderHook(() => useBackToClose(true, vi.fn()));
    expect(window.history.length).toBe(before);
    expect(panelId()).toBeUndefined();
  });
});
