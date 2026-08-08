import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  APPLICATION_STATUS_TONES,
  GENERAL_TONES,
  STATUS_TONES,
  StatusMark,
  type StatusTone,
} from './status-mark';

const RING = 'shadow-[inset_0_0_0_2px_currentColor]';
const FILLED = 'bg-current';

const PROGRESSING: StatusTone[] = ['reviewing', 'shortlisted', 'interview', 'offer', 'hired'];
const ENDED: StatusTone[] = ['rejected', 'withdrawn'];

function markFor(label: string) {
  return screen.getByText(label);
}

function dotOf(label: string) {
  return markFor(label).querySelector('span[aria-hidden="true"]');
}

function iconOf(label: string) {
  return markFor(label).querySelector('svg');
}

describe('StatusMark', () => {
  it('says every status in words', () => {
    for (const tone of STATUS_TONES) {
      const { unmount } = render(<StatusMark tone={tone} label={`Filed as ${tone}`} />);

      expect(markFor(`Filed as ${tone}`)).toBeInTheDocument();
      unmount();
    }
  });

  it('leaves the New mark hollow, because nothing has happened yet', () => {
    render(<StatusMark tone="new" label="New" />);

    expect(dotOf('New')).toHaveClass(RING);
    expect(dotOf('New')).not.toHaveClass(FILLED);
  });

  it('fills the mark once the application starts moving', () => {
    for (const tone of PROGRESSING) {
      const { unmount } = render(<StatusMark tone={tone} label={tone} />);

      expect(dotOf(tone)).toHaveClass(FILLED);
      unmount();
    }
  });

  it('ends Rejected and Withdrawn with a circle-x instead of a dot', () => {
    for (const tone of ENDED) {
      const { unmount } = render(<StatusMark tone={tone} label={tone} />);

      expect(iconOf(tone)).toHaveClass('lucide-circle-x');
      expect(iconOf(tone)).toHaveAttribute('aria-hidden', 'true');
      expect(dotOf(tone)).toBeNull();
      unmount();
    }
  });

  it('gives each application status its own status token', () => {
    const painted = APPLICATION_STATUS_TONES.map((tone) => {
      const { unmount } = render(<StatusMark tone={tone} label={tone} />);
      const mark = iconOf(tone) ?? dotOf(tone);
      const token = [...(mark?.classList ?? [])].find((name) => name.startsWith('text-status-'));
      unmount();
      return token;
    });

    expect(painted).toEqual([
      'text-status-new',
      'text-status-review',
      'text-status-shortlisted',
      'text-status-interview',
      'text-status-offer',
      'text-status-hired',
      'text-status-rejected',
      'text-status-withdrawn',
    ]);
  });

  it('keeps the status tokens off everything that is not an application status', () => {
    for (const tone of GENERAL_TONES) {
      const { container, unmount } = render(<StatusMark tone={tone} label={tone} />);

      expect(container.innerHTML).not.toContain('text-status-');
      unmount();
    }
  });

  it('marks a general-purpose state by shape, not by a fourth hue', () => {
    render(
      <>
        <StatusMark tone="waiting" label="Draft" />
        <StatusMark tone="active" label="Published" />
        <StatusMark tone="attention" label="Review required" />
        <StatusMark tone="ended" label="Closed" />
      </>,
    );

    expect(dotOf('Draft')).toHaveClass(RING);
    expect(dotOf('Published')).toHaveClass(FILLED);
    expect(iconOf('Review required')).toHaveClass('lucide-circle-alert');
    expect(iconOf('Closed')).toHaveClass('lucide-circle-x');
  });

  it('paints no status mark in the destructive red', () => {
    for (const tone of STATUS_TONES) {
      const { container, unmount } = render(<StatusMark tone={tone} label={tone} />);

      expect(container.innerHTML).not.toContain('destructive');
      unmount();
    }
  });
});
