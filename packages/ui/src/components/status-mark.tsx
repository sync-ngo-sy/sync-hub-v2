import { cn } from '@sync/ui/lib/utils';
import { CircleAlert, CircleX, type LucideIcon } from 'lucide-react';

export const APPLICATION_STATUS_TONES = [
  'new',
  'reviewing',
  'shortlisted',
  'interview',
  'offer',
  'hired',
  'rejected',
  'withdrawn',
] as const;

export const GENERAL_TONES = ['waiting', 'active', 'attention', 'ended'] as const;

export const STATUS_TONES = [...APPLICATION_STATUS_TONES, ...GENERAL_TONES] as const;

export type ApplicationStatusTone = (typeof APPLICATION_STATUS_TONES)[number];
export type StatusTone = (typeof STATUS_TONES)[number];

const HOLLOW = 'shadow-[inset_0_0_0_2px_currentColor]';
const FILLED = 'bg-current';

interface Mark {
  color: string;
  shape?: string;
  icon?: LucideIcon;
}

const TONE: Record<StatusTone, Mark> = {
  new: { color: 'text-status-new', shape: FILLED },
  reviewing: { color: 'text-status-review', shape: FILLED },
  shortlisted: { color: 'text-status-shortlisted', shape: FILLED },
  interview: { color: 'text-status-interview', shape: FILLED },
  offer: { color: 'text-status-offer', shape: FILLED },
  hired: { color: 'text-status-hired', shape: FILLED },
  rejected: { color: 'text-status-rejected', icon: CircleX },
  withdrawn: { color: 'text-status-withdrawn', icon: CircleX },
  waiting: { color: 'text-muted-foreground', shape: HOLLOW },
  active: { color: 'text-accent-foreground', shape: FILLED },
  attention: { color: 'text-mark-attention', icon: CircleAlert },
  ended: { color: 'text-muted-foreground', icon: CircleX },
};

interface StatusMarkProps {
  tone: StatusTone;
  label: string;
  className?: string;
}

export function StatusMark({ tone, label, className }: StatusMarkProps) {
  const { color, shape, icon: Icon } = TONE[tone];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 whitespace-nowrap text-meta font-status-label text-foreground',
        className,
      )}
    >
      {Icon ? (
        <Icon aria-hidden="true" className={cn('size-[13px] shrink-0', color)} />
      ) : (
        <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-[2px]', color, shape)} />
      )}
      {label}
    </span>
  );
}
