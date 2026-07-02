import type { DataJson, Summary, SeriesPoint } from '../types.js';
import { formatDuration } from '../format.js';
import { Sparkline } from './Sparkline.js';

const WEEK_MS = 7 * 86_400_000;
const YEAR_MS = 365 * 86_400_000;

// Two-line native tooltip: line 1 = how it's measured, line 2 = the distribution.
function tip(measure: string, s: Summary): string {
  return `${measure}\nmean shown · median ${formatDuration(s.median)} · p90 ${formatDuration(s.p90)} · n=${s.n}`;
}

// Weekly means of one metric over the last year (oldest→newest), anchored to the
// latest week of data so it stays stable between weekly refreshes.
function weeklyMeansYear(series: SeriesPoint[], pick: (p: SeriesPoint) => number | null): number[] {
  const buckets = new Map<number, number[]>();
  for (const p of series) {
    const v = pick(p);
    if (v === null || v <= 0) continue; // log scale needs > 0
    const week = Math.floor(Date.parse(p.releasedAt) / WEEK_MS) * WEEK_MS;
    const arr = buckets.get(week);
    if (arr) arr.push(v);
    else buckets.set(week, [v]);
  }
  const rows = [...buckets.entries()]
    .map(([t, a]) => ({ t, v: a.reduce((x, y) => x + y, 0) / a.length }))
    .sort((a, b) => a.t - b.t);
  if (!rows.length) return [];
  const cutoff = rows[rows.length - 1].t - YEAR_MS;
  return rows.filter((r) => r.t >= cutoff).map((r) => r.v);
}

const TOTAL_MEASURE = 'from the aws-cli release tag to when `brew install awscli` gets it';
const NOTICE_MEASURE = 'from the aws-cli release tag to the Homebrew formula PR merge';
const BUILD_MEASURE = 'from the Homebrew formula PR merge to the built, installable bottle';

export function HeadlineStats({ headline, series }: { headline: DataJson['headline']; series: SeriesPoint[] }) {
  const t = headline.totalBottleLag;
  const n = headline.noticeLatency;
  const b = headline.bottleBuildLatency;
  const noticeSpark = weeklyMeansYear(series, (p) => p.noticeH);
  const buildSpark = weeklyMeansYear(series, (p) => p.buildH);
  return (
    <section className="stats">
      <div className="total">
        <div className="total__head" title={tip(TOTAL_MEASURE, t.d30)}>
          <div className="total__lead">
            <div className="total__label">time to <code>brew install</code></div>
            <div className="total__value">{formatDuration(t.d30.mean)} <span className="total__label">in the last 30 days</span></div>
          </div>
          <div className="total__windows">
            <span title={tip(TOTAL_MEASURE, t.d90)}>90d <b>{formatDuration(t.d90.mean)}</b></span>
            <span title={tip(TOTAL_MEASURE, t.y1)}>1y <b>{formatDuration(t.y1.mean)}</b></span>
            <span title={tip(TOTAL_MEASURE, t.all)}>since 2020 <b>{formatDuration(t.all.mean)}</b></span>
          </div>
        </div>
        <div className="parts">
          <div className="part part--notice" title={tip(NOTICE_MEASURE, n.d30)}>
            <div className="part__body">
              <div className="part__label">release → update</div>
              <div className="part__value">{formatDuration(n.d30.mean)}</div>
            </div>
            <Sparkline points={noticeSpark} color="#3b82f6" label="release → update, weekly average over the past year" />
          </div>
          <div className="parts__op">+</div>
          <div className="part part--build" title={tip(BUILD_MEASURE, b.d30)}>
            <div className="part__body">
              <div className="part__label">update → installable</div>
              <div className="part__value">{formatDuration(b.d30.mean)}</div>
            </div>
            <Sparkline points={buildSpark} color="#ff9900" label="update → installable, weekly average over the past year" />
          </div>
        </div>
      </div>
    </section>
  );
}
