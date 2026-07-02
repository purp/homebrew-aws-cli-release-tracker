import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecentTable } from '../src/components/RecentTable.js';
import type { SeriesPoint } from '../src/types.js';

const recent: SeriesPoint[] = [
  { version: '2.35.14', major: 2, formula: 'awscli', releasedAt: '2026-07-01T18:00:00Z', formulaAt: '2026-07-01T20:00:00Z', bottleAt: '2026-07-01T21:00:00Z', noticeH: 2, buildH: 1, totalH: 3 },
  { version: '2.35.13', major: 2, formula: 'awscli', releasedAt: '2026-06-30T18:00:00Z', formulaAt: '2026-06-30T20:00:00Z', bottleAt: null, noticeH: 2, buildH: null, totalH: null },
];

describe('RecentTable', () => {
  it('renders rows and dashes for pending bottles', () => {
    render(<RecentTable recent={recent} />);
    expect(screen.getByText('2.35.14')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
