import { Skeleton } from '@sync/ui/components/ui/skeleton';
import { cn } from '@sync/ui/lib/utils';
import { type LucideIcon, TrendingUp } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

type TrendTone = 'positive' | 'caution' | 'neutral';

const TREND_TONE: Record<TrendTone, { color: string; icon?: LucideIcon }> = {
  positive: { color: 'text-success-foreground', icon: TrendingUp },
  caution: { color: 'text-warning-foreground' },
  neutral: { color: 'text-muted-foreground' },
};

/* The cells are separated by the band's own background showing through a one-pixel grid
   gap, so the hairlines fall wherever the columns happen to wrap — two up on a phone,
   four across on a desktop — without a cell ever having to know which edge it is on. */
const BAND = 'grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border';
const CELL = 'flex flex-col gap-2 bg-card p-(--space-card)';

export interface StatBandItem {
  label: string;
  value: ReactNode;
  trend?: { label: string; tone?: TrendTone };
}

export function StatBand({
  items,
  className,
  ...props
}: { items: StatBandItem[] } & Omit<ComponentProps<'div'>, 'children'>) {
  return (
    <div className={cn(BAND, 'md:grid-cols-4 shadow-card', className)} {...props}>
      {items.map((item) => {
        const { color, icon: TrendIcon } = TREND_TONE[item.trend?.tone ?? 'neutral'];

        return (
          <div key={item.label} className={CELL}>
            <span className="text-meta text-muted-foreground">{item.label}</span>
            <span className="font-heading text-figure tabular-nums text-foreground">
              {item.value}
            </span>
            {item.trend ? (
              <span className={cn('flex items-center gap-1.5 text-xs', color)}>
                {TrendIcon ? <TrendIcon aria-hidden="true" className="size-3.5" /> : null}
                {item.trend.label}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function StatBandSkeleton({ labels }: { labels: string[] }) {
  return (
    <div className={cn(BAND, 'md:grid-cols-4 shadow-card')} aria-hidden="true">
      {labels.map((label) => (
        <div key={label} className={CELL}>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}
