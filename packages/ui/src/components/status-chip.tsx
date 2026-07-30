import { cn } from '@sync/ui/lib/utils';
import { CircleAlert, CircleX } from 'lucide-react';

/** Every status the two portals put in a chip: application, job, and qualification states. */
export type ChipStatus =
  | 'new'
  | 'reviewing'
  | 'shortlisted'
  | 'interview'
  | 'offer'
  | 'hired'
  | 'rejected'
  | 'withdrawn'
  | 'draft'
  | 'published'
  | 'closed'
  | 'archived'
  | 'pending'
  | 'qualified'
  | 'disqualified'
  | 'review_required';

const POSITIVE = 'bg-accent text-accent-foreground';
const NEUTRAL = 'bg-muted text-secondary-foreground';

const CHIP: Record<ChipStatus, { label: string; tone: string; icon?: typeof CircleX }> = {
  qualified: { label: 'Qualified', tone: POSITIVE },
  published: { label: 'Published', tone: POSITIVE },
  shortlisted: {
    label: 'Shortlisted',
    tone: 'bg-chip-shortlisted text-chip-shortlisted-foreground',
  },
  interview: { label: 'Interview', tone: 'bg-chip-interview text-chip-interview-foreground' },
  offer: { label: 'Offer', tone: 'bg-chip-offer text-chip-offer-foreground' },
  hired: { label: 'Hired', tone: 'bg-chip-hired text-chip-hired-foreground' },
  new: { label: 'New', tone: NEUTRAL },
  reviewing: { label: 'Reviewing', tone: NEUTRAL },
  pending: { label: 'Pending', tone: NEUTRAL },
  draft: { label: 'Draft', tone: NEUTRAL },
  closed: { label: 'Closed', tone: NEUTRAL },
  archived: { label: 'Archived', tone: NEUTRAL },
  withdrawn: { label: 'Withdrawn', tone: NEUTRAL },
  review_required: { label: 'Review required', tone: NEUTRAL, icon: CircleAlert },
  disqualified: { label: 'Disqualified', tone: NEUTRAL, icon: CircleX },
  rejected: { label: 'Rejected', tone: NEUTRAL, icon: CircleX },
};

interface StatusChipProps {
  status: ChipStatus;
  className?: string;
}

export function StatusChip({ status, className }: StatusChipProps) {
  const chip = CHIP[status];
  const Icon = chip.icon;
  return (
    <span
      data-slot="status-chip"
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium',
        chip.tone,
        className,
      )}
    >
      {Icon ? <Icon className="size-3.5 shrink-0" /> : null}
      {chip.label}
    </span>
  );
}
