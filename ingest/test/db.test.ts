import { describe, it, expect } from 'vitest';
import { openDb, upsertAwscliRelease, upsertHomebrewFormula, upsertHomebrewBottle, queryTracking, getMeta, setMeta, countReleases } from '../src/db.js';

function seed() {
  const db = openDb(':memory:');
  upsertAwscliRelease(db, { version: '2.35.14', major: 2, tagName: '2.35.14', commitSha: 'a', releasedAt: '2026-07-01T18:00:00Z' });
  return db;
}

describe('tracking view', () => {
  it('joins release + formula + bottle into one row with both timestamps', () => {
    const db = seed();
    upsertHomebrewFormula(db, { formula: 'awscli', version: '2.35.14', commitSha: 'f', at: '2026-07-01T20:28:00Z' });
    upsertHomebrewBottle(db, { formula: 'awscli', version: '2.35.14', commitSha: 'b', at: '2026-07-01T21:38:00Z' });
    const rows = queryTracking(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ formula: 'awscli', version: '2.35.14', major: 2, releasedAt: '2026-07-01T18:00:00Z', formulaAt: '2026-07-01T20:28:00Z', bottleAt: '2026-07-01T21:38:00Z' });
  });

  it('back-fills the bottle onto the row a formula commit created (order independent)', () => {
    const db = seed();
    upsertHomebrewBottle(db, { formula: 'awscli', version: '2.35.14', commitSha: 'b', at: '2026-07-01T21:38:00Z' });
    upsertHomebrewFormula(db, { formula: 'awscli', version: '2.35.14', commitSha: 'f', at: '2026-07-01T20:28:00Z' });
    const rows = queryTracking(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].formulaAt).toBe('2026-07-01T20:28:00Z');
    expect(rows[0].bottleAt).toBe('2026-07-01T21:38:00Z');
  });

  it('excludes revision-only rebuilds from the view', () => {
    const db = openDb(':memory:');
    upsertAwscliRelease(db, { version: '1.45.0', major: 1, tagName: '1.45.0', commitSha: 'a', releasedAt: '2026-05-01T00:00:00Z' });
    upsertHomebrewBottle(db, { formula: 'awscli@1', version: '1.45.0_1', commitSha: 'b', at: '2026-05-12T00:00:00Z' });
    expect(queryTracking(db)).toHaveLength(0);
  });

  it('has no tracking row when the release tag is unknown', () => {
    const db = openDb(':memory:');
    upsertHomebrewFormula(db, { formula: 'awscli', version: '9.9.9', commitSha: 'f', at: '2026-07-01T20:28:00Z' });
    expect(queryTracking(db)).toHaveLength(0);
  });
});

describe('meta + counts', () => {
  it('round-trips meta', () => {
    const db = openDb(':memory:');
    expect(getMeta(db, 'x')).toBeUndefined();
    setMeta(db, 'x', 'sha1');
    setMeta(db, 'x', 'sha2');
    expect(getMeta(db, 'x')).toBe('sha2');
  });
  it('counts releases per major', () => {
    const db = seed();
    upsertAwscliRelease(db, { version: '1.45.0', major: 1, tagName: '1.45.0', commitSha: 'z', releasedAt: '2026-05-01T00:00:00Z' });
    expect(countReleases(db)).toEqual(expect.arrayContaining([{ major: 1, n: 1 }, { major: 2, n: 1 }]));
  });
});
