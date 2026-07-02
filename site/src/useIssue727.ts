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
