import { execFileSync } from 'node:child_process';
import { Octokit } from 'octokit';
import { majorOf, type Formula } from './parse.js';

export interface AwscliTag { version: string; major: number; tagName: string; commitSha: string; releasedAt: string }
export interface HbCommit { sha: string; date: string; message: string }
export interface Issue727Data { state: 'open' | 'closed'; createdAt: string; closedAt: string | null; url: string }

export type GraphqlFn = (query: string, vars: Record<string, unknown>) => Promise<any>;
export type CommitsPageFn = (path: string, page: number) => Promise<HbCommit[]>;
export type Issue727Fn = () => Promise<Issue727Data>;

export interface GithubClient {
  fetchAwscliTags(sinceIso: string): Promise<AwscliTag[]>;
  fetchFormulaCommits(formula: Formula, opts: { sinceIso: string; stopAtSha?: string }): Promise<HbCommit[]>;
  fetchIssue727(): Promise<Issue727Data>;
}

export function formulaPath(formula: Formula): string {
  return `Formula/a/${formula}.rb`;
}

export function formulaPaths(formula: Formula): string[] {
  return [formulaPath(formula), `Formula/${formula}.rb`];
}

const TAGS_QUERY = `
  query($cursor: String) {
    repository(owner: "aws", name: "aws-cli") {
      refs(refPrefix: "refs/tags/", first: 100, after: $cursor,
           orderBy: { field: TAG_COMMIT_DATE, direction: DESC }) {
        pageInfo { hasNextPage endCursor }
        nodes {
          name
          target {
            __typename
            ... on Commit { oid committedDate }
            ... on Tag { target { ... on Commit { oid committedDate } } }
          }
        }
      }
    }
  }`;

function resolveTarget(target: any): { oid: string; committedDate: string } | null {
  if (!target) return null;
  if (target.__typename === 'Commit') return { oid: target.oid, committedDate: target.committedDate };
  if (target.__typename === 'Tag' && target.target) return { oid: target.target.oid, committedDate: target.target.committedDate };
  return null;
}

export function makeGithubClient(deps: { graphql: GraphqlFn; commitsPage: CommitsPageFn; issue727: Issue727Fn }): GithubClient {
  return {
    async fetchAwscliTags(sinceIso: string): Promise<AwscliTag[]> {
      const since = Date.parse(sinceIso);
      const out: AwscliTag[] = [];
      let cursor: string | null = null;
      for (;;) {
        const data = await deps.graphql(TAGS_QUERY, { cursor });
        const refs = data.repository.refs;
        let anyInWindow = false;
        for (const node of refs.nodes) {
          if (!/^\d+\.\d+/.test(node.name)) continue;
          const major = majorOf(node.name);
          if (major !== 1 && major !== 2) continue;
          const t = resolveTarget(node.target);
          if (!t) continue;
          if (Date.parse(t.committedDate) < since) continue;
          anyInWindow = true;
          out.push({ version: node.name, major, tagName: node.name, commitSha: t.oid, releasedAt: t.committedDate });
        }
        if (!refs.pageInfo.hasNextPage || !anyInWindow) break;
        cursor = refs.pageInfo.endCursor;
      }
      return out;
    },

    async fetchFormulaCommits(formula, opts): Promise<HbCommit[]> {
      const since = Date.parse(opts.sinceIso);
      const out: HbCommit[] = [];
      const paths = formulaPaths(formula);
      for (let i = 0; i < paths.length; i++) {
        const path = paths[i];
        const stopAtSha = i === 0 ? opts.stopAtSha : undefined;
        for (let page = 1; ; page++) {
          const commits = await deps.commitsPage(path, page);
          if (commits.length === 0) break;
          let stop = false;
          for (const c of commits) {
            if (stopAtSha && c.sha === stopAtSha) { stop = true; break; }
            if (Date.parse(c.date) < since) { stop = true; break; }
            out.push(c);
          }
          if (stop) break;
        }
      }
      return out;
    },

    fetchIssue727: deps.issue727,
  };
}

function resolveToken(): string | undefined {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
  } catch {
    return undefined;
  }
}

export function makeRealGithubClient(): GithubClient {
  const octokit = new Octokit({ auth: resolveToken() });
  return makeGithubClient({
    graphql: (query, vars) => octokit.graphql(query, vars),
    commitsPage: async (path, page) => {
      const res = await octokit.rest.repos.listCommits({
        owner: 'Homebrew', repo: 'homebrew-core', path, per_page: 100, page,
      });
      return res.data.map((c) => ({ sha: c.sha, date: c.commit.committer!.date!, message: c.commit.message }));
    },
    issue727: async () => {
      const res = await octokit.rest.issues.get({ owner: 'aws', repo: 'aws-cli', issue_number: 727 });
      return {
        state: res.data.state === 'closed' ? 'closed' : 'open',
        createdAt: res.data.created_at,
        closedAt: res.data.closed_at ?? null,
        url: res.data.html_url,
      };
    },
  });
}
