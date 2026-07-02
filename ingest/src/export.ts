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
export interface WindowSet { d30: Summary; d90: Summary; y1: Summary; all: Summary }
export interface DataJson {
  generatedAt: string;
  windowStart: string;
  issue727: Issue727Data;
  headline: {
    totalBottleLag: WindowSet;
    noticeLatency: WindowSet;
    bottleBuildLatency: WindowSet;
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
  const win = (fn: (d: number | null) => Summary): WindowSet => ({
    d30: fn(WINDOWS.d30), d90: fn(WINDOWS.d90), y1: fn(WINDOWS.y1), all: fn(WINDOWS.all),
  });

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
      totalBottleLag: win(total),
      noticeLatency: win(notice),
      bottleBuildLatency: win(build),
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
