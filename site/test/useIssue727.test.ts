import { describe, it, expect, vi } from 'vitest';
import { fetchIssue727Live } from '../src/useIssue727.js';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

describe('fetchIssue727Live', () => {
  it('parses an open issue', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ state: 'open', closed_at: null }));
    expect(await fetchIssue727Live(fetchImpl as unknown as typeof fetch)).toEqual({ state: 'open', closedAt: null });
  });
  it('parses a closed issue', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ state: 'closed', closed_at: '2027-01-01T00:00:00Z' }));
    expect(await fetchIssue727Live(fetchImpl as unknown as typeof fetch)).toEqual({ state: 'closed', closedAt: '2027-01-01T00:00:00Z' });
  });
  it('returns null on rate limit', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, false, 403));
    expect(await fetchIssue727Live(fetchImpl as unknown as typeof fetch)).toBeNull();
  });
  it('returns null when fetch throws', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('offline'); });
    expect(await fetchIssue727Live(fetchImpl as unknown as typeof fetch)).toBeNull();
  });
});
