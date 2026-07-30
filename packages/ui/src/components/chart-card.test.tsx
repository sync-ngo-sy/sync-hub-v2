import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChartCard } from './chart-card';

describe('ChartCard', () => {
  it('renders a section heading and its chart content', () => {
    render(
      <ChartCard title="Where applicants find you" description="Last 30 days">
        <div>chart goes here</div>
      </ChartCard>,
    );
    expect(
      screen.getByRole('heading', { level: 2, name: 'Where applicants find you' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Last 30 days')).toBeInTheDocument();
    expect(screen.getByText('chart goes here')).toBeInTheDocument();
  });
});
