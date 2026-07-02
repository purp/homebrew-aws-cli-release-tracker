// A tiny inline-SVG sparkline — no axes, no interactivity. Values are log-scaled
// (like the main chart's Y axis) so an occasional spike doesn't flatten the trend.
export function Sparkline({ points, color, label }: { points: number[]; color: string; label: string }) {
  if (points.length < 2) return null;
  const W = 116, H = 34, P = 3;
  const ly = points.map((v) => Math.log(v));
  const min = Math.min(...ly);
  const span = Math.max(...ly) - min || 1;
  const stepX = (W - 2 * P) / (points.length - 1);
  const yAt = (i: number) => H - P - ((ly[i] - min) / span) * (H - 2 * P);
  const d = points
    .map((_, i) => `${i === 0 ? 'M' : 'L'}${(P + i * stepX).toFixed(1)},${yAt(i).toFixed(1)}`)
    .join(' ');
  return (
    <svg className="part__spark" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={label}>
      <path d={d} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
