import "@testing-library/jest-dom/vitest";

// jsdom에는 ResizeObserver가 없다 — 옆 판(FollowPanel fit)이 쓴다
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
