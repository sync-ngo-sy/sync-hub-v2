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
  it('draws each bar as a share of the busiest link', () => {
    const { container } = render(<LinkViewsChart bars={bars} />);

    const widths = [...container.querySelectorAll<HTMLElement>('span[style*="width"]')].map(
      (fill) => fill.style.width,
    );

    expect(widths).toEqual(['100%', `${(281 / 342) * 100}%`, `${(190 / 342) * 100}%`]);
  });

  it('speaks every bar it draws', () => {
    render(<LinkViewsChart bars={bars} />);

    expect(screen.getByRole('img')).toHaveAccessibleName(/LinkedIn post: 342 views/);
  });
});
