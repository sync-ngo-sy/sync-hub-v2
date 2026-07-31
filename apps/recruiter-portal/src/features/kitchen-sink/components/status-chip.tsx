import { Badge } from '@sync/ui/components/ui/badge';
import { cn } from '@sync/ui/lib/utils';
import { CircleAlert, CircleX } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * The final chip scheme, rendered from tokens: teal deepening toward hired for positive
 * states, gray for everything else — including disqualified and rejected, which carry a
 * circle-x so colour is never the only signal. No red chips anywhere.
 */
const TONES = {
  neutral: 'bg-muted text-muted-foreground',
  qualified: 'bg-accent text-accent-foreground',
  shortlisted: 'bg-chip-shortlisted text-chip-shortlisted-foreground',
  interview: 'bg-chip-interview text-chip-interview-foreground',
  offer: 'bg-chip-offer text-chip-offer-foreground',
  hired: 'bg-chip-hired text-chip-hired-foreground',
} as const;

export type ChipTone = keyof typeof TONES;

export function StatusChip({
  tone = 'neutral',
  icon,
  children,
}: {
  tone?: ChipTone;
  icon?: 'negative' | 'attention';
  children: ReactNode;
}) {
  return (
    <Badge variant="secondary" className={cn(TONES[tone])}>
      {icon === 'negative' ? <CircleX /> : null}
      {icon === 'attention' ? <CircleAlert /> : null}
      {children}
    </Badge>
  );
}
