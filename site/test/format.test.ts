import { describe, it, expect } from 'vitest';
import { formatDuration, formatDate, daysSince } from '../src/format.js';

describe('formatDuration', () => {
  it('minutes under an hour', () => expect(formatDuration(0.7)).toBe('42m'));
  it('hours and minutes', () => expect(formatDuration(3.2)).toBe('3h 12m'));
  it('whole hours drop minutes', () => expect(formatDuration(3)).toBe('3h'));
  it('days past 48h', () => expect(formatDuration(50.4)).toBe('2.1 d'));
});

describe('formatDate', () => {
  it('formats UTC', () => expect(formatDate('2026-07-01T18:00:00Z')).toBe('Jul 1, 2026'));
});

describe('daysSince', () => {
  it('counts whole days', () => {
    const now = Date.parse('2026-07-02T00:00:00Z');
    expect(daysSince('2014-03-29T22:32:43Z', now)).toBe(4478);
  });
});
