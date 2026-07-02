import { data } from './data.js';
import { NEWS } from './news.js';
import { HeroCounter } from './components/HeroCounter.js';
import { HeadlineStats } from './components/HeadlineStats.js';
import { LagChart } from './components/LagChart.js';
import { RecentTable } from './components/RecentTable.js';
import { NewsScroller } from './components/NewsScroller.js';
import { formatDate } from './format.js';

export function App() {
  return (
    <div className="page">
      <header className="page__head">
        <h1>Is Homebrew keeping up with aws-cli?</h1>
        <p className="page__sub">Tracking how fast Homebrew ships each aws-cli release. Data since 2020, refreshed weekly · generated {formatDate(data.generatedAt)}.</p>
      </header>
      <HeroCounter issue727={data.issue727} />
      <HeadlineStats headline={data.headline} />
      <LagChart series={data.series} />
      <RecentTable recent={data.recent} />
      <p className="note">Note: <code>awscli@1</code> enters maintenance mode {data.notes.awscli1MaintenanceMode}.</p>
      <NewsScroller items={NEWS} />
      <footer className="page__foot">
        Source: aws-cli git tags + Homebrew formula/bottle commits, via the GitHub API. Coverage: {data.coverage.overall.shipped}/{data.coverage.overall.awscli} releases shipped ({data.coverage.overall.pct.toFixed(0)}%).
      </footer>
    </div>
  );
}
