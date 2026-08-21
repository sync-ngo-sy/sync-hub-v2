import { useRender } from '@base-ui/react/use-render';
import { Skeleton } from '@sync/ui/components/ui/skeleton';
import { cardSurface } from '@sync/ui/lib/card-surface';
import { TREND_TONE, type TrendTone } from '@sync/ui/lib/trend-tone';
import { cn } from '@sync/ui/lib/utils';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

type StatBandVariant = 'band' | 'cards';

const BAND =
  'grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border shadow-card md:grid-cols-4';
const BAND_CELL = 'flex flex-col gap-2 bg-card p-(--space-card)';
const CARDS = 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4';
const CARD_CELL = cn(cardSurface, 'flex min-h-27 flex-col gap-1.5 px-[18px] py-4');

export interface StatBandItem {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  trend?: { label: string; tone?: TrendTone };
  render?: useRender.RenderProp;
}

const LINKED_BAND_CELL =
  'outline-none transition-colors hover:bg-interactive-hover focus-visible:ring-3 focus-visible:ring-ring/50';
const LINKED_CARD_CELL =
  'group/stat-cell outline-none focus-visible:ring-3 focus-visible:ring-ring/50';

function Cell({
  item: { label, value, icon: Icon, trend, render },
  variant,
}: {
  item: StatBandItem;
  variant: StatBandVariant;
}) {
  const { color, icon: TrendIcon } = TREND_TONE[trend?.tone ?? 'neutral'];
  const cards = variant === 'cards';

  return useRender({
    defaultTagName: 'div',
    render,
    props: {
      'data-slot': 'stat',
      className: cn(
        cards ? CARD_CELL : BAND_CELL,
        render && (cards ? LINKED_CARD_CELL : LINKED_BAND_CELL),
      ),
      children: (
        <>
          {cards ? (
            <span className="flex items-center justify-between gap-3 text-meta text-muted-foreground">
              <span className="flex min-w-0 items-center gap-1.5 font-medium uppercase tracking-[0.035em]">
                {Icon ? <Icon aria-hidden="true" className="size-3.5 shrink-0" /> : null}
                <span>{label}</span>
              </span>
              {render ? (
                <ArrowUpRight
                  aria-hidden="true"
                  className="size-4 shrink-0 opacity-0 transition-[opacity,transform] group-hover/stat-cell:-translate-y-0.5 group-hover/stat-cell:translate-x-0.5 group-hover/stat-cell:opacity-100 group-focus-visible/stat-cell:opacity-100"
                />
              ) : null}
            </span>
          ) : (
            <span className="text-meta text-muted-foreground">{label}</span>
          )}
          <span className="font-mono text-figure font-semibold tabular-nums text-foreground">
            {value}
          </span>
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
  variant = 'band',
  className,
  ...props
}: { items: StatBandItem[]; variant?: StatBandVariant } & Omit<ComponentProps<'div'>, 'children'>) {
  return (
    <div className={cn(variant === 'cards' ? CARDS : BAND, className)} {...props}>
      {items.map((item) => (
        <Cell key={item.label} item={item} variant={variant} />
      ))}
    </div>
  );
}

export function StatBandSkeleton({
  labels,
  variant = 'band',
}: {
  labels: string[];
  variant?: StatBandVariant;
}) {
  return (
    <div className={variant === 'cards' ? CARDS : BAND} aria-hidden="true">
      {labels.map((label) => (
        <div key={label} data-slot="stat" className={variant === 'cards' ? CARD_CELL : BAND_CELL}>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}
