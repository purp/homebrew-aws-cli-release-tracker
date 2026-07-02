import { describe, it, expect } from 'vitest';
import { data } from '../src/data.js';

describe('committed data.json matches the contract', () => {
  it('has the headline windows and issue727', () => {
    expect(data.headline.totalBottleLag).toHaveProperty('d30');
    expect(data.headline.totalBottleLag).toHaveProperty('all');
    expect(data.headline.noticeLatency).toHaveProperty('y1');
    expect(['open', 'closed']).toContain(data.issue727.state);
    expect(data.issue727.createdAt).toBe('2014-03-29T22:32:43Z');
    expect(Array.isArray(data.series)).toBe(true);
  });
});
