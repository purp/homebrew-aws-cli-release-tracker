import type { DataJson, Summary } from '../types.js';
import { formatDuration } from '../format.js';

// Two-line native tooltip: line 1 = how it's measured, line 2 = the distribution.
function tip(measure: string, s: Summary): string {
  return `${measure}\nmean shown · median ${formatDuration(s.median)} · p90 ${formatDuration(s.p90)} · n=${s.n}`;
}

const TOTAL_MEASURE = 'from the aws-cli release tag to when `brew install awscli` gets it';
const NOTICE_MEASURE = 'from the aws-cli release tag to the Homebrew formula PR merge';
const BUILD_MEASURE = 'from the Homebrew formula PR merge to the built, installable bottle';

export function HeadlineStats({ headline }: { headline: DataJson['headline'] }) {
  const t = headline.totalBottleLag;
  const n = headline.noticeLatency;
  const b = headline.bottleBuildLatency;
  return (
    <section className="stats">
      <div className="total">
        <div className="total__head" title={tip(TOTAL_MEASURE, t.d30)}>
          <div className="total__lead">
            <div className="total__label">time to <code>brew install</code> <span>· last 30 days</span></div>
            <div className="total__value">{formatDuration(t.d30.mean)}</div>
          </div>
          <div className="total__windows">
            <span title={tip(TOTAL_MEASURE, t.d90)}>90d <b>{formatDuration(t.d90.mean)}</b></span>
            <span title={tip(TOTAL_MEASURE, t.y1)}>1y <b>{formatDuration(t.y1.mean)}</b></span>
            <span title={tip(TOTAL_MEASURE, t.all)}>since 2020 <b>{formatDuration(t.all.mean)}</b></span>
          </div>
        </div>
        <div className="parts">
          <div className="part part--notice" title={tip(NOTICE_MEASURE, n.d30)}>
            <div className="part__label">release → update</div>
            <div className="part__value">{formatDuration(n.d30.mean)}</div>
            <div className="part__hint">tag → formula PR</div>
          </div>
          <div className="parts__op">+</div>
          <div className="part part--build" title={tip(BUILD_MEASURE, b.d30)}>
            <div className="part__label">update → installable</div>
            <div className="part__value">{formatDuration(b.d30.mean)}</div>
            <div className="part__hint">formula → bottle</div>
          </div>
        </div>
      </div>
    </section>
  );
}
