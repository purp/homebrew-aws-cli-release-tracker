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
