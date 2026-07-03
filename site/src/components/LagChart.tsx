import { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, ReferenceDot } from 'recharts';
import type { SeriesPoint } from '../types.js';
import { formatDuration, formatDate } from '../format.js';

const WEEK_MS = 7 * 86_400_000;
const DAY_MS = 86_400_000;

// Time-range presets; `days: null` means all time. Default is 1y (see useState below).
const RANGES = [
  { label: '30d', days: 30 },
  { label: '60d', days: 60 },
  { label: '90d', days: 90 },
  { label: '1y', days: 365 },
  { label: 'All', days: null },
] as const;

interface WeekRow { t: number; v1: number | null; v2: number | null }

// Aggregate release lags into weekly means per major so the trend reads clearly
// instead of a cloud of per-release points.
function weeklyMeans(series: SeriesPoint[]): WeekRow[] {
  const v1 = new Map<number, number[]>();
  const v2 = new Map<number, number[]>();
  for (const p of series) {
    if (p.totalH === null || p.totalH <= 0) continue; // log axis needs > 0
    const week = Math.floor(Date.parse(p.releasedAt) / WEEK_MS) * WEEK_MS;
    const bucket = p.major === 1 ? v1 : v2;
    const arr = bucket.get(week);
    if (arr) arr.push(p.totalH);
    else bucket.set(week, [p.totalH]);
  }
  const mean = (a?: number[]) => (a && a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const weeks = [...new Set([...v1.keys(), ...v2.keys()])].sort((a, b) => a - b);
  return weeks.map((t) => ({ t, v1: mean(v1.get(t)), v2: mean(v2.get(t)) }));
}

export function LagChart({ series }: { series: SeriesPoint[] }) {
  const allRows = useMemo(() => weeklyMeans(series), [series]);
  const [days, setDays] = useState<number | null>(365); // default 1y

  // Window is anchored to the most recent week of data (not wall-clock now) so the
  // view stays stable between weekly refreshes. viewStart/viewEnd pin the X axis to
  // the window; `rows` also carries the nearest real point *before* the window (when
  // the left edge lands on a week with no release) so each line enters the left edge
  // along its true trajectory. That anchor sits left of viewStart and is clipped by
  // the axis domain — a visual cue that we're showing a slice of a longer history.
  const { rows, viewStart, viewEnd } = useMemo(() => {
    if (days === null || allRows.length === 0) {
      return {
        rows: allRows,
        viewStart: allRows[0]?.t ?? 0,
        viewEnd: allRows[allRows.length - 1]?.t ?? 0,
      };
    }
    const lastT = allRows[allRows.length - 1].t;
    const cutoff = lastT - days * DAY_MS;
    const startIdx = allRows.findIndex((r) => r.t >= cutoff);
    let anchorIdx = startIdx;
    for (const key of ['v1', 'v2'] as const) {
      if (allRows[startIdx][key] !== null) continue; // line already starts at the left edge
      for (let i = startIdx - 1; i >= 0; i--) {
        if (allRows[i][key] !== null) { anchorIdx = Math.min(anchorIdx, i); break; }
      }
    }
    return { rows: allRows.slice(anchorIdx), viewStart: allRows[startIdx].t, viewEnd: lastT };
  }, [allRows, days]);

  // The last real point of each series, marked with a dot so it's clear where the
  // data ends: awscli@1 (v1) ships less often and its line legitimately stops short
  // of the right edge because there simply is no newer release yet.
  const ends = useMemo(() => {
    let v1: WeekRow | undefined;
    let v2: WeekRow | undefined;
    for (const r of allRows) {
      if (r.v1 !== null) v1 = r;
      if (r.v2 !== null) v2 = r;
    }
    return { v1, v2 };
  }, [allRows]);

  // Every windowed view (30/60/90d, 1y) shares one Y domain — the last year's
  // range — so switching windows never rescales the axis and pins the near-flat
  // v1 line to the top edge. "All" derives its own (wider) domain from all-time
  // data, which includes much larger historical spikes.
  const yDomain = useMemo<[number, number]>(() => {
    if (allRows.length === 0) return [1, 48];
    const cutoff = days === null ? -Infinity : allRows[allRows.length - 1].t - 365 * DAY_MS;
    const vals = allRows
      .filter((r) => r.t >= cutoff)
      .flatMap((r) => [r.v1, r.v2])
      .filter((v): v is number => typeof v === 'number' && v > 0);
    if (!vals.length) return [1, 48];
    return [Math.min(...vals) / 1.2, Math.max(...vals) * 1.2];
  }, [allRows, days]);

  return (
    <section className="chart">
      <div className="chart__head">
        <h2>Weekly average — aws-cli release → installable Homebrew bottle</h2>
        <div className="chart__ranges" role="group" aria-label="Time range">
          {RANGES.map((r) => (
            <button
              key={r.label}
              type="button"
              className={r.days === days ? 'chart__range chart__range--active' : 'chart__range'}
              aria-pressed={r.days === days}
              onClick={() => setDays(r.days)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
          <XAxis type="number" dataKey="t" domain={[viewStart, viewEnd]} scale="time" allowDataOverflow
                 tickFormatter={(t) => formatDate(new Date(t).toISOString())} minTickGap={48} />
          <YAxis scale="log" domain={yDomain} allowDataOverflow
                 tickFormatter={(h) => formatDuration(h)} width={60} />
          <Tooltip
            contentStyle={{ background: '#171a23', border: '1px solid #2a2f3a', borderRadius: 8 }}
            labelStyle={{ color: '#e7e9ee', fontWeight: 600, marginBottom: 2 }}
            formatter={(value: number, name) => [formatDuration(value), name]}
            labelFormatter={(t) => `week of ${formatDate(new Date(t as number).toISOString())}`} />
          <Legend />
          <Line type="monotone" dataKey="v2" name="awscli (v2)" stroke="#ff9900" strokeWidth={2} dot={false} connectNulls />
          <Line type="monotone" dataKey="v1" name="awscli@1 (v1)" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls />
          {ends.v2 && (
            <ReferenceDot x={ends.v2.t} y={ends.v2.v2 as number} r={4}
                          fill="#ff9900" stroke="#171a23" strokeWidth={2} />
          )}
          {ends.v1 && (
            <ReferenceDot x={ends.v1.t} y={ends.v1.v1 as number} r={4}
                          fill="#3b82f6" stroke="#171a23" strokeWidth={2} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}
