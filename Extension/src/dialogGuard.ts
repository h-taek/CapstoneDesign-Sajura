// 페이지 쪽(MAIN world) 스크립트 — 작업 탭에서만 쿠팡의 알림·확인 창을 띄우지 않고 그 글을 넘긴다.
// 알림 창이 떠 있으면 탭의 스크립트가 모두 멈춰 확장이 답하지 못한다(research/backend/16 §6.12).
// 확인 창은 되돌릴 수 없는 동작을 막도록 '취소'로 답한다. 작업 탭 표시는 content.ts가 단다.

export const WORK_FLAG = "sajuraWork";
export const DIALOG_EVENT = "sajura-dialog";

export function installDialogGuard(win: Window): void {
  const { alert, confirm } = win;
  const active = () => win.document.documentElement.dataset[WORK_FLAG] === "1";
  const pass = (kind: string, message: unknown) =>
    win.document.dispatchEvent(new CustomEvent(DIALOG_EVENT, { detail: `${kind}: ${String(message ?? "")}` }));
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
