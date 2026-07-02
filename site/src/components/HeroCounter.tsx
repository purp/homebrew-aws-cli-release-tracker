import { useEffect, useState } from 'react';
import type { Issue727 } from '../types.js';
import { useIssue727 } from '../useIssue727.js';
import { daysSince } from '../format.js';

export function HeroCounter({ issue727 }: { issue727: Issue727 }) {
  const live = useIssue727(issue727);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const open = live.state === 'open';
  const days = daysSince(live.createdAt, open || !live.closedAt ? now : Date.parse(live.closedAt));

  return (
    <section className="hero">
      <p className="hero__kicker">
        aws-cli issue <a href={live.url}>#727</a> — "Install aws-cli using Homebrew"
      </p>
      <p className="hero__count"><span className="hero__num">{days.toLocaleString()}</span> days</p>
      <p className="hero__status">
        {open ? 'Still open 😩 — and counting' : `CLOSED 🎉 — after ${days.toLocaleString()} days`}
      </p>
    </section>
  );
}
