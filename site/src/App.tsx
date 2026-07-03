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
        <h1>Is Homebrew's <code>awscli</code> keeping up with <code>aws-cli</code>?</h1>
        <p className="page__sub">Tracking how well the <code>awscli</code> package has kept up with each <code>aws-cli</code> release since 2020 · last updated {formatDate(data.generatedAt)} · updated weekly</p>
      </header>
      <HeroCounter issue727={data.issue727} />
      <HeadlineStats headline={data.headline} />
      <LagChart series={data.series} />
      <NewsScroller items={NEWS} />
      <RecentTable recent={data.recent.slice(0, 5)} />
      <footer className="page__foot">
        Source: aws-cli git tags + Homebrew formula/bottle commits, via the GitHub API.
        Made with ❤️ and 😁 (and a tiny bit of 😢)
      </footer>
    </div>
  );
}
