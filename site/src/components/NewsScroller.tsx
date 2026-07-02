import type { NewsItem } from '../news.js';

// 📰 for world events, 🧑‍💻 for aws-cli/Homebrew project milestones.
const KIND_EMOJI: Record<NewsItem['kind'], string> = { world: '📰', milestone: '🧑‍💻' };

export function NewsScroller({ items }: { items: NewsItem[] }) {
  const line = items.map((n) => `${KIND_EMOJI[n.kind]} ${n.date.slice(0, 4)} · ${n.text}`);
  const doubled = [...line, ...line]; // seamless loop
  return (
    <section className="ticker" aria-label="Events since #727 was filed (2014-03-29)">
      <div className="ticker__label">Meanwhile, since #727 was filed…</div>
      <div className="ticker__track">
        {doubled.map((t, i) => (<span className="ticker__item" key={i}>{t}</span>))}
      </div>
    </section>
  );
}
