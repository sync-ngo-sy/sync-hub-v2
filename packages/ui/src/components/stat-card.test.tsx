import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatCard } from './stat-card';

describe('StatCard', () => {
  it('shows its label and value', () => {
    render(<StatCard label="Open jobs" value={12} />);

    expect(screen.getByText('Open jobs')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('gives a positive trend an icon, so color is never the only signal', () => {
    const { container } = render(
      <StatCard
        label="Applications this week"
        value={47}
        trend={{ label: '+8 vs last week', tone: 'positive' }}
      />,
    );

    expect(screen.getByText('+8 vs last week')).toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('leaves a worded trend iconless', () => {
    const { container } = render(
      <StatCard
        label="Awaiting review"
        value={23}
        trend={{ label: 'Needs attention', tone: 'caution' }}
      />,
    );

    expect(screen.getByText('Needs attention')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
  });
});
