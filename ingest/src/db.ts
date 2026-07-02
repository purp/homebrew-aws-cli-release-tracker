import { DatabaseSync } from 'node:sqlite';
import { normalizeVersion, majorOf, type Formula } from './parse.js';

export type AppDb = DatabaseSync;

export function openDb(path: string): AppDb {
  const db = new DatabaseSync(path);
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
