import { describe, it, expect } from 'vitest';
import { openDb, queryTracking, getMeta } from '../src/db.js';
import { makeGithubClient, type HbCommit, type AwscliTag } from '../src/github.js';
import { runIngest } from '../src/ingest.js';

const TAGS: AwscliTag[] = [
  { version: '2.35.14', major: 2, tagName: '2.35.14', commitSha: 'c14', releasedAt: '2026-07-01T18:00:00Z' },
];
const RUN1: HbCommit[] = [
  { sha: 'f1', date: '2026-07-01T20:28:00Z', message: 'awscli 2.35.14' },
];
const RUN2: HbCommit[] = [
  { sha: 'b1', date: '2026-07-01T21:38:00Z', message: 'awscli: update 2.35.14 bottle.' },
];

function client(tags: AwscliTag[], awscliCommits: HbCommit[]) {
  return makeGithubClient({
    graphql: async () => ({}),
    // tags come pre-resolved via a wrapper below; here commitsPage returns awscli page 1 only
    commitsPage: async (path, page) => (path.endsWith('awscli.rb') && page === 1 ? awscliCommits : []),
    issue727: async () => ({ state: 'open', createdAt: 'x', closedAt: null, url: 'u' }),
  });
}

describe('runIngest', () => {
  it('ingests releases + formula, then back-fills the bottle on a later run (incremental)', async () => {
    const db = openDb(':memory:');

    // Run 1: formula only (bottle not built yet)
    const gh1 = client(TAGS, RUN1);
    gh1.fetchAwscliTags = async () => TAGS;
    await runIngest(db, gh1, { windowStart: '2020-01-01T00:00:00Z' });
    let rows = queryTracking(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].formulaAt).toBe('2026-07-01T20:28:00Z');
    expect(rows[0].bottleAt).toBeNull();
    expect(getMeta(db, 'cursor:awscli')).toBe('f1');

    // Run 2: the bottle commit landed (newer than cursor f1)
    const gh2 = client(TAGS, [...RUN2, ...RUN1]); // newest first: b1 then f1
    gh2.fetchAwscliTags = async () => TAGS;
    await runIngest(db, gh2, { windowStart: '2020-01-01T00:00:00Z' });
    rows = queryTracking(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].bottleAt).toBe('2026-07-01T21:38:00Z');
    expect(getMeta(db, 'cursor:awscli')).toBe('b1');
  });
});
