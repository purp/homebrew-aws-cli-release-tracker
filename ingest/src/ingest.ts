import { type AppDb, upsertAwscliRelease, upsertHomebrewFormula, upsertHomebrewBottle, getMeta, setMeta } from './db.js';
import { type GithubClient } from './github.js';
import { parseHomebrewCommit, type Formula } from './parse.js';

const FORMULAS: Formula[] = ['awscli', 'awscli@1'];

export async function runIngest(db: AppDb, gh: GithubClient, opts: { windowStart: string }): Promise<void> {
  const tags = await gh.fetchAwscliTags(opts.windowStart);
  for (const t of tags) {
    upsertAwscliRelease(db, { version: t.version, major: t.major, tagName: t.tagName, commitSha: t.commitSha, releasedAt: t.releasedAt });
  }

  for (const formula of FORMULAS) {
    const cursorKey = `cursor:${formula}`;
    const stopAtSha = getMeta(db, cursorKey);
    const { commits, currentHeadSha } = await gh.fetchFormulaCommits(formula, { sinceIso: opts.windowStart, stopAtSha });
    for (const c of commits) {
      const parsed = parseHomebrewCommit(c.message);
      if (!parsed || parsed.formula !== formula) continue;
      if (parsed.kind === 'formula') {
        upsertHomebrewFormula(db, { formula, version: parsed.version, commitSha: c.sha, at: c.date });
      } else {
        upsertHomebrewBottle(db, { formula, version: parsed.version, commitSha: c.sha, at: c.date });
      }
    }
    if (currentHeadSha) setMeta(db, cursorKey, currentHeadSha);
  }
}
