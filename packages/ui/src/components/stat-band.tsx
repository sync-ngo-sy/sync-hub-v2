import { useRender } from '@base-ui/react/use-render';
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
  render?: useRender.RenderProp;
}

/* `accent` rather than `muted`, which is a translucent near-black: over the cream card in light
   theme that reads as a grey smudge, where the tint reads as the cell lighting up. */
const LINKED_CELL =
  'outline-none transition-colors hover:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50';

function Cell({ label, value, trend, render }: StatBandItem) {
  const { color, icon: TrendIcon } = TREND_TONE[trend?.tone ?? 'neutral'];

  return useRender({
    defaultTagName: 'div',
    render,
    props: {
      className: cn(CELL, render && LINKED_CELL),
      children: (
        <>
          <span className="text-meta text-muted-foreground">{label}</span>
          <span className="font-heading text-figure tabular-nums text-foreground">{value}</span>
          {trend ? (
            <span className={cn('flex items-center gap-1.5 text-xs', color)}>
              {TrendIcon ? <TrendIcon aria-hidden="true" className="size-3.5" /> : null}
              {trend.label}
            </span>
          ) : null}
        </>
      ),
    },
  });
}

export function StatBand({
  items,
  className,
  ...props
}: { items: StatBandItem[] } & Omit<ComponentProps<'div'>, 'children'>) {
  return (
    <div className={cn(BAND, 'md:grid-cols-4 shadow-card', className)} {...props}>
      {items.map((item) => (
        <Cell key={item.label} {...item} />
      ))}
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
