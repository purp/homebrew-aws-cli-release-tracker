import { describe, it, expect } from 'vitest';
import { makeGithubClient, formulaPath, type HbCommit } from '../src/github.js';

const TAGS_PAGE_1 = {
  repository: { refs: {
    pageInfo: { hasNextPage: true, endCursor: 'C1' },
    nodes: [
      { name: '2.35.14', target: { __typename: 'Commit', oid: 'c14', committedDate: '2026-07-01T18:00:00Z' } },
      { name: '1.45.30', target: { __typename: 'Commit', oid: 'v45', committedDate: '2026-06-16T20:00:00Z' } },
      { name: '2.0.0', target: { __typename: 'Tag', target: { oid: 'c200', committedDate: '2020-02-10T00:00:00Z' } } },
    ],
  } },
};
const TAGS_PAGE_2 = {
  repository: { refs: {
    pageInfo: { hasNextPage: true, endCursor: 'C2' },
    nodes: [
      { name: '1.17.0', target: { __typename: 'Commit', oid: 'old', committedDate: '2019-12-01T00:00:00Z' } },
    ],
  } },
};

describe('fetchAwscliTags', () => {
  it('filters to window + majors 1/2 and stops paging when older than window', async () => {
    const pages = [TAGS_PAGE_1, TAGS_PAGE_2];
    let calls = 0;
    const gh = makeGithubClient({
      graphql: async () => pages[calls++],
      commitsPage: async () => [],
      issue727: async () => ({ state: 'open', createdAt: 'x', closedAt: null, url: 'u' }),
    });
    const tags = await gh.fetchAwscliTags('2020-01-01T00:00:00Z');
    expect(tags.map((t) => t.version)).toEqual(['2.35.14', '1.45.30', '2.0.0']);
    expect(tags[0]).toMatchObject({ major: 2, commitSha: 'c14', releasedAt: '2026-07-01T18:00:00Z' });
    expect(tags[2]).toMatchObject({ major: 2, commitSha: 'c200' }); // annotated tag resolved
    expect(calls).toBe(2); // stopped after the page that dropped below the window
  });
});

describe('fetchFormulaCommits', () => {
  const page1: HbCommit[] = [
    { sha: 'b1', date: '2026-07-01T21:38:00Z', message: 'awscli: update 2.35.14 bottle.' },
    { sha: 'f1', date: '2026-07-01T20:28:00Z', message: 'awscli 2.35.14' },
  ];
  const page2: HbCommit[] = [
    { sha: 'old', date: '2019-11-01T00:00:00Z', message: 'awscli 1.16.0' },
  ];
  it('stops at the cursor sha', async () => {
    const gh = makeGithubClient({
      graphql: async () => ({}),
      commitsPage: async (_p, page) => (page === 1 ? page1 : []),
      issue727: async () => ({ state: 'open', createdAt: 'x', closedAt: null, url: 'u' }),
    });
    const out = await gh.fetchFormulaCommits('awscli', { sinceIso: '2020-01-01T00:00:00Z', stopAtSha: 'f1' });
    expect(out.map((c) => c.sha)).toEqual(['b1']); // stops before f1
  });
  it('stops at the window boundary', async () => {
    const gh = makeGithubClient({
      graphql: async () => ({}),
      commitsPage: async (_p, page) => (page === 1 ? page1 : page === 2 ? page2 : []),
      issue727: async () => ({ state: 'open', createdAt: 'x', closedAt: null, url: 'u' }),
    });
    const out = await gh.fetchFormulaCommits('awscli', { sinceIso: '2020-01-01T00:00:00Z' });
    expect(out.map((c) => c.sha)).toEqual(['b1', 'f1']); // 'old' is pre-window, dropped
  });
});

describe('formulaPath', () => {
  it('maps formula to file path', () => {
    expect(formulaPath('awscli')).toBe('Formula/a/awscli.rb');
    expect(formulaPath('awscli@1')).toBe('Formula/a/awscli@1.rb');
  });
});
