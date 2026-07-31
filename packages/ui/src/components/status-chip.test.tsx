import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { STATUS_TONES, StatusChip, type StatusTone } from './status-chip';

const TEAL: StatusTone[] = ['positive', 'shortlisted', 'interview', 'offer', 'hired'];

function chipFor(label: string) {
  return screen.getByText(label);
}

/** Every rule that can paint the chip, in either theme — only the vendored primitive's
 * `aria-invalid:` styling is out of scope, being a state a chip never enters. */
function paintClasses(label: string) {
  return chipFor(label)
    .className.split(/\s+/)
    .filter((token) => !token.includes('aria-invalid:'));
}

describe('StatusChip', () => {
  it('says the status in words', () => {
    render(<StatusChip tone="shortlisted" label="Shortlisted" />);

    expect(chipFor('Shortlisted')).toBeInTheDocument();
  });

  it('deepens the teal ramp toward hired', () => {
    const { rerender } = render(<StatusChip tone="shortlisted" label="Shortlisted" />);
    expect(chipFor('Shortlisted')).toHaveClass('bg-chip-shortlisted');

    rerender(<StatusChip tone="interview" label="Interview" />);
    expect(chipFor('Interview')).toHaveClass('bg-chip-interview');

    rerender(<StatusChip tone="offer" label="Offer" />);
    expect(chipFor('Offer')).toHaveClass('bg-chip-offer');

    rerender(<StatusChip tone="hired" label="Hired" />);
    expect(chipFor('Hired')).toHaveClass('bg-chip-hired');
  });

  it('marks a rejection with a circle-x on gray, never a red chip', () => {
    const { container } = render(<StatusChip tone="negative" label="Rejected" />);

    expect(container.querySelector('.lucide-circle-x')).toHaveAttribute('aria-hidden', 'true');
    expect(chipFor('Rejected')).toHaveClass('bg-muted');
  });

  it('marks review-required with a circle-alert', () => {
    const { container } = render(<StatusChip tone="review-required" label="Review required" />);

    expect(container.querySelector('.lucide-circle-alert')).toHaveAttribute('aria-hidden', 'true');
    expect(chipFor('Review required')).toHaveClass('bg-muted');
  });

  it('leaves the teal ramp iconless, since teal alone already reads as progress', () => {
    for (const tone of TEAL) {
      const { container, unmount } = render(<StatusChip tone={tone} label={tone} />);

      expect(container.querySelector('svg')).toBeNull();
      unmount();
    }
  });

  it('paints no status chip in the destructive red', () => {
    for (const tone of STATUS_TONES) {
      const { unmount } = render(<StatusChip tone={tone} label={tone} />);

      expect(paintClasses(tone).filter((token) => token.includes('destructive'))).toEqual([]);
      unmount();
    }
  });
});
