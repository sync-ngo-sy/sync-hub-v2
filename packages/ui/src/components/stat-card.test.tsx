import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatCard } from './stat-card';

describe('StatCard', () => {
  it('renders the label, value, and trend line', () => {
    render(
      <StatCard
        label="Open jobs"
        value={12}
        trend={{ label: '+2 since last week', tone: 'positive' }}
      />,
    );
    expect(screen.getByText('Open jobs')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('+2 since last week')).toBeInTheDocument();
  });

  it('renders without a trend', () => {
    render(<StatCard label="Awaiting review" value={5} />);
    expect(screen.getByText('Awaiting review')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});
