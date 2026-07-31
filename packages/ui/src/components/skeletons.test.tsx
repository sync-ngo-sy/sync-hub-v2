import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  ChartCardSkeleton,
  ListSkeleton,
  PageHeaderSkeleton,
  SkeletonText,
  StatCardSkeleton,
} from './skeletons';

function bars(container: HTMLElement) {
  return container.querySelectorAll('[data-slot="skeleton"]');
}

describe('the layout-matching skeletons', () => {
  it('gives SkeletonText one placeholder per line', () => {
    const { container } = render(<SkeletonText lines={2} />);

    expect(bars(container)).toHaveLength(2);
  });

  it('gives ListSkeleton one group of placeholders per row', () => {
    const { container } = render(<ListSkeleton rows={3} />);

    expect(bars(container)).toHaveLength(9);
  });

  it('stays out of the accessibility tree, since a placeholder says nothing', () => {
    for (const skeleton of [
      <PageHeaderSkeleton key="header" />,
      <StatCardSkeleton key="stat" />,
      <ChartCardSkeleton key="card" />,
      <ListSkeleton key="list" />,
      <SkeletonText key="text" />,
    ]) {
      const { container } = render(skeleton);

      expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    }
  });
});
