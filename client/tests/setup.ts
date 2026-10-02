import "@testing-library/jest-dom/vitest";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof global !== "undefined" && !global.ResizeObserver) {
  global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
}
