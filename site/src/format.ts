const DAY_MS = 86_400_000;

export function formatDuration(hours: number): string {
  if (hours >= 48) return `${(hours / 24).toFixed(1)} d`;
  const totalMin = Math.round(hours * 60);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function daysSince(iso: string, now: number): number {
  return Math.floor(now / DAY_MS) - Math.floor(Date.parse(iso) / DAY_MS);
}
