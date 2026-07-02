# AWS CLI ↔ Homebrew Tracker — Data Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pull aws-cli release + Homebrew formula/bottle data straight from the GitHub API into a committed SQLite database, and export a committed `data/data.json` of latency stats for the web app to render.

**Architecture:** A TypeScript CLI (`ingest/`) fetches aws-cli `1.x`/`2.x` tag commit dates (GraphQL) and Homebrew `awscli`/`awscli@1` formula+bottle commits (REST), upserts them into `data/tracker.sqlite` incrementally, then computes stats and writes `data/data.json`. Pure logic (parsing, stats) is isolated from I/O (GitHub client, DB) so it's unit-testable; the GitHub client takes injected fetchers so ingestion is testable without the network.

**Tech Stack:** Node ≥ 20 (ESM), TypeScript run via `tsx`, `better-sqlite3`, `octokit`, Vitest. npm workspaces at repo root.

## Global Constraints

- **Node:** ≥ 20; all packages `"type": "module"` (ESM). Repo uses npm **workspaces** (`ingest`, `site`).
- **Window start:** `2020-01-01T00:00:00Z` — ignore any aws-cli release older than this. Constant name `WINDOW_START`.
- **Formula ↔ major mapping:** `awscli` ⇔ major **2**; `awscli@1` ⇔ major **1**.
- **GitHub targets:** aws-cli repo `aws/aws-cli`; Homebrew repo `Homebrew/homebrew-core`; formula paths `Formula/a/awscli.rb` and `Formula/a/awscli@1.rb`; issue `aws/aws-cli#727`.
- **Commit-message patterns** (match by message, not author):
  - Formula merge: `/^awscli(@1)? (\d[\w.]*)$/` → group2 = version.
  - Bottle build: `/^awscli(@1)?: update (\d[\w.]*) bottle\.$/` → group2 = version.
- **Version normalization:** strip a trailing Homebrew revision `/_(\d+)$/` → `versionNorm` + `revision` (default 0).
- **Timestamps:** store ISO-8601 UTC strings. aws-cli release time = tag's **commit `committedDate`**; Homebrew commit time = `commit.committer.date`.
- **Generated artifacts (committed):** `data/tracker.sqlite` (source of truth), `data/data.json` (human-diffable). Durations in `data.json` are **hours** (number).
- **Commits are GPG-signed** (agent cache primed); end messages with the repo's `Co-Authored-By` / `Claude-Session` trailers.

---

### Task 1: Repo scaffold + commit-message parser & version normalizer

**Files:**
- Create: `package.json` (root)
- Create: `ingest/package.json`
- Create: `ingest/tsconfig.json`
- Create: `ingest/vitest.config.ts`
- Create: `ingest/src/parse.ts`
- Test: `ingest/test/parse.test.ts`

**Interfaces:**
- Produces:
  - `type Formula = 'awscli' | 'awscli@1'`
  - `parseHomebrewCommit(message: string): { formula: Formula; version: string; kind: 'formula' | 'bottle' } | null`
  - `normalizeVersion(raw: string): { versionNorm: string; revision: number }`
  - `majorOf(versionNorm: string): number` (integer of the part before the first `.`)
  - `formulaForMajor(major: number): Formula`

- [ ] **Step 1: Create the root workspace `package.json`**

```json
{
  "name": "aws-cli-release-tracker",
  "private": true,
  "type": "module",
  "workspaces": ["ingest", "site"],
  "scripts": {
    "refresh": "npm -w ingest run refresh",
    "test": "npm -w ingest run test"
  }
}
```

- [ ] **Step 2: Create `ingest/package.json`**

```json
{
  "name": "ingest",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "refresh": "tsx src/cli.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "better-sqlite3": "^11.8.0",
    "octokit": "^4.1.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 3: Create `ingest/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noEmit": true
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 4: Create `ingest/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
});
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`
Expected: installs workspaces; `node_modules/` present at root (already gitignored). `better-sqlite3` compiles its native binding.

- [ ] **Step 6: Write the failing test** — `ingest/test/parse.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { parseHomebrewCommit, normalizeVersion, majorOf, formulaForMajor } from '../src/parse.js';

describe('parseHomebrewCommit', () => {
  it('parses a v2 formula merge', () => {
    expect(parseHomebrewCommit('awscli 2.35.14')).toEqual({ formula: 'awscli', version: '2.35.14', kind: 'formula' });
  });
  it('parses a v1 formula merge', () => {
    expect(parseHomebrewCommit('awscli@1 1.45.30')).toEqual({ formula: 'awscli@1', version: '1.45.30', kind: 'formula' });
  });
  it('parses a v2 bottle build', () => {
    expect(parseHomebrewCommit('awscli: update 2.35.14 bottle.')).toEqual({ formula: 'awscli', version: '2.35.14', kind: 'bottle' });
  });
  it('parses a v1 bottle build', () => {
    expect(parseHomebrewCommit('awscli@1: update 1.45.30 bottle.')).toEqual({ formula: 'awscli@1', version: '1.45.30', kind: 'bottle' });
  });
  it('parses a revisioned version', () => {
    expect(parseHomebrewCommit('awscli@1: update 1.45.0_1 bottle.')).toEqual({ formula: 'awscli@1', version: '1.45.0_1', kind: 'bottle' });
  });
  it('ignores unrelated commits', () => {
    expect(parseHomebrewCommit('awscli@1: deprecate when maintenance mode starts (2026-07-15)')).toBeNull();
    expect(parseHomebrewCommit('some other formula 1.2.3')).toBeNull();
  });
});

describe('normalizeVersion', () => {
  it('strips a revision suffix', () => {
    expect(normalizeVersion('1.45.0_1')).toEqual({ versionNorm: '1.45.0', revision: 1 });
  });
  it('leaves a plain version alone', () => {
    expect(normalizeVersion('2.35.14')).toEqual({ versionNorm: '2.35.14', revision: 0 });
  });
});

describe('majorOf / formulaForMajor', () => {
  it('reads the major', () => {
    expect(majorOf('2.35.14')).toBe(2);
    expect(majorOf('1.45.0')).toBe(1);
  });
  it('maps major to formula', () => {
    expect(formulaForMajor(1)).toBe('awscli@1');
    expect(formulaForMajor(2)).toBe('awscli');
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm -w ingest test`
Expected: FAIL — `Cannot find module '../src/parse.js'`.

- [ ] **Step 8: Write `ingest/src/parse.ts`**

```ts
export type Formula = 'awscli' | 'awscli@1';

const FORMULA_RE = /^awscli(@1)? (\d[\w.]*)$/;
const BOTTLE_RE = /^awscli(@1)?: update (\d[\w.]*) bottle\.$/;

export function parseHomebrewCommit(
  message: string,
): { formula: Formula; version: string; kind: 'formula' | 'bottle' } | null {
  const line = message.split('\n')[0].trim();
  const bottle = BOTTLE_RE.exec(line);
  if (bottle) return { formula: bottle[1] ? 'awscli@1' : 'awscli', version: bottle[2], kind: 'bottle' };
  const formula = FORMULA_RE.exec(line);
  if (formula) return { formula: formula[1] ? 'awscli@1' : 'awscli', version: formula[2], kind: 'formula' };
  return null;
}

export function normalizeVersion(raw: string): { versionNorm: string; revision: number } {
  const m = /_(\d+)$/.exec(raw);
  if (m) return { versionNorm: raw.slice(0, m.index), revision: Number(m[1]) };
  return { versionNorm: raw, revision: 0 };
}

export function majorOf(versionNorm: string): number {
  return Number(versionNorm.split('.')[0]);
}

export function formulaForMajor(major: number): Formula {
  return major === 1 ? 'awscli@1' : 'awscli';
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npm -w ingest test`
Expected: PASS (all parse tests green).

- [ ] **Step 10: Commit**

```bash
git add package.json ingest/package.json ingest/tsconfig.json ingest/vitest.config.ts ingest/src/parse.ts ingest/test/parse.test.ts package-lock.json
git commit -m "feat(ingest): scaffold workspace + commit-message parser

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YbcAbdkFNTQ76nEZ6RxqXm"
```

---

### Task 2: Stats math module

**Files:**
- Create: `ingest/src/stats.ts`
- Test: `ingest/test/stats.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface Summary { mean: number; median: number; p90: number; n: number }`
  - `summarize(values: number[]): Summary` — empty input → `{ mean: 0, median: 0, p90: 0, n: 0 }`.
  - `hoursBetween(startIso: string, endIso: string): number` — `(end - start)` in hours (may be negative).
  - `withinWindow(iso: string, nowIso: string, days: number | null): boolean` — `days === null` ⇒ always true; else `iso >= now - days`.

- [ ] **Step 1: Write the failing test** — `ingest/test/stats.test.ts`

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w ingest test stats`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `ingest/src/stats.ts`**

```ts
export interface Summary { mean: number; median: number; p90: number; n: number }

const HOUR_MS = 3600_000;
const DAY_MS = 86_400_000;

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function summarize(values: number[]): Summary {
  if (values.length === 0) return { mean: 0, median: 0, p90: 0, n: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  return { mean, median: quantile(sorted, 0.5), p90: quantile(sorted, 0.9), n: sorted.length };
}

export function hoursBetween(startIso: string, endIso: string): number {
  return (Date.parse(endIso) - Date.parse(startIso)) / HOUR_MS;
}

export function withinWindow(iso: string, nowIso: string, days: number | null): boolean {
  if (days === null) return true;
  return Date.parse(iso) >= Date.parse(nowIso) - days * DAY_MS;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm -w ingest test stats`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ingest/src/stats.ts ingest/test/stats.test.ts
git commit -m "feat(ingest): stats math (summarize, hoursBetween, withinWindow)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YbcAbdkFNTQ76nEZ6RxqXm"
```

---

### Task 3: SQLite layer (schema, upserts, tracking view)

**Files:**
- Create: `ingest/src/db.ts`
- Test: `ingest/test/db.test.ts`

**Interfaces:**
- Consumes: `Formula` from `parse.ts`; `normalizeVersion`, `majorOf`.
- Produces:
  - `type DB = Database.Database` (re-export type alias `AppDb`)
  - `openDb(path: string): AppDb` — opens/creates, runs `initSchema`, returns handle.
  - `initSchema(db: AppDb): void`
  - `upsertAwscliRelease(db, r: { version: string; major: number; tagName: string; commitSha: string; releasedAt: string }): void`
  - `upsertHomebrewFormula(db, a: { formula: Formula; version: string; commitSha: string; at: string }): void`
  - `upsertHomebrewBottle(db, a: { formula: Formula; version: string; commitSha: string; at: string }): void`
  - `getMeta(db, key: string): string | undefined`
  - `setMeta(db, key: string, value: string): void`
  - `interface TrackingRow { formula: Formula; version: string; major: number; releasedAt: string; formulaAt: string | null; bottleAt: string | null }`
  - `queryTracking(db): TrackingRow[]` — from the view, ordered by `releasedAt` ascending.
  - `countReleases(db): { major: number; n: number }[]`

Both Homebrew upserts compute `versionNorm`/`revision` via `normalizeVersion`, and store both raw `version` and `versionNorm`/`revision`. They **insert-or-update the matching `(formula, version)` row**, filling only their own columns (so a later bottle commit back-fills `bottle_at` on the row a formula commit created, and vice-versa).

- [ ] **Step 1: Write the failing test** — `ingest/test/db.test.ts`

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w ingest test db`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `ingest/src/db.ts`**

```ts
import Database from 'better-sqlite3';
import { normalizeVersion, majorOf, type Formula } from './parse.js';

export type AppDb = Database.Database;

export function openDb(path: string): AppDb {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  initSchema(db);
  return db;
}

export function initSchema(db: AppDb): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS awscli_release (
      version TEXT PRIMARY KEY, major INTEGER NOT NULL,
      tag_name TEXT NOT NULL, commit_sha TEXT NOT NULL, released_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS homebrew_update (
      formula TEXT NOT NULL, version TEXT NOT NULL,
      version_norm TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0,
      formula_commit_sha TEXT, formula_at TEXT,
      bottle_commit_sha TEXT, bottle_at TEXT,
      PRIMARY KEY (formula, version)
    );
    CREATE TABLE IF NOT EXISTS meta ( key TEXT PRIMARY KEY, value TEXT NOT NULL );
    DROP VIEW IF EXISTS tracking;
    CREATE VIEW tracking AS
      SELECT h.formula AS formula, h.version_norm AS version, r.major AS major,
             r.released_at AS releasedAt, h.formula_at AS formulaAt, h.bottle_at AS bottleAt
      FROM homebrew_update h
      JOIN awscli_release r ON r.version = h.version_norm
      WHERE h.revision = 0
      ORDER BY r.released_at ASC;
  `);
}

export function upsertAwscliRelease(
  db: AppDb,
  r: { version: string; major: number; tagName: string; commitSha: string; releasedAt: string },
): void {
  db.prepare(`
    INSERT INTO awscli_release (version, major, tag_name, commit_sha, released_at)
    VALUES (@version, @major, @tagName, @commitSha, @releasedAt)
    ON CONFLICT(version) DO UPDATE SET
      major=excluded.major, tag_name=excluded.tag_name,
      commit_sha=excluded.commit_sha, released_at=excluded.released_at
  `).run(r);
}

function ensureHomebrewRow(db: AppDb, formula: Formula, version: string): void {
  const { versionNorm, revision } = normalizeVersion(version);
  db.prepare(`
    INSERT INTO homebrew_update (formula, version, version_norm, revision)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(formula, version) DO NOTHING
  `).run(formula, version, versionNorm, revision);
}

export function upsertHomebrewFormula(
  db: AppDb,
  a: { formula: Formula; version: string; commitSha: string; at: string },
): void {
  ensureHomebrewRow(db, a.formula, a.version);
  db.prepare(`
    UPDATE homebrew_update SET formula_commit_sha=@commitSha, formula_at=@at
    WHERE formula=@formula AND version=@version
  `).run(a);
}

export function upsertHomebrewBottle(
  db: AppDb,
  a: { formula: Formula; version: string; commitSha: string; at: string },
): void {
  ensureHomebrewRow(db, a.formula, a.version);
  db.prepare(`
    UPDATE homebrew_update SET bottle_commit_sha=@commitSha, bottle_at=@at
    WHERE formula=@formula AND version=@version
  `).run(a);
}

export function getMeta(db: AppDb, key: string): string | undefined {
  const row = db.prepare(`SELECT value FROM meta WHERE key=?`).get(key) as { value: string } | undefined;
  return row?.value;
}

export function setMeta(db: AppDb, key: string, value: string): void {
  db.prepare(`INSERT INTO meta (key, value) VALUES (?, ?)
              ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(key, value);
}

export interface TrackingRow {
  formula: Formula; version: string; major: number;
  releasedAt: string; formulaAt: string | null; bottleAt: string | null;
}

export function queryTracking(db: AppDb): TrackingRow[] {
  return db.prepare(`SELECT formula, version, major, releasedAt, formulaAt, bottleAt FROM tracking`).all() as TrackingRow[];
}

export function countReleases(db: AppDb): { major: number; n: number }[] {
  return db.prepare(`SELECT major, COUNT(*) AS n FROM awscli_release GROUP BY major`).all() as { major: number; n: number }[];
}

// majorOf is re-exported for callers that need it alongside the DB helpers.
export { majorOf };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm -w ingest test db`
Expected: PASS (5 db tests green).

- [ ] **Step 5: Commit**

```bash
git add ingest/src/db.ts ingest/test/db.test.ts
git commit -m "feat(ingest): sqlite schema, upserts, and tracking view

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YbcAbdkFNTQ76nEZ6RxqXm"
```

---

### Task 4: GitHub client (injectable fetchers)

**Files:**
- Create: `ingest/src/github.ts`
- Test: `ingest/test/github.test.ts`

**Interfaces:**
- Consumes: `majorOf`, `Formula` from `parse.ts`.
- Produces:
  - `interface AwscliTag { version: string; major: number; tagName: string; commitSha: string; releasedAt: string }`
  - `interface HbCommit { sha: string; date: string; message: string }`
  - `interface Issue727Data { state: 'open' | 'closed'; createdAt: string; closedAt: string | null; url: string }`
  - `type GraphqlFn = (query: string, vars: Record<string, unknown>) => Promise<any>`
  - `type CommitsPageFn = (path: string, page: number) => Promise<HbCommit[]>` (empty array ⇒ no more pages)
  - `type Issue727Fn = () => Promise<Issue727Data>`
  - `interface GithubClient { fetchAwscliTags(sinceIso: string): Promise<AwscliTag[]>; fetchFormulaCommits(formula: Formula, opts: { sinceIso: string; stopAtSha?: string }): Promise<HbCommit[]>; fetchIssue727(): Promise<Issue727Data> }`
  - `makeGithubClient(deps: { graphql: GraphqlFn; commitsPage: CommitsPageFn; issue727: Issue727Fn }): GithubClient`
  - `makeRealGithubClient(): GithubClient` (wires `octokit`; token from `GITHUB_TOKEN` or `gh auth token`)
  - `formulaPath(formula: Formula): string` → `Formula/a/awscli.rb` | `Formula/a/awscli@1.rb`

Behavior contracts:
- `fetchAwscliTags` pages the GraphQL refs (ordered by `TAG_COMMIT_DATE DESC`), keeps tags whose name matches `^\d+\.\d+` with major 1 or 2 **and** `releasedAt >= sinceIso`, and **stops** once a page's newest tags are all older than `sinceIso`.
- `fetchFormulaCommits` pages commits (newest first), stopping when it reaches `stopAtSha` **or** a commit older than `sinceIso`; returns commits newest-first.

- [ ] **Step 1: Write the failing test** — `ingest/test/github.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { makeGithubClient, formulaPath, type HbCommit } from '../src/github.js';

const TAGS_PAGE_1 = {
  repository: { refs: {
    pageInfo: { hasNextPage: true, endCursor: 'C1' },
    nodes: [
      { name: '2.35.14', target: { __typename: 'Commit', oid: 'c14', committedDate: '2026-07-01T18:00:00Z' } },
      { name: '1.45.30', target: { __typename: 'Commit', oid: 'v45', committedDate: '2026-06-16T20:00:00Z' } },
      { name: '2.0.0', target: { __typename: 'Tag', target: { oid: 'c200', committedDate: '2020-02-10T00:00:00Z' } } },
    ],
  } },
};
const TAGS_PAGE_2 = {
  repository: { refs: {
    pageInfo: { hasNextPage: true, endCursor: 'C2' },
    nodes: [
      { name: '1.17.0', target: { __typename: 'Commit', oid: 'old', committedDate: '2019-12-01T00:00:00Z' } },
    ],
  } },
};

describe('fetchAwscliTags', () => {
  it('filters to window + majors 1/2 and stops paging when older than window', async () => {
    const pages = [TAGS_PAGE_1, TAGS_PAGE_2];
    let calls = 0;
    const gh = makeGithubClient({
      graphql: async () => pages[calls++],
      commitsPage: async () => [],
      issue727: async () => ({ state: 'open', createdAt: 'x', closedAt: null, url: 'u' }),
    });
    const tags = await gh.fetchAwscliTags('2020-01-01T00:00:00Z');
    expect(tags.map((t) => t.version)).toEqual(['2.35.14', '1.45.30', '2.0.0']);
    expect(tags[0]).toMatchObject({ major: 2, commitSha: 'c14', releasedAt: '2026-07-01T18:00:00Z' });
    expect(tags[2]).toMatchObject({ major: 2, commitSha: 'c200' }); // annotated tag resolved
    expect(calls).toBe(2); // stopped after the page that dropped below the window
  });
});

describe('fetchFormulaCommits', () => {
  const page1: HbCommit[] = [
    { sha: 'b1', date: '2026-07-01T21:38:00Z', message: 'awscli: update 2.35.14 bottle.' },
    { sha: 'f1', date: '2026-07-01T20:28:00Z', message: 'awscli 2.35.14' },
  ];
  const page2: HbCommit[] = [
    { sha: 'old', date: '2019-11-01T00:00:00Z', message: 'awscli 1.16.0' },
  ];
  it('stops at the cursor sha', async () => {
    const gh = makeGithubClient({
      graphql: async () => ({}),
      commitsPage: async (_p, page) => (page === 1 ? page1 : []),
      issue727: async () => ({ state: 'open', createdAt: 'x', closedAt: null, url: 'u' }),
    });
    const out = await gh.fetchFormulaCommits('awscli', { sinceIso: '2020-01-01T00:00:00Z', stopAtSha: 'f1' });
    expect(out.map((c) => c.sha)).toEqual(['b1']); // stops before f1
  });
  it('stops at the window boundary', async () => {
    const gh = makeGithubClient({
      graphql: async () => ({}),
      commitsPage: async (_p, page) => (page === 1 ? page1 : page === 2 ? page2 : []),
      issue727: async () => ({ state: 'open', createdAt: 'x', closedAt: null, url: 'u' }),
    });
    const out = await gh.fetchFormulaCommits('awscli', { sinceIso: '2020-01-01T00:00:00Z' });
    expect(out.map((c) => c.sha)).toEqual(['b1', 'f1']); // 'old' is pre-window, dropped
  });
});

describe('formulaPath', () => {
  it('maps formula to file path', () => {
    expect(formulaPath('awscli')).toBe('Formula/a/awscli.rb');
    expect(formulaPath('awscli@1')).toBe('Formula/a/awscli@1.rb');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w ingest test github`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `ingest/src/github.ts`**

```ts
import { execFileSync } from 'node:child_process';
import { Octokit } from 'octokit';
import { majorOf, type Formula } from './parse.js';

export interface AwscliTag { version: string; major: number; tagName: string; commitSha: string; releasedAt: string }
export interface HbCommit { sha: string; date: string; message: string }
export interface Issue727Data { state: 'open' | 'closed'; createdAt: string; closedAt: string | null; url: string }

export type GraphqlFn = (query: string, vars: Record<string, unknown>) => Promise<any>;
export type CommitsPageFn = (path: string, page: number) => Promise<HbCommit[]>;
export type Issue727Fn = () => Promise<Issue727Data>;

export interface GithubClient {
  fetchAwscliTags(sinceIso: string): Promise<AwscliTag[]>;
  fetchFormulaCommits(formula: Formula, opts: { sinceIso: string; stopAtSha?: string }): Promise<HbCommit[]>;
  fetchIssue727(): Promise<Issue727Data>;
}

export function formulaPath(formula: Formula): string {
  return `Formula/a/${formula}.rb`;
}

const TAGS_QUERY = `
  query($cursor: String) {
    repository(owner: "aws", name: "aws-cli") {
      refs(refPrefix: "refs/tags/", first: 100, after: $cursor,
           orderBy: { field: TAG_COMMIT_DATE, direction: DESC }) {
        pageInfo { hasNextPage endCursor }
        nodes {
          name
          target {
            __typename
            ... on Commit { oid committedDate }
            ... on Tag { target { ... on Commit { oid committedDate } } }
          }
        }
      }
    }
  }`;

function resolveTarget(target: any): { oid: string; committedDate: string } | null {
  if (!target) return null;
  if (target.__typename === 'Commit') return { oid: target.oid, committedDate: target.committedDate };
  if (target.__typename === 'Tag' && target.target) return { oid: target.target.oid, committedDate: target.target.committedDate };
  return null;
}

export function makeGithubClient(deps: { graphql: GraphqlFn; commitsPage: CommitsPageFn; issue727: Issue727Fn }): GithubClient {
  return {
    async fetchAwscliTags(sinceIso: string): Promise<AwscliTag[]> {
      const since = Date.parse(sinceIso);
      const out: AwscliTag[] = [];
      let cursor: string | null = null;
      for (;;) {
        const data = await deps.graphql(TAGS_QUERY, { cursor });
        const refs = data.repository.refs;
        let anyInWindow = false;
        for (const node of refs.nodes) {
          if (!/^\d+\.\d+/.test(node.name)) continue;
          const major = majorOf(node.name);
          if (major !== 1 && major !== 2) continue;
          const t = resolveTarget(node.target);
          if (!t) continue;
          if (Date.parse(t.committedDate) < since) continue;
          anyInWindow = true;
          out.push({ version: node.name, major, tagName: node.name, commitSha: t.oid, releasedAt: t.committedDate });
        }
        if (!refs.pageInfo.hasNextPage || !anyInWindow) break;
        cursor = refs.pageInfo.endCursor;
      }
      return out;
    },

    async fetchFormulaCommits(formula, opts): Promise<HbCommit[]> {
      const since = Date.parse(opts.sinceIso);
      const path = formulaPath(formula);
      const out: HbCommit[] = [];
      for (let page = 1; ; page++) {
        const commits = await deps.commitsPage(path, page);
        if (commits.length === 0) break;
        let stop = false;
        for (const c of commits) {
          if (opts.stopAtSha && c.sha === opts.stopAtSha) { stop = true; break; }
          if (Date.parse(c.date) < since) { stop = true; break; }
          out.push(c);
        }
        if (stop) break;
      }
      return out;
    },

    fetchIssue727: deps.issue727,
  };
}

function resolveToken(): string | undefined {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
  } catch {
    return undefined;
  }
}

export function makeRealGithubClient(): GithubClient {
  const octokit = new Octokit({ auth: resolveToken() });
  return makeGithubClient({
    graphql: (query, vars) => octokit.graphql(query, vars),
    commitsPage: async (path, page) => {
      const res = await octokit.rest.repos.listCommits({
        owner: 'Homebrew', repo: 'homebrew-core', path, per_page: 100, page,
      });
      return res.data.map((c) => ({ sha: c.sha, date: c.commit.committer!.date!, message: c.commit.message }));
    },
    issue727: async () => {
      const res = await octokit.rest.issues.get({ owner: 'aws', repo: 'aws-cli', issue_number: 727 });
      return {
        state: res.data.state === 'closed' ? 'closed' : 'open',
        createdAt: res.data.created_at,
        closedAt: res.data.closed_at ?? null,
        url: res.data.html_url,
      };
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm -w ingest test github`
Expected: PASS (4 github tests green).

- [ ] **Step 5: Commit**

```bash
git add ingest/src/github.ts ingest/test/github.test.ts
git commit -m "feat(ingest): injectable GitHub client (tags, commits, issue #727)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YbcAbdkFNTQ76nEZ6RxqXm"
```

---

### Task 5: Ingest orchestration (incremental)

**Files:**
- Create: `ingest/src/ingest.ts`
- Test: `ingest/test/ingest.test.ts`

**Interfaces:**
- Consumes: `AppDb`, upsert helpers, `getMeta`/`setMeta` from `db.ts`; `GithubClient`, `AwscliTag`, `HbCommit` from `github.ts`; `parseHomebrewCommit` from `parse.ts`.
- Produces: `runIngest(db: AppDb, gh: GithubClient, opts: { windowStart: string }): Promise<void>`
  - Fetches tags → `upsertAwscliRelease` for each.
  - For each formula in `['awscli', 'awscli@1']`: read cursor `meta['cursor:' + formula]`; fetch commits (`sinceIso: windowStart`, `stopAtSha: cursor`); for each parsed commit dispatch to `upsertHomebrewFormula`/`upsertHomebrewBottle`; if any commits returned, set the cursor to the **newest** commit sha (`commits[0].sha`).

- [ ] **Step 1: Write the failing test** — `ingest/test/ingest.test.ts`

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w ingest test ingest`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `ingest/src/ingest.ts`**

```ts
import { type AppDb, upsertAwscliRelease, upsertHomebrewFormula, upsertHomebrewBottle, getMeta, setMeta } from './db.js';
import { type GithubClient } from './github.js';
import { parseHomebrewCommit, type Formula } from './parse.js';

const FORMULAS: Formula[] = ['awscli', 'awscli@1'];

export async function runIngest(db: AppDb, gh: GithubClient, opts: { windowStart: string }): Promise<void> {
  const tags = await gh.fetchAwscliTags(opts.windowStart);
  for (const t of tags) {
    upsertAwscliRelease(db, { version: t.version, major: t.major, tagName: t.tagName, commitSha: t.commitSha, releasedAt: t.releasedAt });
  }

  for (const formula of FORMULAS) {
    const cursorKey = `cursor:${formula}`;
    const stopAtSha = getMeta(db, cursorKey);
    const commits = await gh.fetchFormulaCommits(formula, { sinceIso: opts.windowStart, stopAtSha });
    for (const c of commits) {
      const parsed = parseHomebrewCommit(c.message);
      if (!parsed || parsed.formula !== formula) continue;
      if (parsed.kind === 'formula') {
        upsertHomebrewFormula(db, { formula, version: parsed.version, commitSha: c.sha, at: c.date });
      } else {
        upsertHomebrewBottle(db, { formula, version: parsed.version, commitSha: c.sha, at: c.date });
      }
    }
    if (commits.length > 0) setMeta(db, cursorKey, commits[0].sha);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm -w ingest test ingest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ingest/src/ingest.ts ingest/test/ingest.test.ts
git commit -m "feat(ingest): incremental orchestration with cursor-based back-fill

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YbcAbdkFNTQ76nEZ6RxqXm"
```

---

### Task 6: Export (DB → `data.json`)

**Files:**
- Create: `ingest/src/export.ts`
- Test: `ingest/test/export.test.ts`

**Interfaces:**
- Consumes: `AppDb`, `queryTracking`, `countReleases`, `TrackingRow` from `db.ts`; `summarize`, `hoursBetween`, `withinWindow`, `Summary` from `stats.ts`; `Issue727Data` from `github.ts`.
- Produces (this is the **contract the web app consumes** — mirror exactly in `site/src/types.ts`):

```ts
export interface Summary { mean: number; median: number; p90: number; n: number } // re-exported from stats
export interface SeriesPoint {
  version: string; major: number; formula: 'awscli' | 'awscli@1';
  releasedAt: string; formulaAt: string | null; bottleAt: string | null;
  totalH: number | null; noticeH: number | null; buildH: number | null;
}
export interface CoverageEntry { awscli: number; shipped: number; pct: number }
export interface DataJson {
  generatedAt: string;
  windowStart: string;
  issue727: { state: 'open' | 'closed'; createdAt: string; closedAt: string | null; url: string };
  headline: {
    totalBottleLag: { d30: Summary; d90: Summary; y1: Summary; all: Summary };
    noticeLatency: { y1: Summary; all: Summary };
    bottleBuildLatency: { y1: Summary; all: Summary };
  };
  coverage: { overall: CoverageEntry; v1: CoverageEntry; v2: CoverageEntry };
  series: SeriesPoint[];
  recent: SeriesPoint[];
  notes: { awscli1MaintenanceMode: string };
}
export function buildDataJson(db: AppDb, opts: { generatedAt: string; windowStart: string; issue727: Issue727Data }): DataJson
export function writeDataJson(path: string, data: DataJson): void  // JSON.stringify(data, null, 2) + '\n'
```

Computation rules:
- Build `SeriesPoint[]` from `queryTracking`, adding `noticeH = hoursBetween(releasedAt, formulaAt)` when `formulaAt`, `buildH = hoursBetween(formulaAt, bottleAt)` when both, `totalH = hoursBetween(releasedAt, bottleAt)` when `bottleAt`.
- For each window (`d30=30, d90=90, y1=365, all=null`), summarize over points whose `releasedAt` passes `withinWindow(releasedAt, generatedAt, days)` and whose relevant duration is non-null: `totalBottleLag` uses `totalH`; `noticeLatency` uses `noticeH`; `bottleBuildLatency` uses `buildH`.
- `coverage`: `awscli` from `countReleases` per major (`v1`=major1, `v2`=major2, `overall`=sum); `shipped` = count of series points per major; `pct = shipped/awscli*100` (0 if awscli is 0).
- `recent` = series sorted by `releasedAt` **descending**, first 20.
- `notes.awscli1MaintenanceMode = '2026-07-15'`.

- [ ] **Step 1: Write the failing test** — `ingest/test/export.test.ts`

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w ingest test export`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `ingest/src/export.ts`**

```ts
import { writeFileSync } from 'node:fs';
import { type AppDb, queryTracking, countReleases } from './db.js';
import { summarize, hoursBetween, withinWindow, type Summary } from './stats.js';
import { type Issue727Data } from './github.js';

export type { Summary };

export interface SeriesPoint {
  version: string; major: number; formula: 'awscli' | 'awscli@1';
  releasedAt: string; formulaAt: string | null; bottleAt: string | null;
  totalH: number | null; noticeH: number | null; buildH: number | null;
}
export interface CoverageEntry { awscli: number; shipped: number; pct: number }
export interface DataJson {
  generatedAt: string;
  windowStart: string;
  issue727: Issue727Data;
  headline: {
    totalBottleLag: { d30: Summary; d90: Summary; y1: Summary; all: Summary };
    noticeLatency: { y1: Summary; all: Summary };
    bottleBuildLatency: { y1: Summary; all: Summary };
  };
  coverage: { overall: CoverageEntry; v1: CoverageEntry; v2: CoverageEntry };
  series: SeriesPoint[];
  recent: SeriesPoint[];
  notes: { awscli1MaintenanceMode: string };
}

const WINDOWS = { d30: 30, d90: 90, y1: 365, all: null } as const;

function summarizeMetric(
  series: SeriesPoint[], now: string, pick: (p: SeriesPoint) => number | null, days: number | null,
): Summary {
  const vals: number[] = [];
  for (const p of series) {
    const v = pick(p);
    if (v === null) continue;
    if (!withinWindow(p.releasedAt, now, days)) continue;
    vals.push(v);
  }
  return summarize(vals);
}

export function buildDataJson(
  db: AppDb, opts: { generatedAt: string; windowStart: string; issue727: Issue727Data },
): DataJson {
  const rows = queryTracking(db);
  const series: SeriesPoint[] = rows.map((r) => ({
    version: r.version, major: r.major, formula: r.formula,
    releasedAt: r.releasedAt, formulaAt: r.formulaAt, bottleAt: r.bottleAt,
    noticeH: r.formulaAt ? hoursBetween(r.releasedAt, r.formulaAt) : null,
    buildH: r.formulaAt && r.bottleAt ? hoursBetween(r.formulaAt, r.bottleAt) : null,
    totalH: r.bottleAt ? hoursBetween(r.releasedAt, r.bottleAt) : null,
  }));

  const now = opts.generatedAt;
  const total = (d: number | null) => summarizeMetric(series, now, (p) => p.totalH, d);
  const notice = (d: number | null) => summarizeMetric(series, now, (p) => p.noticeH, d);
  const build = (d: number | null) => summarizeMetric(series, now, (p) => p.buildH, d);

  const relByMajor = new Map(countReleases(db).map((r) => [r.major, r.n]));
  const shippedByMajor = (m: number) => series.filter((p) => p.major === m).length;
  const cov = (m: number): CoverageEntry => {
    const awscli = relByMajor.get(m) ?? 0;
    const shipped = shippedByMajor(m);
    return { awscli, shipped, pct: awscli === 0 ? 0 : (shipped / awscli) * 100 };
  };
  const merge = (a: CoverageEntry, b: CoverageEntry): CoverageEntry => {
    const awscli = a.awscli + b.awscli, shipped = a.shipped + b.shipped;
    return { awscli, shipped, pct: awscli === 0 ? 0 : (shipped / awscli) * 100 };
  };
  const v1 = cov(1), v2 = cov(2);

  const recent = [...series].sort((a, b) => Date.parse(b.releasedAt) - Date.parse(a.releasedAt)).slice(0, 20);

  return {
    generatedAt: opts.generatedAt,
    windowStart: opts.windowStart,
    issue727: opts.issue727,
    headline: {
      totalBottleLag: { d30: total(WINDOWS.d30), d90: total(WINDOWS.d90), y1: total(WINDOWS.y1), all: total(WINDOWS.all) },
      noticeLatency: { y1: notice(WINDOWS.y1), all: notice(WINDOWS.all) },
      bottleBuildLatency: { y1: build(WINDOWS.y1), all: build(WINDOWS.all) },
    },
    coverage: { overall: merge(v1, v2), v1, v2 },
    series,
    recent,
    notes: { awscli1MaintenanceMode: '2026-07-15' },
  };
}

export function writeDataJson(path: string, data: DataJson): void {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm -w ingest test export`
Expected: PASS (3 export tests green).

- [ ] **Step 5: Commit**

```bash
git add ingest/src/export.ts ingest/test/export.test.ts
git commit -m "feat(ingest): export DB to data.json (headline stats, coverage, series)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YbcAbdkFNTQ76nEZ6RxqXm"
```

---

### Task 7: CLI entry + first real backfill

**Files:**
- Create: `ingest/src/cli.ts`
- Create (generated, committed): `data/tracker.sqlite`, `data/data.json`

**Interfaces:**
- Consumes: `openDb` (`db.ts`), `makeRealGithubClient` (`github.ts`), `runIngest` (`ingest.ts`), `buildDataJson`/`writeDataJson` (`export.ts`).
- Produces: an executable module resolving output paths **relative to the repo root** (via `import.meta.url`), not cwd.

- [ ] **Step 1: Write `ingest/src/cli.ts`**

```ts
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { openDb } from './db.js';
import { makeRealGithubClient } from './github.js';
import { runIngest } from './ingest.js';
import { buildDataJson, writeDataJson } from './export.js';

const WINDOW_START = '2020-01-01T00:00:00Z';
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dataDir = resolve(repoRoot, 'data');

async function main() {
  mkdirSync(dataDir, { recursive: true });
  const db = openDb(resolve(dataDir, 'tracker.sqlite'));
  const gh = makeRealGithubClient();

  console.log('Fetching from GitHub…');
  await runIngest(db, gh, { windowStart: WINDOW_START });
  const issue727 = await gh.fetchIssue727();

  const data = buildDataJson(db, { generatedAt: new Date().toISOString(), windowStart: WINDOW_START, issue727 });
  writeDataJson(resolve(dataDir, 'data.json'), data);
  console.log(`Wrote ${data.series.length} shipped releases; #727 is ${data.issue727.state}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run the real backfill**

Run: `npm run refresh`
Expected: prints "Fetching from GitHub…" then a summary line; creates `data/tracker.sqlite` and `data/data.json`. (Uses `GITHUB_TOKEN` or `gh auth token`.)

- [ ] **Step 3: Sanity-check the output**

Run: `sqlite3 data/tracker.sqlite "SELECT major, COUNT(*) FROM awscli_release GROUP BY major; SELECT COUNT(*) FROM tracking;"`
Expected: nonzero counts for majors 1 and 2, and a nonzero tracking count.

Run: `node --experimental-strip-types -e "const d=require('./data/data.json'); console.log(d.headline.totalBottleLag.y1, d.coverage.overall)"` *(or just open `data/data.json`)*
Expected: `y1.n > 0`; `coverage.overall.pct` between 0 and 100; `issue727.state === 'open'`.

- [ ] **Step 4: Commit code + generated data**

```bash
git add ingest/src/cli.ts data/tracker.sqlite data/data.json
git commit -m "feat(ingest): CLI entry + initial GitHub backfill of tracker data

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YbcAbdkFNTQ76nEZ6RxqXm"
```

---

## Self-Review

**Spec coverage:**
- GitHub-only ingestion (tags GraphQL, commits REST, issue #727) → Tasks 4, 7. ✅
- SQLite store with schema + tracking view + revision exclusion → Task 3. ✅
- Incremental weekly-friendly ingestion (cursors, bottle back-fill) → Task 5. ✅
- Window 2020-01-01+ → Global Constraints, enforced in Tasks 4 & 6. ✅
- Three headline metrics (total/notice/build) with 30d/90d/1y/all windows; median/p90 alongside mean → Task 6. ✅
- Coverage → Task 6. ✅
- `issue727` baseline block → Tasks 4, 6. ✅
- Committed `tracker.sqlite` + `data.json` → Task 7. ✅
- Message-pattern parsing + revision normalization → Task 1. ✅

**Deferred to Plan B (web app + deploy):** live #727 fetch, hero counter, headline cards, main lag graph, recent table, news scroller, GitHub Pages, README, weekly Cowork docs, remote/Pages setup. The `DataJson` contract in Task 6 is the seam.

**Placeholder scan:** none — every step has real code/commands.

**Type consistency:** `Formula`, `Summary`, `TrackingRow`, `AwscliTag`, `HbCommit`, `Issue727Data`, `SeriesPoint`, `DataJson`, `CoverageEntry` used consistently across tasks; `buildDataJson`/`writeDataJson`/`runIngest`/`makeGithubClient` signatures match their call sites.
