# Weekly data-refresh workflow — design

**Date:** 2026-07-02
**Status:** approved

## Problem

The tracker's data (`data/data.json`, `data/tracker.sqlite`) is refreshed by
running `npm run refresh` locally and pushing. Keeping the live site current
therefore depends on someone remembering to run it. We want the refresh to run
on a schedule with no human in the loop.

## Goal

A GitHub Actions workflow that, once a week, re-runs the ingest, commits the
updated data files, and publishes the rebuilt site — with no manual step and no
new secrets.

## Existing mechanics (unchanged)

- `npm run refresh` → `ingest/src/cli.ts`: fetches aws-cli tags, Homebrew
  formula commits, and issue #727; updates `data/tracker.sqlite` incrementally
  (stops at the last-seen SHA); rewrites `data/data.json`.
- The ingest reads its GitHub token from `GITHUB_TOKEN` (falls back to
  `gh auth token`). Actions injects a token automatically, which also raises the
  read rate limit to 5,000 req/hr — no PAT or secret required.
- `.github/workflows/deploy.yml` builds `site/` and publishes to Pages. It
  triggers on push to `main` touching `data/**` (among others) **and** on
  `workflow_dispatch`.
- `site/test/data.test.ts` imports the real `data/data.json` (via the `@data`
  alias) and asserts the contract (headline windows, `issue727` shape, `series`
  is an array, fixed `createdAt`). Running it validates a freshly-generated file.

## Design

Add one workflow, `.github/workflows/refresh.yml`, plus a one-input change to
`deploy.yml` so the dispatched deploy can be pinned to an exact commit (see
"Pinning the deploy to the pushed commit" below).

**Triggers**
- `schedule: - cron: '0 17 * * 0'` — Sundays 17:00 UTC (10:00 PT).
- `workflow_dispatch` — manual "Run workflow" button for on-demand refreshes.

**Permissions:** `contents: write` (push the data commit), `actions: write`
(dispatch the deploy).

**Concurrency:** group `refresh` — a manual run cannot race the scheduled one on
the working tree / git push.

**Single job, in order:**
1. `actions/checkout@v4`.
2. `actions/setup-node@v4` (node 22, npm cache) → `npm ci`.
3. `npm run refresh`, with `GITHUB_TOKEN: ${{ github.token }}`.
4. **Validate:** `npm -w site run test`. The contract test reads the real
   data.json; a malformed ingest fails here and aborts before any commit.
5. **Commit if changed:** author as `github-actions[bot]`
   (`41898282+github-actions[bot]@users.noreply.github.com`), `git add data/`,
   and only if `git diff --cached` is non-empty, commit
   `chore(data): weekly refresh` and push. The guard prevents an empty-commit
   error.
6. **Deploy:** `gh workflow run deploy.yml --ref main -f ref=<pushed-sha>`, with
   `GH_TOKEN: ${{ github.token }}`, passing the SHA captured in step 5.

## Why dispatch the deploy instead of relying on the push

A push made with the built-in `GITHUB_TOKEN` deliberately does **not** trigger
other workflows' `push` events (GitHub's anti-recursion rule), so the data
commit would not fire `deploy.yml` on its own. `workflow_dispatch` is exempt
from that rule, so step 6 dispatches the existing deploy explicitly.

A developer's *own* local data push still auto-deploys as before — it uses their
credentials, not the Actions token — so this indirection only affects the
automated path, and there is no double-deploy (the automated push is suppressed;
only the dispatch fires; the Pages `concurrency` group guards overlap anyway).

## Pinning the deploy to the pushed commit

`gh workflow run deploy.yml` starts a run against `main`, but GitHub's Actions
control plane resolves the branch tip from a replica that can lag the git push
by a moment — observed during first verification: the refresh pushed the data
commit, yet the dispatched deploy built the *previous* SHA and republished stale
data. Left unaddressed the site would perpetually trail one refresh behind.

Fix: `deploy.yml` gains an optional `workflow_dispatch` input `ref`, and its
checkout uses `ref: ${{ inputs.ref || github.sha }}`. `refresh.yml` captures the
pushed SHA (`git rev-parse HEAD`) and passes it as that input, so the build is
pinned to the exact commit regardless of tip-resolution lag. Push events and
manual dispatches with no input fall back to `github.sha` — unchanged behaviour.
This keeps `deploy.yml` the single source of build/deploy truth (no duplicated
steps), the only cost being one optional input.

## Rejected alternatives

- **Commit with a PAT** so the push naturally triggers `deploy.yml`. Works, but
  introduces a Personal Access Token secret to create, store, and rotate.
- **One combined workflow** that ingests, commits, builds, and deploys inline.
  Self-contained but duplicates `deploy.yml`'s build/deploy steps, creating two
  places to keep in sync.

## Notes and trade-offs

- `data.json` embeds a `generatedAt` timestamp that changes every run, so each
  weekly run produces one commit even when no releases landed (~52/yr). This is
  expected and doubles as a "still alive" freshness signal. Diffing that
  excludes the timestamp is possible but not worth it at weekly cadence.

## Verification

After merge, trigger the workflow once manually and confirm the full chain:
refresh commits the data → deploy is dispatched → the live edge updates. Verify
by SHA then served content per the `deploy-verification` memory note.

## Out of scope

- Changing ingest logic, cadence beyond weekly, or the deploy job.
- Signed automated commits (chose plain `github-actions[bot]`, unsigned).
- Notifications/alerting on refresh failure (a red run in the Actions tab is the
  signal for now).
