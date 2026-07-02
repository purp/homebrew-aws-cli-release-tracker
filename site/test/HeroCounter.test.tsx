import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeroCounter } from '../src/components/HeroCounter.js';

describe('HeroCounter', () => {
  it('renders a days-open count and open status', () => {
    render(<HeroCounter issue727={{ state: 'open', createdAt: '2014-03-29T22:32:43Z', closedAt: null, url: 'u' }} />);
    expect(screen.getByText(/days/i)).toBeInTheDocument();
    expect(screen.getByText(/still open/i)).toBeInTheDocument();
  });
  it('celebrates a closed issue', () => {
    render(<HeroCounter issue727={{ state: 'closed', createdAt: '2014-03-29T22:32:43Z', closedAt: '2027-01-01T00:00:00Z', url: 'u' }} />);
    expect(screen.getByText(/closed/i)).toBeInTheDocument();
  });
});
