import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { type ChipStatus, StatusChip } from './status-chip';

/** The approved scheme, transcribed from the design spec — the source of truth for tone. */
const SCHEME: Array<{ status: ChipStatus; label: string; tone: string; icon?: string }> = [
  { status: 'qualified', label: 'Qualified', tone: 'bg-accent' },
  { status: 'published', label: 'Published', tone: 'bg-accent' },
  { status: 'shortlisted', label: 'Shortlisted', tone: 'bg-chip-shortlisted' },
  { status: 'interview', label: 'Interview', tone: 'bg-chip-interview' },
  { status: 'offer', label: 'Offer', tone: 'bg-chip-offer' },
  { status: 'hired', label: 'Hired', tone: 'bg-chip-hired' },
  { status: 'new', label: 'New', tone: 'bg-muted' },
  { status: 'reviewing', label: 'Reviewing', tone: 'bg-muted' },
  { status: 'pending', label: 'Pending', tone: 'bg-muted' },
  { status: 'draft', label: 'Draft', tone: 'bg-muted' },
  { status: 'closed', label: 'Closed', tone: 'bg-muted' },
  { status: 'archived', label: 'Archived', tone: 'bg-muted' },
  { status: 'withdrawn', label: 'Withdrawn', tone: 'bg-muted' },
  {
    status: 'review_required',
    label: 'Review required',
    tone: 'bg-muted',
    icon: 'lucide-circle-alert',
  },
  { status: 'disqualified', label: 'Disqualified', tone: 'bg-muted', icon: 'lucide-circle-x' },
  { status: 'rejected', label: 'Rejected', tone: 'bg-muted', icon: 'lucide-circle-x' },
];

describe('StatusChip', () => {
  it.each(SCHEME)('renders $status as "$label" in its approved tone', ({ status, label, tone }) => {
    const { container } = render(<StatusChip status={status} />);
    const chip = container.querySelector('[data-slot="status-chip"]');
    expect(chip).toHaveTextContent(label);
    expect(chip).toHaveClass(tone);
    expect(chip?.className).not.toMatch(/destructive/);
  });

  it.each(SCHEME)("carries $status's signal as an icon as well as color", ({ status, icon }) => {
    const { container } = render(<StatusChip status={status} />);
    const icons = container.querySelectorAll('svg');
    if (!icon) {
      expect(icons).toHaveLength(0);
      return;
    }
    expect(container.querySelector(`.${icon}`)).toBeInTheDocument();
    expect(icons[0]).toHaveAttribute('aria-hidden', 'true');
  });
});
