import "@testing-library/jest-dom/vitest";

// jsdom에는 모달 dialog(showModal·close)가 없다 — 약관 보기·설치 안내 창이 쓴다
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true;
};
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.open = false;
  this.dispatchEvent(new Event("close"));
};

// jsdom에는 ResizeObserver가 없다 — 옆 판(FollowPanel fit)이 쓴다
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
