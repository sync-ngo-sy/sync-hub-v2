import { Badge } from '@sync/ui/components/ui/badge';
import { cn } from '@sync/ui/lib/utils';
import { CircleAlert, CircleX, type LucideIcon } from 'lucide-react';

export const STATUS_TONES = [
  'positive',
  'shortlisted',
  'interview',
  'offer',
  'hired',
  'neutral',
  'negative',
  'review-required',
] as const;

export type StatusTone = (typeof STATUS_TONES)[number];

/** The founder-revised scheme: teal deepens along the pipeline, everything else is gray, and
 * nothing is red — so the two states a reader must not miss carry an icon instead. */
const TONE: Record<StatusTone, { surface: string; icon?: LucideIcon }> = {
  positive: { surface: 'bg-accent text-accent-foreground' },
  shortlisted: { surface: 'bg-chip-shortlisted text-chip-shortlisted-foreground' },
  interview: { surface: 'bg-chip-interview text-chip-interview-foreground' },
  offer: { surface: 'bg-chip-offer text-chip-offer-foreground' },
  hired: { surface: 'bg-chip-hired text-chip-hired-foreground' },
  neutral: { surface: 'bg-muted text-muted-foreground' },
  negative: { surface: 'bg-muted text-muted-foreground', icon: CircleX },
  'review-required': { surface: 'bg-muted text-muted-foreground', icon: CircleAlert },
};

interface StatusChipProps {
  tone: StatusTone;
  label: string;
  className?: string;
}

export function StatusChip({ tone, label, className }: StatusChipProps) {
  const { surface, icon: Icon } = TONE[tone];

  return (
    <Badge variant="secondary" className={cn(surface, className)}>
      {Icon ? <Icon aria-hidden="true" /> : null}
      {label}
    </Badge>
  );
}
