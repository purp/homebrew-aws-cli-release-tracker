import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { SeriesPoint } from '../types.js';
import { formatDuration, formatDate } from '../format.js';

const WEEK_MS = 7 * 86_400_000;

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
  const rows = weeklyMeans(series);
  return (
    <section className="chart">
      <h2>Weekly average — aws-cli release → installable Homebrew bottle</h2>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
          <XAxis type="number" dataKey="t" domain={['dataMin', 'dataMax']} scale="time"
                 tickFormatter={(t) => formatDate(new Date(t).toISOString())} minTickGap={48} />
          <YAxis scale="log" domain={['auto', 'auto']} allowDataOverflow
                 tickFormatter={(h) => formatDuration(h)} width={60} />
          <Tooltip
            formatter={(value: number, name) => [formatDuration(value), name]}
            labelFormatter={(t) => `week of ${formatDate(new Date(t as number).toISOString())}`} />
          <Legend />
          <Line type="monotone" dataKey="v2" name="awscli (v2)" stroke="#ff9900" strokeWidth={2} dot={false} connectNulls />
          <Line type="monotone" dataKey="v1" name="awscli@1 (v1)" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}
