import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeadlineStats } from '../src/components/HeadlineStats.js';
import type { DataJson, SeriesPoint } from '../src/types.js';

const s = (mean: number) => ({ mean, median: mean, p90: mean, n: 3 });
const w = (base: number) => ({ d30: s(base), d90: s(base + 1), y1: s(base + 2), all: s(base + 3) });
const headline: DataJson['headline'] = {
  totalBottleLag: w(3),
  noticeLatency: w(1),
  bottleBuildLatency: w(2),
};

const pt = (releasedAt: string, noticeH: number, buildH: number): SeriesPoint => ({
  version: '2.0', major: 2, formula: 'awscli',
  releasedAt, formulaAt: releasedAt, bottleAt: releasedAt,
  totalH: noticeH + buildH, noticeH, buildH,
});
const series: SeriesPoint[] = [
  pt('2026-06-01T00:00:00Z', 3, 2),
  pt('2026-06-15T00:00:00Z', 4, 1),
  pt('2026-06-29T00:00:00Z', 2, 3),
];

describe('HeadlineStats', () => {
  it('renders the total and its two nested components', () => {
    render(<HeadlineStats headline={headline} series={series} />);
    expect(screen.getByText(/brew install/i)).toBeInTheDocument();     // total
    expect(screen.getByText(/release → update/i)).toBeInTheDocument(); // notice
    expect(screen.getByText(/update → installable/i)).toBeInTheDocument(); // build
  });

  it('renders a sparkline in each nested component', () => {
    const { container } = render(<HeadlineStats headline={headline} series={series} />);
    expect(container.querySelectorAll('.part__spark')).toHaveLength(2);
  });
});
