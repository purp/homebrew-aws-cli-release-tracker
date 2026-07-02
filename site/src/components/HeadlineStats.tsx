import type { DataJson, Summary } from '../types.js';
import { formatDuration } from '../format.js';

function tip(s: Summary): string {
  return `median ${formatDuration(s.median)} · p90 ${formatDuration(s.p90)} · n=${s.n}`;
}

export function HeadlineStats({ headline }: { headline: DataJson['headline'] }) {
  const t = headline.totalBottleLag;
  return (
    <section className="stats">
      <div className="stat stat--hero" title={tip(t.y1)}>
        <div className="stat__label">Average time to installable bottle <span>(last year)</span></div>
        <div className="stat__value">{formatDuration(t.y1.mean)}</div>
        <div className="stat__windows">
          <span title={tip(t.d30)}>30d {formatDuration(t.d30.mean)}</span>
          <span title={tip(t.d90)}>90d {formatDuration(t.d90.mean)}</span>
          <span title={tip(t.y1)}>1y {formatDuration(t.y1.mean)}</span>
          <span title={tip(t.all)}>all {formatDuration(t.all.mean)}</span>
        </div>
      </div>
      <div className="stat" title={tip(headline.noticeLatency.y1)}>
        <div className="stat__label">How fast Homebrew noticed <span>(tag → formula PR)</span></div>
        <div className="stat__value">{formatDuration(headline.noticeLatency.y1.mean)}</div>
        <div className="stat__sub">all-time {formatDuration(headline.noticeLatency.all.mean)}</div>
      </div>
      <div className="stat" title={tip(headline.bottleBuildLatency.y1)}>
        <div className="stat__label">Bottle build latency <span>(formula → bottle)</span></div>
        <div className="stat__value">{formatDuration(headline.bottleBuildLatency.y1.mean)}</div>
        <div className="stat__sub">all-time {formatDuration(headline.bottleBuildLatency.all.mean)}</div>
      </div>
    </section>
  );
}
