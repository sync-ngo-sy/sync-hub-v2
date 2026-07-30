import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CardSkeleton, SkeletonText, StatCardSkeleton } from './skeletons';

describe('skeletons', () => {
  it('renders the requested number of placeholder lines', () => {
    const { container } = render(<SkeletonText lines={4} />);
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(4);
  });

  it('renders a stat-card placeholder hidden from assistive technology', () => {
    const { container } = render(<StatCardSkeleton />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3);
  });

  it('is hidden from assistive technology', () => {
    const { container } = render(<CardSkeleton />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });
});
