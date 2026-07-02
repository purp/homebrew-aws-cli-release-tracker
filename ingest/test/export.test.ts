import { describe, it, expect } from 'vitest';
import { openDb, upsertAwscliRelease, upsertHomebrewFormula, upsertHomebrewBottle } from '../src/db.js';
import { buildDataJson } from '../src/export.js';

const ISSUE = { state: 'open' as const, createdAt: '2014-03-29T22:32:43Z', closedAt: null, url: 'u' };

function db2() {
  const db = openDb(':memory:');
  // one fully-shipped v2 release: notice 2h, build 1h, total 3h
  upsertAwscliRelease(db, { version: '2.35.14', major: 2, tagName: '2.35.14', commitSha: 'a', releasedAt: '2026-07-01T18:00:00Z' });
  upsertHomebrewFormula(db, { formula: 'awscli', version: '2.35.14', commitSha: 'f', at: '2026-07-01T20:00:00Z' });
  upsertHomebrewBottle(db, { formula: 'awscli', version: '2.35.14', commitSha: 'b', at: '2026-07-01T21:00:00Z' });
  // one v1 release AWS shipped but with no matching homebrew row (coverage gap)
  upsertAwscliRelease(db, { version: '1.45.29', major: 1, tagName: '1.45.29', commitSha: 'c', releasedAt: '2026-06-15T00:00:00Z' });
  return db;
}

describe('buildDataJson', () => {
  const data = buildDataJson(db2(), { generatedAt: '2026-07-02T00:00:00Z', windowStart: '2020-01-01T00:00:00Z', issue727: ISSUE });

  it('computes the three headline metrics (all-time window)', () => {
    expect(data.headline.totalBottleLag.all).toMatchObject({ mean: 3, n: 1 });
    expect(data.headline.noticeLatency.all).toMatchObject({ mean: 2, n: 1 });
    expect(data.headline.bottleBuildLatency.all).toMatchObject({ mean: 1, n: 1 });
  });

  it('computes coverage per version', () => {
    expect(data.coverage.v2).toEqual({ awscli: 1, shipped: 1, pct: 100 });
    expect(data.coverage.v1).toEqual({ awscli: 1, shipped: 0, pct: 0 });
    expect(data.coverage.overall).toEqual({ awscli: 2, shipped: 1, pct: 50 });
  });

  it('emits a series point with derived durations and passes through issue727', () => {
    expect(data.series).toHaveLength(1);
    expect(data.series[0]).toMatchObject({ version: '2.35.14', totalH: 3, noticeH: 2, buildH: 1 });
    expect(data.issue727).toEqual(ISSUE);
    expect(data.notes.awscli1MaintenanceMode).toBe('2026-07-15');
  });
});
