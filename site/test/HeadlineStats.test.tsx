import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeadlineStats } from '../src/components/HeadlineStats.js';
import type { DataJson } from '../src/types.js';

const s = (mean: number) => ({ mean, median: mean, p90: mean, n: 3 });
const headline: DataJson['headline'] = {
  totalBottleLag: { d30: s(3), d90: s(4), y1: s(5), all: s(6) },
  noticeLatency: { y1: s(1), all: s(2) },
  bottleBuildLatency: { y1: s(1.5), all: s(2.5) },
};

describe('HeadlineStats', () => {
  it('renders all three headline labels', () => {
    render(<HeadlineStats headline={headline} />);
    expect(screen.getByText(/time to installable bottle/i)).toBeInTheDocument();
    expect(screen.getByText(/homebrew noticed/i)).toBeInTheDocument();
    expect(screen.getByText(/bottle build/i)).toBeInTheDocument();
  });
});
