import { Button } from '@sync/ui/components/ui/button';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChartCard } from './chart-card';

describe('ChartCard', () => {
  it('heads the card and renders the chart the feature supplied', () => {
    render(
      <ChartCard title="Where applicants find you">
        <img alt="Views per tracked link" src="chart.svg" />
      </ChartCard>,
    );

    expect(
      screen.getByRole('heading', { level: 2, name: 'Where applicants find you' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Views per tracked link' })).toBeInTheDocument();
  });

  it('renders its description and action', () => {
    render(
      <ChartCard
        title="Views per link"
        description="Since each link was minted."
        action={<Button variant="ghost">Manage links</Button>}
      >
        <img alt="Link views" src="chart.svg" />
      </ChartCard>,
    );

    expect(screen.getByText('Since each link was minted.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage links' })).toBeInTheDocument();
  });
});
