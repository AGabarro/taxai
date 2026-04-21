import '@testing-library/jest-dom'

// Recharts' ResponsiveContainer uses ResizeObserver which isn't available in jsdom
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub
