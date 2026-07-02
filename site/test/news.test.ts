import { describe, it, expect } from 'vitest';
import { NEWS } from '../src/news.js';

describe('NEWS content', () => {
  it('is sorted ascending by date', () => {
    const dates = NEWS.map((n) => n.date);
    expect(dates).toEqual([...dates].sort());
  });
  it('includes the required milestone anchors', () => {
    const milestones = NEWS.filter((n) => n.kind === 'milestone').map((n) => n.date);
    expect(milestones).toEqual(expect.arrayContaining(['2014-03-29', '2016-03-01', '2019-01-23', '2026-07-15']));
    expect(milestones.some((d) => d.startsWith('2020'))).toBe(true);
  });
  it('has at least six world-event lines', () => {
    expect(NEWS.filter((n) => n.kind === 'world').length).toBeGreaterThanOrEqual(6);
  });
});
