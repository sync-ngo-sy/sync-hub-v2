import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { viewsRanked } from '../tracked-link';
import LinkViewsChart from './link-views-chart';

const bars = viewsRanked([
  { id: 'a', name: 'LinkedIn post', views: 342 },
  { id: 'b', name: 'WhatsApp groups', views: 281 },
  { id: 'c', name: 'Direct', views: 190 },
]);

describe('the link views chart', () => {
  it('sizes the container recharts measures, or the chart draws nothing', () => {
    const { container } = render(<LinkViewsChart bars={bars} />);

    const wrapper = container.querySelector<HTMLElement>('.recharts-wrapper');

    expect(wrapper).not.toBeNull();
    expect(Number.parseFloat(wrapper?.style.height ?? '')).toBeGreaterThan(0);
  });

  it('speaks every bar it draws', () => {
    render(<LinkViewsChart bars={bars} />);

    expect(screen.getByRole('img')).toHaveAccessibleName(/LinkedIn post: 342 views/);
  });
});
