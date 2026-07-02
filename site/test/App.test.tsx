import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '../src/App.js';

describe('App', () => {
  it('renders the hero and section headings from committed data', () => {
    render(<App />);
    expect(screen.getByRole('link', { name: '#727' })).toBeInTheDocument();
    expect(screen.getByText(/installable Homebrew bottle/i)).toBeInTheDocument();
    expect(screen.getByText(/Recent releases/i)).toBeInTheDocument();
  });
});
