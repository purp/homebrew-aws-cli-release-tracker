# AWS CLI ↔ Homebrew Tracker — Web App & Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static dashboard that renders the committed `data/data.json` — a live issue-#727 days-open hero, three headline latency stats, a main lag-over-time graph, a recent-releases table, and a humorous news scroller — deployed to GitHub Pages.

**Architecture:** Vite + React + TypeScript SPA in `site/`. A single `src/data.ts` imports the committed `data/data.json` (build-time, via a `@data` alias); every component takes its data via **props** so it's testable with fixtures. Only the #727 hero makes a runtime call — one client-side `fetch` of the GitHub issue at load, falling back to the committed baseline. Built to `site/dist/` and deployed by a GitHub Actions workflow on push to `main`.

**Tech Stack:** Vite 6, React 18, TypeScript, Recharts, Vitest + @testing-library/react + jsdom. GitHub Pages via Actions.

**Prerequisite:** Plan A is complete — `data/data.json` exists and matches the `DataJson` contract (mirrored verbatim in Task 1 below).

## Global Constraints

- **Node:** ≥ 20; ESM; npm **workspace** `site` under the existing root `package.json`.
- **Pages base path:** `/homebrew-aws-cli-release-tracker/` (Vite `base`). Configurable for a future custom domain.
- **`@data` alias** → repo-root `data/data.json`. Components never import it directly — only `src/data.ts` does; components receive data via props.
- **Data contract:** the `DataJson`/`SeriesPoint`/`Summary`/`CoverageEntry` shapes in Task 1 must match `ingest/src/export.ts` **exactly**. Durations are **hours** (number).
- **Live #727 fetch:** `GET https://api.github.com/repos/aws/aws-cli/issues/727`, unauthenticated, at page load; on any failure fall back to `data.issue727`. The **days counter** is computed client-side from `issue727.createdAt` and never depends on the fetch.
- **Copy anchors (verbatim):** #727 filed **2014-03-29**, still open; `awscli@1` maintenance mode **2026-07-15**; Homebrew split **2016-03-01** (`brew` + `homebrew-core`); `legacy-homebrew` archived **2019-01-23**; BrewTestBot automation era **~2020-04** *(verify exact date during Task 7)*.
- **Commits are GPG-signed**; end messages with the repo's `Co-Authored-By` / `Claude-Session` trailers.

---

### Task 1: Site scaffold + data contract + build-time data wiring

**Files:**
- Create: `site/package.json`, `site/tsconfig.json`, `site/vite.config.ts`, `site/vitest.config.ts`
- Create: `site/index.html`, `site/src/main.tsx`, `site/src/App.tsx`
- Create: `site/src/types.ts`, `site/src/vite-env.d.ts`, `site/src/data.ts`
- Test: `site/test/data.test.ts`

**Interfaces:**
- Produces `site/src/types.ts` (mirror of the export contract) and `import { data } from './data.js'` (typed `DataJson`).

- [ ] **Step 1: Create `site/package.json`**

```json
{
  "name": "site",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "recharts": "^2.13.0"
  },
  "devDependencies": {
    "@testing-library/react": "^16.1.0",
    "@testing-library/jest-dom": "^6.6.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "vitest": "^3.2.0"
  }
}
```

- [ ] **Step 2: Create `site/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: Create `site/vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  base: '/homebrew-aws-cli-release-tracker/',
  plugins: [react()],
  resolve: { alias: { '@data': resolve(__dirname, '../data/data.json') } },
  server: { fs: { allow: ['..'] } },
});
```

- [ ] **Step 4: Create `site/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@data': resolve(__dirname, '../data/data.json') } },
  test: { environment: 'jsdom', globals: true, include: ['test/**/*.test.{ts,tsx}'], setupFiles: ['./test/setup.ts'] },
});
```

- [ ] **Step 5: Create `site/test/setup.ts`**

Also stub `fetch` globally so component tests never hit the network — the #727 live fetch then fails cleanly and components fall back to their baseline prop. Tests that exercise `fetchIssue727Live` directly pass their own `fetchImpl` and are unaffected.

```ts
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// No real network in tests: live #727 fetch resolves to a non-OK response,
// so useIssue727 falls back to the baseline it was given.
vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403, json: async () => ({}) })));
```

- [ ] **Step 6: Create `site/src/types.ts` (mirror of `ingest/src/export.ts`)**

```ts
export interface Summary { mean: number; median: number; p90: number; n: number }
export interface SeriesPoint {
  version: string; major: number; formula: 'awscli' | 'awscli@1';
  releasedAt: string; formulaAt: string | null; bottleAt: string | null;
  totalH: number | null; noticeH: number | null; buildH: number | null;
}
export interface CoverageEntry { awscli: number; shipped: number; pct: number }
export interface Issue727 { state: 'open' | 'closed'; createdAt: string; closedAt: string | null; url: string }
export interface DataJson {
  generatedAt: string;
  windowStart: string;
  issue727: Issue727;
  headline: {
    totalBottleLag: { d30: Summary; d90: Summary; y1: Summary; all: Summary };
    noticeLatency: { y1: Summary; all: Summary };
    bottleBuildLatency: { y1: Summary; all: Summary };
  };
  coverage: { overall: CoverageEntry; v1: CoverageEntry; v2: CoverageEntry };
  series: SeriesPoint[];
  recent: SeriesPoint[];
  notes: { awscli1MaintenanceMode: string };
}
```

- [ ] **Step 7: Create `site/src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />
declare module '@data' { const value: unknown; export default value; }
```

- [ ] **Step 8: Create `site/src/data.ts`**

```ts
import raw from '@data';
import type { DataJson } from './types.js';

export const data = raw as DataJson;
```

- [ ] **Step 9: Create `site/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Is Homebrew keeping up with aws-cli?</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 10: Create `site/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 11: Create `site/src/App.tsx` (placeholder — fleshed out in Task 8)**

```tsx
import { data } from './data.js';

export function App() {
  return <main><h1>aws-cli ↔ Homebrew</h1><p>Data generated {data.generatedAt}</p></main>;
}
```

- [ ] **Step 12: Write the data-contract test** — `site/test/data.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { data } from '../src/data.js';

describe('committed data.json matches the contract', () => {
  it('has the headline windows and issue727', () => {
    expect(data.headline.totalBottleLag).toHaveProperty('d30');
    expect(data.headline.totalBottleLag).toHaveProperty('all');
    expect(data.headline.noticeLatency).toHaveProperty('y1');
    expect(['open', 'closed']).toContain(data.issue727.state);
    expect(data.issue727.createdAt).toBe('2014-03-29T22:32:43Z');
    expect(Array.isArray(data.series)).toBe(true);
  });
});
```

- [ ] **Step 13: Install + run test**

Run: `npm install && npm -w site test`
Expected: PASS (reads the real committed `data/data.json`).

- [ ] **Step 14: Verify the build works**

Run: `npm -w site run build`
Expected: `site/dist/` produced with `index.html` referencing `/homebrew-aws-cli-release-tracker/assets/...`.

- [ ] **Step 15: Commit**

```bash
git add site package-lock.json
git commit -m "feat(site): Vite+React scaffold, data contract, build-time data wiring

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YbcAbdkFNTQ76nEZ6RxqXm"
```

---

### Task 2: Formatting helpers

**Files:**
- Create: `site/src/format.ts`
- Test: `site/test/format.test.ts`

**Interfaces:**
- Produces:
  - `formatDuration(hours: number): string` — `< 1h` → `"42m"`; `< 48h` → `"3h 12m"` (drop `0m` → `"3h"`); else `"2.1 d"`.
  - `formatDate(iso: string): string` — `"Jul 1, 2026"` (UTC).
  - `daysSince(iso: string, now: number): number` — whole days floor.

- [ ] **Step 1: Write the failing test** — `site/test/format.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { formatDuration, formatDate, daysSince } from '../src/format.js';

describe('formatDuration', () => {
  it('minutes under an hour', () => expect(formatDuration(0.7)).toBe('42m'));
  it('hours and minutes', () => expect(formatDuration(3.2)).toBe('3h 12m'));
  it('whole hours drop minutes', () => expect(formatDuration(3)).toBe('3h'));
  it('days past 48h', () => expect(formatDuration(50.4)).toBe('2.1 d'));
});

describe('formatDate', () => {
  it('formats UTC', () => expect(formatDate('2026-07-01T18:00:00Z')).toBe('Jul 1, 2026'));
});

describe('daysSince', () => {
  it('counts whole days', () => {
    const now = Date.parse('2026-07-02T00:00:00Z');
    expect(daysSince('2014-03-29T22:32:43Z', now)).toBe(4478);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w site test format`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `site/src/format.ts`**

```ts
const DAY_MS = 86_400_000;

export function formatDuration(hours: number): string {
  if (hours >= 48) return `${(hours / 24).toFixed(1)} d`;
  const totalMin = Math.round(hours * 60); // round once so minutes never render as 60
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function daysSince(iso: string, now: number): number {
  // calendar-day floor (UTC): a late-in-day start (…22:32) must still count 4478, not 4477
  return Math.floor(now / DAY_MS) - Math.floor(Date.parse(iso) / DAY_MS);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm -w site test format`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add site/src/format.ts site/test/format.test.ts
git commit -m "feat(site): duration/date/days formatting helpers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YbcAbdkFNTQ76nEZ6RxqXm"
```

---

### Task 3: Issue #727 hero (live fetch + live day counter)

**Files:**
- Create: `site/src/useIssue727.ts`
- Create: `site/src/components/HeroCounter.tsx`
- Test: `site/test/useIssue727.test.ts`, `site/test/HeroCounter.test.tsx`

**Interfaces:**
- Consumes: `Issue727` from `types.ts`; `daysSince` from `format.ts`.
- Produces:
  - `fetchIssue727Live(fetchImpl?: typeof fetch): Promise<Pick<Issue727,'state'|'closedAt'> | null>` — parses the GitHub issue JSON; returns `null` on non-OK response or thrown error.
  - `useIssue727(baseline: Issue727): Issue727` — starts from `baseline`, fires one `fetchIssue727Live()` on mount, merges `state`/`closedAt` when it succeeds.
  - `HeroCounter({ issue727 }: { issue727: Issue727 })` — big live day count (ticks via `setInterval`), status line with emoji.

- [ ] **Step 1: Write the failing tests**

`site/test/useIssue727.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { fetchIssue727Live } from '../src/useIssue727.js';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

describe('fetchIssue727Live', () => {
  it('parses an open issue', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ state: 'open', closed_at: null }));
    expect(await fetchIssue727Live(fetchImpl as unknown as typeof fetch)).toEqual({ state: 'open', closedAt: null });
  });
  it('parses a closed issue', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ state: 'closed', closed_at: '2027-01-01T00:00:00Z' }));
    expect(await fetchIssue727Live(fetchImpl as unknown as typeof fetch)).toEqual({ state: 'closed', closedAt: '2027-01-01T00:00:00Z' });
  });
  it('returns null on rate limit', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, false, 403));
    expect(await fetchIssue727Live(fetchImpl as unknown as typeof fetch)).toBeNull();
  });
  it('returns null when fetch throws', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('offline'); });
    expect(await fetchIssue727Live(fetchImpl as unknown as typeof fetch)).toBeNull();
  });
});
```

`site/test/HeroCounter.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeroCounter } from '../src/components/HeroCounter.js';

describe('HeroCounter', () => {
  it('renders a days-open count and open status', () => {
    render(<HeroCounter issue727={{ state: 'open', createdAt: '2014-03-29T22:32:43Z', closedAt: null, url: 'u' }} />);
    expect(screen.getByText(/days/i)).toBeInTheDocument();
    expect(screen.getByText(/still open/i)).toBeInTheDocument();
  });
  it('celebrates a closed issue', () => {
    render(<HeroCounter issue727={{ state: 'closed', createdAt: '2014-03-29T22:32:43Z', closedAt: '2027-01-01T00:00:00Z', url: 'u' }} />);
    expect(screen.getByText(/closed/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm -w site test useIssue727 HeroCounter`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write `site/src/useIssue727.ts`**

```ts
import { useEffect, useState } from 'react';
import type { Issue727 } from './types.js';

const ISSUE_API = 'https://api.github.com/repos/aws/aws-cli/issues/727';

export async function fetchIssue727Live(
  fetchImpl: typeof fetch = fetch,
): Promise<Pick<Issue727, 'state' | 'closedAt'> | null> {
  try {
    const res = await fetchImpl(ISSUE_API, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return null;
    const body = (await res.json()) as { state: string; closed_at: string | null };
    return { state: body.state === 'closed' ? 'closed' : 'open', closedAt: body.closed_at ?? null };
  } catch {
    return null;
  }
}

export function useIssue727(baseline: Issue727): Issue727 {
  const [issue, setIssue] = useState<Issue727>(baseline);
  useEffect(() => {
    let live = true;
    fetchIssue727Live().then((r) => {
      if (live && r) setIssue((prev) => ({ ...prev, state: r.state, closedAt: r.closedAt }));
    });
    return () => { live = false; };
  }, []);
  return issue;
}
```

- [ ] **Step 4: Write `site/src/components/HeroCounter.tsx`**

```tsx
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm -w site test useIssue727 HeroCounter`
Expected: PASS (6 tests green).

- [ ] **Step 6: Commit**

```bash
git add site/src/useIssue727.ts site/src/components/HeroCounter.tsx site/test/useIssue727.test.ts site/test/HeroCounter.test.tsx
git commit -m "feat(site): #727 hero with live status fetch + live days counter

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YbcAbdkFNTQ76nEZ6RxqXm"
```

---

### Task 4: Headline stat cards

**Files:**
- Create: `site/src/components/HeadlineStats.tsx`
- Test: `site/test/HeadlineStats.test.tsx`

**Interfaces:**
- Consumes: `DataJson['headline']` from `types.ts`; `formatDuration` from `format.ts`.
- Produces: `HeadlineStats({ headline }: { headline: DataJson['headline'] })` — three cards:
  1. **Total bottle lag** — big `y1.mean`; sub-row of `30d / 90d / 1y / all-time` means; `title` attr shows median/p90.
  2. **Notice latency** (`noticeLatency.y1.mean`, all-time secondary).
  3. **Bottle build latency** (`bottleBuildLatency.y1.mean`, all-time secondary).

- [ ] **Step 1: Write the failing test** — `site/test/HeadlineStats.test.tsx`

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeadlineStats } from '../src/components/HeadlineStats.js';
import type { DataJson } from '../src/types.js';

const s = (mean: number) => ({ mean, median: mean, p90: mean, n: 3 });
const headline: DataJson['headline'] = {
  totalBottleLag: { d30: s(3), d90: s(4), y1: s(5), all: s(6) },
  noticeLatency: { y1: s(1), all: s(2) },
  bottleBuildLatency: { y1: s(1.5), all: s(2.5) },
};

describe('HeadlineStats', () => {
  it('renders all three headline labels', () => {
    render(<HeadlineStats headline={headline} />);
    expect(screen.getByText(/time to installable bottle/i)).toBeInTheDocument();
    expect(screen.getByText(/homebrew noticed/i)).toBeInTheDocument();
    expect(screen.getByText(/bottle build/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w site test HeadlineStats`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `site/src/components/HeadlineStats.tsx`**

```tsx
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm -w site test HeadlineStats`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add site/src/components/HeadlineStats.tsx site/test/HeadlineStats.test.tsx
git commit -m "feat(site): three headline stat cards

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YbcAbdkFNTQ76nEZ6RxqXm"
```

---

### Task 5: Main lag graph

**Files:**
- Create: `site/src/components/LagChart.tsx`
- Test: `site/test/LagChart.test.tsx`

**Interfaces:**
- Consumes: `SeriesPoint[]` from `types.ts`; `formatDuration`, `formatDate` from `format.ts`.
- Produces: `LagChart({ series }: { series: SeriesPoint[] })` — a Recharts `ComposedChart`: numeric time X-axis (`Date.parse(releasedAt)`), log Y in hours, two `Scatter`s (v1 major 1, v2 major 2) over points with `totalH != null`, and a `Line` of a trailing rolling average (window 10). Wrapped in `ResponsiveContainer`.

- [ ] **Step 1: Write the failing test** — `site/test/LagChart.test.tsx`

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LagChart } from '../src/components/LagChart.js';
import type { SeriesPoint } from '../src/types.js';

const pt = (version: string, major: number, releasedAt: string, totalH: number): SeriesPoint => ({
  version, major, formula: major === 1 ? 'awscli@1' : 'awscli',
  releasedAt, formulaAt: releasedAt, bottleAt: releasedAt, totalH, noticeH: 1, buildH: 1,
});

describe('LagChart', () => {
  it('renders without crashing given points', () => {
    const series = [pt('2.35.14', 2, '2026-07-01T18:00:00Z', 3), pt('1.45.30', 1, '2026-06-16T18:00:00Z', 5)];
    // ResponsiveContainer needs a size in jsdom; wrap in a sized div
    const { container } = render(<div style={{ width: 600, height: 400 }}><LagChart series={series} /></div>);
    expect(container.querySelector('.recharts-responsive-container')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w site test LagChart`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `site/src/components/LagChart.tsx`**

```tsx
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm -w site test LagChart`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add site/src/components/LagChart.tsx site/test/LagChart.test.tsx
git commit -m "feat(site): main lag-over-time chart (v1/v2 scatter + rolling avg)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YbcAbdkFNTQ76nEZ6RxqXm"
```

---

### Task 6: Recent-releases table

**Files:**
- Create: `site/src/components/RecentTable.tsx`
- Test: `site/test/RecentTable.test.tsx`

**Interfaces:**
- Consumes: `SeriesPoint[]` (the `recent` array); `formatDuration`, `formatDate`.
- Produces: `RecentTable({ recent }: { recent: SeriesPoint[] })` — columns: version · line (v1/v2) · aws date · notice · build · total. Null durations render as `—`.

- [ ] **Step 1: Write the failing test** — `site/test/RecentTable.test.tsx`

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecentTable } from '../src/components/RecentTable.js';
import type { SeriesPoint } from '../src/types.js';

const recent: SeriesPoint[] = [
  { version: '2.35.14', major: 2, formula: 'awscli', releasedAt: '2026-07-01T18:00:00Z', formulaAt: '2026-07-01T20:00:00Z', bottleAt: '2026-07-01T21:00:00Z', noticeH: 2, buildH: 1, totalH: 3 },
  { version: '2.35.13', major: 2, formula: 'awscli', releasedAt: '2026-06-30T18:00:00Z', formulaAt: '2026-06-30T20:00:00Z', bottleAt: null, noticeH: 2, buildH: null, totalH: null },
];

describe('RecentTable', () => {
  it('renders rows and dashes for pending bottles', () => {
    render(<RecentTable recent={recent} />);
    expect(screen.getByText('2.35.14')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w site test RecentTable`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `site/src/components/RecentTable.tsx`**

```tsx
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm -w site test RecentTable`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add site/src/components/RecentTable.tsx site/test/RecentTable.test.tsx
git commit -m "feat(site): recent-releases table

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YbcAbdkFNTQ76nEZ6RxqXm"
```

---

### Task 7: News scroller + curated content

**Files:**
- Create: `site/src/news.ts`
- Create: `site/src/components/NewsScroller.tsx`
- Test: `site/test/news.test.ts`

**Interfaces:**
- Produces:
  - `interface NewsItem { date: string; text: string; kind: 'milestone' | 'world' }` (`date` = ISO `YYYY-MM-DD`)
  - `NEWS: NewsItem[]` — curated, sorted ascending by date; **must** include the anchor milestones from Global Constraints. Interleave world events for comedic contrast, each reinforcing "…and #727 is still open." Keep it tasteful.
  - `NewsScroller({ items }: { items: NewsItem[] })` — a CSS marquee ticker titled "Events since #727 was filed (2014-03-29)".

**Content requirements** (verify each date via `gh`/web before finalizing; the test enforces the milestone anchors):
- `2014-03-29` — milestone — #727 filed: "Install aws-cli using Homebrew."
- `2016-03-01` — milestone — Homebrew splits into `brew` + `homebrew-core`.
- `2019-01-23` — milestone — `legacy-homebrew` archived.
- `2020-xx-xx` — milestone — BrewTestBot automation era begins *(verify exact date; use the earliest automated awscli bump you can confirm)*.
- Plus ≥ 6 world-event lines spread across 2014–2026 for comedic contrast (author these; keep them light and broadly verifiable).

- [ ] **Step 1: Write the failing test** — `site/test/news.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { NEWS } from '../src/news.js';

describe('NEWS content', () => {
  it('is sorted ascending by date', () => {
    const dates = NEWS.map((n) => n.date);
    expect(dates).toEqual([...dates].sort());
  });
  it('includes the required milestone anchors', () => {
    const milestones = NEWS.filter((n) => n.kind === 'milestone').map((n) => n.date);
    expect(milestones).toEqual(expect.arrayContaining(['2014-03-29', '2016-03-01', '2019-01-23']));
    expect(milestones.some((d) => d.startsWith('2020'))).toBe(true);
  });
  it('has at least six world-event lines', () => {
    expect(NEWS.filter((n) => n.kind === 'world').length).toBeGreaterThanOrEqual(6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w site test news`
Expected: FAIL — module not found.

- [ ] **Step 3: Verify dates, then write `site/src/news.ts`**

First verify the BrewTestBot automation date and sanity-check the others:
```bash
gh api repos/aws/aws-cli/issues/727 --jq '.created_at'   # expect 2014-03-29...
gh api repos/Homebrew/homebrew-core --jq '.created_at'    # expect 2016-03-01...
```
Then author the file (world-event copy is illustrative — refine for taste; every line lands the running joke):

```ts
export interface NewsItem { date: string; text: string; kind: 'milestone' | 'world' }

export const NEWS: NewsItem[] = [
  { date: '2014-03-29', kind: 'milestone', text: 'aws-cli #727 filed: "Install aws-cli using Homebrew." A simple ask.' },
  { date: '2015-07-14', kind: 'world', text: 'New Horizons reaches Pluto — 3 billion miles. #727: still open.' },
  { date: '2016-03-01', kind: 'milestone', text: 'Homebrew splits into brew + homebrew-core. #727 watches from the sidelines.' },
  { date: '2017-08-21', kind: 'world', text: 'A total solar eclipse crosses the USA. The moon moved. #727 did not.' },
  { date: '2019-01-23', kind: 'milestone', text: 'legacy-homebrew archived. An entire repo retired before #727.' },
  { date: '2019-04-10', kind: 'world', text: 'Humanity photographs a black hole. #727 remains a event horizon of its own.' },
  { date: '2020-04-26', kind: 'milestone', text: 'BrewTestBot automation era begins — bumps land in hours. #727: technically still open.' },
  { date: '2021-02-18', kind: 'world', text: 'Perseverance lands on Mars. Another planet reached; #727 unreached.' },
  { date: '2022-11-30', kind: 'world', text: 'ChatGPT launches; the world learns to code differently. #727 endures.' },
  { date: '2024-04-08', kind: 'world', text: 'Another North American total eclipse. Two eclipses out-shipped #727.' },
  { date: '2026-07-15', kind: 'milestone', text: 'awscli@1 enters maintenance mode. Even v1 is winding down — #727 is not.' },
];
```

- [ ] **Step 4: Write `site/src/components/NewsScroller.tsx`**

```tsx
import type { NewsItem } from '../news.js';

export function NewsScroller({ items }: { items: NewsItem[] }) {
  const line = items.map((n) => `${n.date.slice(0, 4)} · ${n.text}`);
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm -w site test news`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add site/src/news.ts site/src/components/NewsScroller.tsx site/test/news.test.ts
git commit -m "feat(site): humorous news scroller anchored to #727

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YbcAbdkFNTQ76nEZ6RxqXm"
```

---

### Task 8: App assembly + styling

**Files:**
- Modify: `site/src/App.tsx`
- Create: `site/src/index.css`
- Modify: `site/src/main.tsx` (import the stylesheet)
- Test: `site/test/App.test.tsx`

**Interfaces:**
- Consumes: `data` from `data.ts`; all components; `NEWS` from `news.ts`.
- Produces: the composed page, hero → stats → chart → recent table → maintenance note → scroller.

- [ ] **Step 1: Write the failing test** — `site/test/App.test.tsx`

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '../src/App.js';

describe('App', () => {
  it('renders the hero and section headings from committed data', () => {
    render(<App />);
    expect(screen.getByText(/#727/)).toBeInTheDocument();
    expect(screen.getByText(/installable Homebrew bottle/i)).toBeInTheDocument();
    expect(screen.getByText(/Recent releases/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w site test App`
Expected: FAIL — App still the placeholder.

- [ ] **Step 3: Rewrite `site/src/App.tsx`**

```tsx
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
```

- [ ] **Step 4: Write `site/src/index.css`** (clean, responsive, no external assets)

```css
:root {
  --bg: #0f1117; --panel: #171a23; --ink: #e7e9ee; --muted: #9aa3b2;
  --v2: #ff9900; --v1: #3b82f6; --accent: #ffcc66;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); }
.page { max-width: 980px; margin: 0 auto; padding: 2rem 1rem 0; }
.page__head h1 { font-size: clamp(1.6rem, 4vw, 2.6rem); margin: 0 0 .25rem; }
.page__sub { color: var(--muted); margin: 0 0 1.5rem; }
.hero { text-align: center; padding: 2rem 1rem; background: var(--panel); border-radius: 16px; margin-bottom: 1.5rem; }
.hero__kicker { color: var(--muted); margin: 0; } .hero__kicker a { color: var(--accent); }
.hero__count { margin: .5rem 0; } .hero__num { font-size: clamp(3rem, 12vw, 6rem); font-weight: 800; color: var(--accent); }
.hero__status { font-size: 1.2rem; margin: 0; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
.stat { background: var(--panel); border-radius: 12px; padding: 1.25rem; }
.stat--hero { grid-column: 1 / -1; } .stat--hero .stat__value { font-size: 3rem; }
.stat__label { color: var(--muted); font-size: .9rem; } .stat__label span { opacity: .7; }
.stat__value { font-size: 2rem; font-weight: 700; }
.stat__windows { display: flex; gap: 1rem; flex-wrap: wrap; color: var(--muted); margin-top: .5rem; }
.stat__sub { color: var(--muted); margin-top: .25rem; }
.chart, .recent { background: var(--panel); border-radius: 12px; padding: 1.25rem; margin-bottom: 1.5rem; }
.chart h2, .recent h2 { margin: 0 0 1rem; font-size: 1.1rem; }
.recent__scroll { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
th, td { text-align: left; padding: .5rem .75rem; border-bottom: 1px solid #262a35; white-space: nowrap; }
th { color: var(--muted); font-weight: 600; }
.note { color: var(--muted); text-align: center; }
.ticker { overflow: hidden; background: #000; border-radius: 12px; padding: .75rem 0; margin: 1.5rem 0; }
.ticker__label { color: var(--accent); font-weight: 700; padding: 0 1rem .5rem; }
.ticker__track { display: inline-flex; gap: 3rem; white-space: nowrap; animation: scroll 120s linear infinite; }
.ticker__item { color: var(--ink); }
@keyframes scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@media (prefers-reduced-motion: reduce) { .ticker__track { animation: none; } }
.page__foot { color: var(--muted); text-align: center; padding: 2rem 1rem 3rem; font-size: .9rem; }
```

- [ ] **Step 5: Import the stylesheet in `site/src/main.tsx`**

Add as the first import: `import './index.css';`

- [ ] **Step 6: Run test to verify it passes**

Run: `npm -w site test App`
Expected: PASS.

- [ ] **Step 7: Full check — all tests + build + local preview**

Run: `npm -w site test && npm -w site run build && npm -w site run preview`
Expected: all tests pass; build succeeds; preview serves at `/homebrew-aws-cli-release-tracker/`. Visually confirm hero counter ticks, chart renders, scroller animates.

- [ ] **Step 8: Commit**

```bash
git add site/src/App.tsx site/src/index.css site/src/main.tsx site/test/App.test.tsx
git commit -m "feat(site): assemble dashboard + styling

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YbcAbdkFNTQ76nEZ6RxqXm"
```

---

### Task 9: GitHub Actions Pages deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:** builds `site/` and deploys `site/dist` to Pages on push to `main` (paths `site/**`, `data/**`, workflow file) and via manual dispatch.

- [ ] **Step 1: Write `.github/workflows/deploy.yml`**

```yaml
name: Deploy site to Pages
on:
  push:
    branches: [main]
    paths: ['site/**', 'data/**', '.github/workflows/deploy.yml', 'package.json', 'package-lock.json']
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm -w site run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with: { path: site/dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Lint the workflow YAML locally**

Run: `node -e "const y=require('fs').readFileSync('.github/workflows/deploy.yml','utf8'); if(!y.includes('deploy-pages')) throw new Error('bad'); console.log('ok')"`
Expected: `ok`. (Full validation happens once pushed — see Task 10.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: GitHub Pages deploy workflow

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YbcAbdkFNTQ76nEZ6RxqXm"
```

---

### Task 10: README + create remote + enable Pages + first deploy

**Files:**
- Create: `README.md`

> **⚠️ Outward-facing — confirm with the user before running Steps 3–5.** Creating a public GitHub repo and enabling Pages are public actions. Confirm the **repo name**, **owner** (`purp`?), and **visibility** first.

**Interfaces:** documents what the site is, how to run the pipeline, how to query the SQLite, the weekly Cowork refresh, and Pages setup.

- [ ] **Step 1: Write `README.md`**

````markdown
# aws-cli ↔ Homebrew release tracker

How closely does Homebrew track [aws-cli](https://github.com/aws/aws-cli) releases? This measures the lag from each aws-cli git tag to the Homebrew formula bump and the built bottle — and keeps a running tally of how long [aws-cli#727](https://github.com/aws/aws-cli/issues/727) has stayed open.

**Live site:** https://purp.github.io/homebrew-aws-cli-release-tracker/

## Layout
- `ingest/` — TypeScript pipeline: GitHub API → `data/tracker.sqlite` → `data/data.json`.
- `site/` — Vite + React dashboard deployed to GitHub Pages.
- `data/tracker.sqlite` — source of truth (committed). `data/data.json` — derived stats (committed).

## Refresh the data (weekly, via Claude Cowork)
```bash
npm install
npm run refresh        # incremental GitHub fetch → updates data/tracker.sqlite + data/data.json
git add data/tracker.sqlite data/data.json
git commit -m "data: weekly refresh"
git push               # GitHub Actions rebuilds + redeploys Pages
```
Uses `GITHUB_TOKEN` if set, else `gh auth token`.

## Query the database yourself
```bash
sqlite3 data/tracker.sqlite "SELECT version, releasedAt, bottleAt FROM tracking ORDER BY releasedAt DESC LIMIT 10;"
```

## Develop the site
```bash
npm -w site run dev      # local dev server
npm -w site test         # unit tests
```

## Metrics
- **Total bottle lag** = bottle commit − aws-cli tag (what a `brew upgrade` user waits for).
- **Notice latency** = formula PR merge − tag. **Bottle build latency** = bottle − formula merge.
- Averages are means; medians/p90 are in tooltips. Window starts 2020-01-01.
````

- [ ] **Step 2: Commit the README**

```bash
git add README.md
git commit -m "docs: README (usage, refresh, querying)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YbcAbdkFNTQ76nEZ6RxqXm"
```

- [ ] **Step 3: Create the remote and push** *(after user confirmation)*

Run: `gh repo create homebrew-aws-cli-release-tracker --public --source=. --remote=origin --push`
Expected: repo created under the authenticated account, `main` pushed.

- [ ] **Step 4: Enable Pages with the Actions build type**

Run: `gh api -X POST repos/{owner}/homebrew-aws-cli-release-tracker/pages -f build_type=workflow`
Expected: 201/204. (If it errors because Pages is already/again configured, set it in Settings → Pages → Source: GitHub Actions.)

- [ ] **Step 5: Trigger + verify the deploy**

Run: `gh workflow run "Deploy site to Pages" && sleep 5 && gh run list --workflow=deploy.yml --limit 1`
Then watch: `gh run watch $(gh run list --workflow=deploy.yml --limit 1 --json databaseId --jq '.[0].databaseId')`
Expected: workflow succeeds; site live at `https://{owner}.github.io/homebrew-aws-cli-release-tracker/`. Confirm the hero counter, chart, table, and scroller render.

---

## Self-Review

**Spec coverage:**
- Hero #727 live days-open counter + live status fetch with fallback → Task 3. ✅
- Three headline stats (total/notice/build) with windows + median/p90 tooltips → Task 4. ✅
- Main lag-over-time graph, v1/v2, rolling avg → Task 5. ✅
- Recent-releases table → Task 6. ✅
- News scroller (anchors: #727 2014, both Homebrew fork events, BrewTestBot, world events) → Task 7. ✅
- `awscli@1` maintenance-mode note → Task 8. ✅
- Static Vite build, `@data` import, base path → Tasks 1, 8. ✅
- GitHub Pages deploy on push → Task 9. ✅
- README + weekly Cowork refresh docs + remote/Pages setup → Task 10. ✅
- Data contract mirrors `export.ts` → Task 1 (enforced by `data.test.ts`). ✅

**Placeholder scan:** none — every step has real code/commands. Task 7 world-event copy is explicitly illustrative-and-refine, with the test enforcing the factual milestone anchors.

**Type consistency:** `DataJson`, `SeriesPoint`, `Summary`, `CoverageEntry`, `Issue727`, `NewsItem` and component props (`headline`, `series`, `recent`, `issue727`, `items`) are consistent across tasks and match the App wiring in Task 8.
