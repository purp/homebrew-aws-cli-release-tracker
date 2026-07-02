import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// No real network in tests: live #727 fetch resolves to a non-OK response,
// so useIssue727 falls back to the baseline it was given.
vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403, json: async () => ({}) })));

// jsdom has no ResizeObserver; Recharts' ResponsiveContainer needs one to measure its container.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);
