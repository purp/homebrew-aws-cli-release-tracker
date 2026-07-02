import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LagChart } from '../src/components/LagChart.js';
import type { SeriesPoint } from '../src/types.js';

const pt = (version: string, major: number, releasedAt: string, totalH: number): SeriesPoint => ({
  version, major, formula: major === 1 ? 'awscli@1' : 'awscli',
  releasedAt, formulaAt: releasedAt, bottleAt: releasedAt, totalH, noticeH: 1, buildH: 1,
});

describe('LagChart', () => {
  it('renders without crashing given points', () => {
    const series = [pt('2.35.14', 2, '2026-07-01T18:00:00Z', 3), pt('1.45.30', 1, '2026-06-16T18:00:00Z', 5)];
    // ResponsiveContainer needs a size in jsdom; wrap in a sized div
    const { container } = render(<div style={{ width: 600, height: 400 }}><LagChart series={series} /></div>);
    expect(container.querySelector('.recharts-responsive-container')).toBeTruthy();
  });

  it('renders range buttons defaulting to 1y and switches on click', () => {
    const series = [pt('2.35.14', 2, '2026-07-01T18:00:00Z', 3)];
    render(<div style={{ width: 600, height: 400 }}><LagChart series={series} /></div>);
    const oneYear = screen.getByRole('button', { name: '1y' });
    const thirty = screen.getByRole('button', { name: '30d' });
    expect(oneYear).toHaveAttribute('aria-pressed', 'true');
    expect(thirty).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(thirty);
    expect(thirty).toHaveAttribute('aria-pressed', 'true');
    expect(oneYear).toHaveAttribute('aria-pressed', 'false');
  });
});
