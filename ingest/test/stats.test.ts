import { describe, it, expect } from 'vitest';
import { summarize, hoursBetween, withinWindow } from '../src/stats.js';

describe('summarize', () => {
  it('handles empty', () => {
    expect(summarize([])).toEqual({ mean: 0, median: 0, p90: 0, n: 0 });
  });
  it('computes mean, median, p90, n', () => {
    const s = summarize([1, 2, 3, 4, 10]);
    expect(s.n).toBe(5);
    expect(s.mean).toBeCloseTo(4, 6);
    expect(s.median).toBe(3);
    expect(s.p90).toBeCloseTo(7.6, 6); // linear interpolation at 0.9
  });
  it('median of even count averages the middle two', () => {
    expect(summarize([1, 2, 3, 4]).median).toBe(2.5);
  });
});

describe('hoursBetween', () => {
  it('computes fractional hours', () => {
    expect(hoursBetween('2026-07-01T20:28:00Z', '2026-07-01T21:58:00Z')).toBeCloseTo(1.5, 6);
  });
});

describe('withinWindow', () => {
  const now = '2026-07-02T00:00:00Z';
  it('null days is always true', () => {
    expect(withinWindow('2020-01-01T00:00:00Z', now, null)).toBe(true);
  });
  it('respects the day window', () => {
    expect(withinWindow('2026-06-20T00:00:00Z', now, 30)).toBe(true);
    expect(withinWindow('2026-05-01T00:00:00Z', now, 30)).toBe(false);
  });
});
