import type { SeriesPoint } from '../types.js';
import { formatDuration, formatDate } from '../format.js';

const dur = (h: number | null) => (h === null ? '—' : formatDuration(h));

export function RecentTable({ recent }: { recent: SeriesPoint[] }) {
  return (
    <section className="recent">
      <h2>Recent releases</h2>
      <div className="recent__scroll">
        <table>
          <thead>
            <tr><th>Version</th><th>Line</th><th>aws-cli released</th><th>Notice</th><th>Build</th><th>Total</th></tr>
          </thead>
          <tbody>
            {recent.map((p) => (
              <tr key={`${p.formula}-${p.version}`}>
                <td>{p.version}</td>
                <td>{p.major === 1 ? 'v1' : 'v2'}</td>
                <td>{formatDate(p.releasedAt)}</td>
                <td>{dur(p.noticeH)}</td>
                <td>{dur(p.buildH)}</td>
                <td>{dur(p.totalH)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
