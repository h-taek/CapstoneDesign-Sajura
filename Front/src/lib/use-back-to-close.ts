// 휴대폰 전체 화면 판의 뒤로 가기 — 판이 열려 있는 동안 방문 기록을 하나 쌓아, 휴대폰 뒤로 가기가
// 이전 화면으로 나가지 않고 판만 닫게 한다. 웹(lg 이상)은 옆에 붙는 판이라 그대로 둔다.
import { useEffect, useRef } from "react";

const APP_LAYOUT = "(max-width: 63.999rem)"; // Tailwind lg(64rem) 미만 — 판이 화면을 덮는 폭

let nextId = 0;
// 버튼으로 닫혀 지울 차례인 판 기록. history.back()은 나중에 처리되므로 한 틱 미루고,
// 그 사이에 판이 다시 열리면(StrictMode 재실행, 닫자마자 다른 판 열기) 지우지 않고 그 기록을 다시 쓴다
let pendingBack: { panelId: number; timer: ReturnType<typeof setTimeout> } | null = null;
// 지금 열려 있는 판의 기록. 판이 열린 채 다른 화면으로 가면 그 기록이 남는데, 뒤로 가기로 거기 닿으면
// 같은 화면에서 한 번 헛돌므로 한 번 더 뒤로 가서 건너뛴다
const openPanels = new Set<number>();
let skipInstalled = false;

function installStaleSkip(): void {
  if (skipInstalled) return;
  skipInstalled = true;
  window.addEventListener("popstate", () => {
    const id = window.history.state?.panelId;
    if (id !== undefined && !openPanels.has(id)) window.history.back();
  });
}

export function useBackToClose(open: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open || !window.matchMedia?.(APP_LAYOUT).matches) return;
    installStaleSkip();
    let panelId: number;
    if (pendingBack && window.history.state?.panelId === pendingBack.panelId) {
      clearTimeout(pendingBack.timer);
      panelId = pendingBack.panelId;
      pendingBack = null;
    } else {
      nextId += 1;
      panelId = nextId;
      // 라우터가 넣어 둔 state는 그대로 두고 판 표시만 더한다 — 같은 주소라 화면은 바뀌지 않는다
      window.history.pushState({ ...window.history.state, panelId }, "");
    }

    // 뒤로 가기로 이 판의 기록을 벗어나면 닫는다. 위에 겹친 판의 기록만 빠졌으면(지금 기록이 이 판) 그대로 둔다
    const onPop = () => {
      if (window.history.state?.panelId !== panelId) onCloseRef.current();
    };
    openPanels.add(panelId);
    window.addEventListener("popstate", onPop);
    return () => {
      openPanels.delete(panelId);
      window.removeEventListener("popstate", onPop);
      // 버튼으로 닫혀 이 판의 기록이 맨 위에 남았으면 지운다. 다른 화면으로 이동해 닫힌 경우는 건드리지 않는다
      if (window.history.state?.panelId !== panelId) return;
      const timer = setTimeout(() => {
        pendingBack = null;
        if (window.history.state?.panelId === panelId) window.history.back();
      }, 0);
      pendingBack = { panelId, timer };
    };
  }, [open]);
}
