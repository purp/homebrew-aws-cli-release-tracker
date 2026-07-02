export interface Summary { mean: number; median: number; p90: number; n: number }

const HOUR_MS = 3600_000;
const DAY_MS = 86_400_000;

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function summarize(values: number[]): Summary {
  if (values.length === 0) return { mean: 0, median: 0, p90: 0, n: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  return { mean, median: quantile(sorted, 0.5), p90: quantile(sorted, 0.9), n: sorted.length };
}

export function hoursBetween(startIso: string, endIso: string): number {
  return (Date.parse(endIso) - Date.parse(startIso)) / HOUR_MS;
}

export function withinWindow(iso: string, nowIso: string, days: number | null): boolean {
  if (days === null) return true;
  return Date.parse(iso) >= Date.parse(nowIso) - days * DAY_MS;
}
