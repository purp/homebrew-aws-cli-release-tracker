import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeadlineStats } from '../src/components/HeadlineStats.js';
import type { DataJson } from '../src/types.js';

const s = (mean: number) => ({ mean, median: mean, p90: mean, n: 3 });
const w = (base: number) => ({ d30: s(base), d90: s(base + 1), y1: s(base + 2), all: s(base + 3) });
const headline: DataJson['headline'] = {
  totalBottleLag: w(3),
  noticeLatency: w(1),
  bottleBuildLatency: w(2),
};

describe('HeadlineStats', () => {
  it('renders the total and its two nested components', () => {
    render(<HeadlineStats headline={headline} />);
    expect(screen.getByText(/brew install/i)).toBeInTheDocument();     // total
    expect(screen.getByText(/release → update/i)).toBeInTheDocument(); // notice
    expect(screen.getByText(/update → installable/i)).toBeInTheDocument(); // build
  });
});
