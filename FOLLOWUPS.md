# Follow-ups

Non-blocking items deferred from the final whole-branch review (the site data is correct and the pipeline is sound; these are polish/robustness). Ordered roughly by value.

## Cheap wins
- **LagChart log-axis guard** (`site/src/components/LagChart.tsx`): the Y-axis uses `scale="log"` but the series is filtered `totalH !== null`, not `> 0`. Safe today (min observed lag ~1.78h), but a future same-second tag→bottle (0h) would break the axis. Add a `> 0` filter or clamp to a small floor.
- **`engines.node`** (`ingest/package.json`): the pipeline uses Node's built-in `node:sqlite`, which needs a recent Node (dev/runner is v26; flag-free ≥ ~22.5/24). Add `"engines": { "node": ">=22.5" }` so a contributor on older Node gets a clear error instead of a cryptic one. (CI only builds the site, which is unaffected.)
- **News scroller accessibility** (`site/src/components/NewsScroller.tsx`): the marquee duplicates its item list for a seamless loop, but the second copy isn't `aria-hidden`, so screen readers announce every item twice. Add `aria-hidden="true"` to the duplicate half.
- **Empty-window rendering** (`site/src/components/HeadlineStats.tsx` / `ingest/src/export.ts`): `summarize([])` returns `{mean:0,…,n:0}`, so a window with no bottled releases renders as `0m` ("instant") rather than "no data". Render `—`/"no data" when `n === 0`.

## Robustness / tests
- **More ingest edge tests**: formula-mismatch skip in `runIngest`; `resolveToken` `gh auth token` fallback. (The quiet-week cursor case is now covered.)

## Opportunistic polish
- **DRY**: extract a shared `pctOf(awscli, shipped)` in `export.ts` (dup'd in `cov()`/`merge()`); the two near-identical `upsertHomebrewFormula`/`upsertHomebrewBottle` in `db.ts` could share a helper.
- **Typing**: `SeriesPoint.formula` in `site/src/types.ts` re-declares the `'awscli' | 'awscli@1'` union instead of a shared `Formula` type.
- **CSS**: unused `--v1`/`--v2` custom properties in `site/src/index.css` (chart colors are hardcoded in `LagChart.tsx`); wire them up or drop them.
- **recharts**: pinned to `^2` (deprecated; v3 exists) and contributes a ~822 kB bundle-size warning. Fine for a single static page; revisit if the bundle matters.
- **`site` `typecheck` script**: types are already gated via `build` (`tsc --noEmit && vite build`); add a standalone `typecheck` script for parity with `ingest` if desired.
