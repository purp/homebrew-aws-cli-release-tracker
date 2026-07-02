const DAY_MS = 86_400_000;

export function formatDuration(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 48) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }
  return `${(hours / 24).toFixed(1)} d`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function daysSince(iso: string, now: number): number {
  return Math.floor(now / DAY_MS) - Math.floor(Date.parse(iso) / DAY_MS);
}
