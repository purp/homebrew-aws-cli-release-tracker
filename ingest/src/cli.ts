import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { openDb } from './db.js';
import { makeRealGithubClient } from './github.js';
import { runIngest } from './ingest.js';
import { buildDataJson, writeDataJson } from './export.js';

const WINDOW_START = '2020-01-01T00:00:00Z';
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dataDir = resolve(repoRoot, 'data');

async function main() {
  mkdirSync(dataDir, { recursive: true });
  const db = openDb(resolve(dataDir, 'tracker.sqlite'));
  const gh = makeRealGithubClient();

  console.log('Fetching from GitHub…');
  await runIngest(db, gh, { windowStart: WINDOW_START });
  const issue727 = await gh.fetchIssue727();

  const data = buildDataJson(db, { generatedAt: new Date().toISOString(), windowStart: WINDOW_START, issue727 });
  writeDataJson(resolve(dataDir, 'data.json'), data);
  console.log(`Wrote ${data.series.length} shipped releases; #727 is ${data.issue727.state}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
