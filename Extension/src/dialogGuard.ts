// 페이지 쪽(MAIN world) 스크립트 — 작업 탭에서만 쿠팡의 알림·확인 창을 띄우지 않고 그 글을 문서에 적어 둔다.
// 알림 창이 떠 있으면 탭의 스크립트가 모두 멈춰 확장이 답하지 못한다(research/backend/16 §6.12).
// 확인 창은 되돌릴 수 없는 동작을 막도록 '취소'로 답한다. 작업 탭 표시는 content.ts가 단다 — 문서와
// 그 탭의 sessionStorage에. sessionStorage는 탭마다 따로이고 같은 사이트 안에서 페이지를 옮겨도 남아,
// 열리자마자 알림을 띄우는 페이지도 처음부터 막는다. 글은 문서(`data-sajura-dialogs`)에 적어, content
// script가 붙기 전에 뜬 알림도 나중에 꺼내 간다 (page.ts의 takeDialogs).

export const WORK_FLAG = "sajuraWork";
export const DIALOGS = "sajuraDialogs";
const KEEP = 10;

export function installDialogGuard(win: Window): void {
  const { alert, confirm } = win;
  const active = () => {
    if (win.document.documentElement.dataset[WORK_FLAG] === "1") return true;
    try {
      return win.sessionStorage.getItem(WORK_FLAG) === "1";
    } catch {
      return false;
    }
  };
  const pass = (kind: string, message: unknown) => {
    const root = win.document.documentElement;
    let list: string[] = [];
    try {
      list = JSON.parse(root.dataset[DIALOGS] ?? "[]");
    } catch {
      // 깨진 값은 버린다
    }
    list.push(`${kind}: ${String(message ?? "")}`.replace(/\s+/g, " ").slice(0, 200));
    root.dataset[DIALOGS] = JSON.stringify(list.slice(-KEEP));
  };
  win.alert = (message?: unknown) => {
    if (!active()) return alert.call(win, message);
    pass("알림", message);
  };
  win.confirm = (message?: string) => {
    if (!active()) return confirm.call(win, message);
    pass("확인 창(취소함)", message);
    return false;
  };
}
