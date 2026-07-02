# AWS CLI ↔ Homebrew Release Tracker — Design

**Date:** 2026-07-02
**Status:** Approved for planning
**Supersedes:** [purp/bd3c8a3bbec855ab95130fad1a28bd19](https://gist.github.com/purp/bd3c8a3bbec855ab95130fad1a28bd19) (2017-era clone-and-git-log approach)

## Background & Motivation

AWS CLI issue [#727 "Install aws-cli using Homebrew"](https://github.com/aws/aws-cli/issues/727) was filed **2014-03-29** and is **still open** — 12+ years later — despite aws-cli having been installable via Homebrew for years and now tracking upstream releases within hours. The original gist measured this tracking latency by cloning `aws/aws-cli` and `homebrew-core` and parsing `git log`. This revamp replaces that with a GitHub-API pipeline, a SQLite store, and a static dashboard on GitHub Pages, refreshed weekly by Claude Cowork.

Two things changed since the gist: aws-cli now has **two lines** — v1 (git `develop` branch, `1.x` tags) and v2 (`v2` branch, `2.x` tags) — mapping to two Homebrew formulae (`awscli@1` and `awscli`); and Homebrew updates are now **automated** by BrewTestBot, which makes **two commits** per bump: a formula-version merge, then a bottle build ~1h later.

## Goals

- Pull release/update data **directly from the GitHub API** (no repo clones, no local `git`).
- Store the data in a committed **SQLite** database that anyone can pull down and query.
- Compute latency stats and render a **static dashboard** (headline numbers + a main lag graph + recent-releases table + a humorous news scroller).
- Deploy to **GitHub Pages** from this same repo; refresh **weekly via Claude Cowork** (incremental fetch → commit → push → auto-deploy).

## Non-Goals

- No runtime database or serverless functions — the site is fully static.
- No live/on-visit fetching from GitHub — data changes weekly and is committed.
- No pre-2020 history — window starts **2020-01-01** (covers both v1 and v2 in their currently-relevant era).
- Ingestion does **not** run on a schedule in CI — Cowork owns the weekly refresh (a GitHub Actions cron is a documented future alternative, not built now).

## Data Sources (GitHub API)

| Source | API | Notes |
|---|---|---|
| aws-cli releases | GraphQL `repository.refs(refPrefix:"refs/tags/")` → resolve each tag target to a `Commit.committedDate` | Tags are `1.x` (v1) and `2.x` (v2) in the **same repo** `aws/aws-cli`. AWS does **not** use GitHub Releases, so the **tag commit date is the release moment**. Handle both lightweight and annotated tags via inline fragments. |
| Homebrew v2 updates | REST `commits?path=Formula/a/awscli.rb` | Parse commit messages (see below). |
| Homebrew v1 updates | REST `commits?path=Formula/a/awscli@1.rb` | Same parsing, `awscli@1` prefix. |
| Issue #727 status | REST `issues/727` | `state`, `created_at`, `closed_at` — powers the **hero days-open counter**. |

**Auth:** `GITHUB_TOKEN` (locally `gh auth token`). Well within rate limits.

**Commit-message parsing** (the reliable signal — match by message, not author, so human-merged bumps aren't missed):
- Formula version merge: `^awscli(@1)? (\d[\w.]*)$` → e.g. `awscli 2.35.14`, `awscli@1 1.45.30`
- Bottle build: `^awscli(@1)?: update (\d[\w.]*) bottle\.$` → e.g. `awscli: update 2.35.14 bottle.`

The captured version may carry a Homebrew revision suffix (`1.45.0_1`). Normalize by stripping `_\d+` → `version_norm` (the upstream version) with `revision` recorded separately.

## Data Model (SQLite — `data/tracker.sqlite`)

```sql
CREATE TABLE awscli_release (
  version     TEXT PRIMARY KEY,   -- upstream version, e.g. '2.35.14'
  major       INTEGER NOT NULL,   -- 1 or 2
  tag_name    TEXT NOT NULL,
  commit_sha  TEXT NOT NULL,
  released_at TEXT NOT NULL        -- ISO-8601 UTC = tag commit committedDate
);

CREATE TABLE homebrew_update (
  formula            TEXT NOT NULL,          -- 'awscli' | 'awscli@1'
  version            TEXT NOT NULL,          -- raw, incl. revision, e.g. '1.45.0_1'
  version_norm       TEXT NOT NULL,          -- upstream, e.g. '1.45.0'
  revision           INTEGER NOT NULL DEFAULT 0,
  formula_commit_sha TEXT,
  formula_at         TEXT,                   -- ISO-8601 UTC (T1)
  bottle_commit_sha  TEXT,
  bottle_at          TEXT,                   -- ISO-8601 UTC (T2), null until bottle built
  PRIMARY KEY (formula, version)
);

CREATE TABLE meta ( key TEXT PRIMARY KEY, value TEXT );  -- incremental cursors, generatedAt, etc.

-- Latency view: join Homebrew shipment to its upstream tag; exclude revision-only rebuilds.
CREATE VIEW tracking AS
SELECT h.formula, h.version_norm AS version, r.major,
       r.released_at, h.formula_at, h.bottle_at,
       (julianday(h.formula_at) - julianday(r.released_at)) * 24.0 AS notice_h,
       (julianday(h.bottle_at)  - julianday(h.formula_at))  * 24.0 AS build_h,
       (julianday(h.bottle_at)  - julianday(r.released_at)) * 24.0 AS total_h
FROM homebrew_update h
JOIN awscli_release r ON r.version = h.version_norm
WHERE h.revision = 0;
```

**Join rule:** `homebrew_update.version_norm = awscli_release.version` (`awscli@1` ↔ major 1, `awscli` ↔ major 2). AWS releases Homebrew skipped simply have no `homebrew_update` row — counted toward *coverage*, not latency.

## Ingestion (`ingest/` — TypeScript, Octokit + better-sqlite3)

- **Tags:** fetch all `1.x`/`2.x` tags with commit dates via GraphQL (bounded to a few hundred, cheap). **Upsert** — full refresh each run is idempotent and simpler than a tag cursor. Drop tags with `released_at < 2020-01-01`.
- **Homebrew commits:** paginate newest-first per formula; **stop** when a commit SHA is already stored (`meta` cursor) or its date < 2020-01-01. Parse messages, upsert into `homebrew_update`: a formula-merge fills `formula_*`, a bottle commit fills `bottle_*` for the same `(formula, version)`. This naturally back-fills `bottle_at` on a later run when the earlier run caught only the formula merge.
- **Cursors** in `meta`: newest processed SHA per formula.

### Edge cases (must handle)
1. **Bottle not yet built** — `bottle_at` null; row still stored; excluded from bottle/total stats until a later run fills it.
2. **Revision-only rebuild** (`1.45.0_1`, no new upstream) — stored with `revision>0`, excluded from the `tracking` view so it doesn't double-count against one upstream tag.
3. **Formula merge with no matching tag** (shouldn't happen for real releases) — no join row; log a warning.
4. **Annotated vs lightweight tags** — GraphQL inline fragments resolve both to a `Commit.committedDate`.

## Metrics & Stats

**Hero — Issue #727 days-open counter.** The site's whole point. Status (`open`/`closed`) comes from the GitHub API at ingestion; the **days count ticks live client-side** from `created_at` (2014-03-29T22:32:43Z), so it's accurate on every page load, not just after a weekly refresh. Open → *"Still open 😩 — N days and counting"*; if it ever flips → *"CLOSED 🎉 — after N days"* using `closed_at − created_at`. As of 2026-07-02: ~4,478 days (~12.3 years).

Three timestamps per shipped release: **T0** = aws-cli tag commit · **T1** = Homebrew formula merge · **T2** = Homebrew bottle. Clean decomposition: **total = notice + build**.

| # | Metric | Definition | Display |
|---|---|---|---|
| ① | **Total bottle lag** (hero + main graph) | `T2 − T0` | mean over **30d / 90d / 1y / all-time (since 2020-01-01)** |
| ② | **Notice latency** ("how fast did Homebrew notice") | `T1 − T0` | headline mean (1y + all-time) |
| ③ | **Bottle build latency** | `T2 − T1` | headline mean (1y + all-time) |

"Average" = **mean** (as requested). Also compute **median** and **p90** into the JSON and surface them in tooltips — means are skewed by the occasional multi-day outlier. Each stat records its sample size `n`. Windows are relative to `generatedAt`.

Also computed: **coverage** (aws-cli releases in window vs. count Homebrew shipped, overall and per major).

## Generated data (`data/data.json` — committed, human-diffable)

```jsonc
{
  "generatedAt": "2026-07-02T12:00:00Z",
  "windowStart": "2020-01-01",
  "issue727": { "state": "open", "createdAt": "2014-03-29T22:32:43Z", "closedAt": null,
                "url": "https://github.com/aws/aws-cli/issues/727" },
  "headline": {
    "totalBottleLag":     { "d30": {"mean":.., "median":.., "p90":.., "n":..}, "d90": {..}, "y1": {..}, "all": {..} },
    "noticeLatency":      { "y1": {..}, "all": {..} },
    "bottleBuildLatency": { "y1": {..}, "all": {..} }
  },
  "coverage": { "overall": {"awscli":.., "shipped":.., "pct":..}, "v1": {..}, "v2": {..} },
  "series": [ { "version":"2.35.14","major":2,"formula":"awscli",
               "releasedAt":"..","formulaAt":"..","bottleAt":"..",
               "totalH":.., "noticeH":.., "buildH":.., "revisionOnly":false } ],
  "recent": [ /* last ~20 shipped, newest first */ ],
  "notes": { "awscli1MaintenanceMode": "2026-07-15" }
}
```
All durations in **hours** (number); formatted human-friendly client-side (`3h 12m`, `1.4 d`).

## Web App (`site/` — Vite + React + Recharts, static)

- **Build:** Vite → `dist/`; `base: '/aws-cli-release-tracker/'` (project Pages path; configurable). Imports `data/data.json` via a Vite path alias (`@data`) — build-time, type-safe, no runtime fetch/base-path issues.
- **Layout (top → bottom):**
  1. **Hero card — Issue #727 status + live days-open counter.** Biggest element on the page; the days number counts up live from `created_at` (client-side `setInterval`), status pulled from `issue727` in the JSON. This is the punchline the whole site builds to.
  2. **Headline stat cards** — ① Total bottle lag big, with the 30d/90d/1y/all-time breakdown; ② Notice latency; ③ Bottle build latency. Median/p90 in tooltips.
  3. **Main graph** — Recharts scatter of **total bottle lag over time** (x = release date, y = lag, colored v1/v2) with a rolling-average line. Y-axis in hours, likely log-scaled to span minutes→days.
  4. **Recent releases table** — version · aws date · notice lag · build lag · total lag.
  5. **Maintenance-mode note** — `awscli@1` enters maintenance mode 2026-07-15.
  6. **News scroller** (below).

### News scroller (`site/src/news.ts` — curated, static)
A horizontally-scrolling ticker titled **"Events since aws-cli #727 was filed"**, tone = funny, emphasizing the 12-year open request. Anchored, factual milestones interleaved with world events that came and went during the wait:
- **2014-03-29** — #727 filed. *(still open as you read this)*
- **2016-03-01/06** — Homebrew splits: `brew` + `homebrew-core` spun out of the original (later `legacy-homebrew`).
- **2019-01-23** — `legacy-homebrew` archived.
- **~2020-04** — BrewTestBot automation era begins (auto version-bump + bottle builds). *(exact date verified during implementation)*
- Interleaved world-events for comedic contrast (curated for taste), all reinforcing "…and #727 is still open."

Content is authored data, not fetched. Dates verified against GitHub during implementation.

## Repo Layout

```
aws-cli-release-tracker/
  data/
    tracker.sqlite            # source of truth (committed, small)
    data.json                 # generated stats (committed, human-diffable)
  ingest/                     # ingest.ts, export.ts, github.ts, db.ts, stats.ts, parse.ts
    package.json
  site/                       # Vite + React + Recharts SPA
    src/ (App.tsx, components/, news.ts), index.html, vite.config.ts, package.json
  .github/workflows/deploy.yml # build site → deploy to Pages on push to main
  docs/superpowers/specs/2026-07-02-aws-cli-homebrew-tracker-design.md
  README.md                   # what it is, how to run ingest, how to query the sqlite
```

Top-level `package.json` provides `npm run refresh` (ingest → export) orchestrating the weekly update.

## Weekly Update Workflow (Claude Cowork)

1. `npm run refresh` — incremental fetch → update `data/tracker.sqlite` → regenerate `data/data.json`.
2. Commit `data/tracker.sqlite` + `data/data.json` (readable JSON diff shows what's new).
3. Push to `main` → GitHub Actions builds `site/` → deploys to Pages.

## Testing

- **Vitest** unit tests on the pure logic: commit-message parser, version normalization (`1.45.0_1` → `1.45.0`, rev 1), and stats math (mean/median/p90, window filtering, decomposition `total = notice + build`) against fixtures.
- A fixture-based test for the ingest upsert flow (formula merge then bottle build back-fills `bottle_at`).
- Lightweight; no live-network tests in CI.

## Risks / Notes

- **Binary `.sqlite` in git** — accepted (small; enables "pull down and query"). The committed `data.json` provides the readable diff.
- **Homebrew message-format drift** — parser is regex-based; a format change would silently drop rows. Mitigate with a post-parse assertion that recent tags have matching Homebrew rows where expected, and log gaps.
- **GitHub Pages base path** — `base` must match the repo/site path; documented and configurable for a future custom domain.
