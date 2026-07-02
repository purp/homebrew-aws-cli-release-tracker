import { ComposedChart, Scatter, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { SeriesPoint } from '../types.js';
import { formatDuration, formatDate } from '../format.js';

interface Row { t: number; totalH: number; major: number; version: string }

function rollingAverage(rows: Row[], window = 10): { t: number; avg: number }[] {
  const sorted = [...rows].sort((a, b) => a.t - b.t);
  return sorted.map((_, i) => {
    const slice = sorted.slice(Math.max(0, i - window + 1), i + 1);
    return { t: sorted[i].t, avg: slice.reduce((s, r) => s + r.totalH, 0) / slice.length };
  });
}

export function LagChart({ series }: { series: SeriesPoint[] }) {
  const rows: Row[] = series
    .filter((p) => p.totalH !== null)
    .map((p) => ({ t: Date.parse(p.releasedAt), totalH: p.totalH as number, major: p.major, version: p.version }));
  const v1 = rows.filter((r) => r.major === 1);
  const v2 = rows.filter((r) => r.major === 2);
  const avg = rollingAverage(rows);

  return (
    <section className="chart">
      <h2>Time from aws-cli release to installable Homebrew bottle</h2>
      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis type="number" dataKey="t" domain={['dataMin', 'dataMax']} scale="time"
                 tickFormatter={(t) => formatDate(new Date(t).toISOString())} />
          <YAxis type="number" dataKey="totalH" scale="log" domain={['auto', 'auto']} allowDataOverflow
                 tickFormatter={(h) => formatDuration(h)} width={64} />
          <Tooltip
            formatter={(value: number, name) => name === 'avg' ? [formatDuration(value), 'rolling avg'] : [formatDuration(value), 'lag']}
            labelFormatter={(t) => formatDate(new Date(t as number).toISOString())} />
          <Legend />
          <Scatter name="awscli v2" data={v2} dataKey="totalH" fill="#ff9900" />
          <Scatter name="awscli@1 (v1)" data={v1} dataKey="totalH" fill="#3b82f6" />
          <Line name="avg" data={avg} dataKey="avg" stroke="#111" dot={false} strokeWidth={2} legendType="none" />
        </ComposedChart>
      </ResponsiveContainer>
    </section>
  );
}
