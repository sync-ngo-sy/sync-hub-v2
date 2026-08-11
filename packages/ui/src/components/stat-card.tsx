import { Card, CardContent } from '@sync/ui/components/ui/card';
import { cardSurface } from '@sync/ui/lib/card-surface';
import { TREND_TONE, type TrendTone } from '@sync/ui/lib/trend-tone';
import { cn } from '@sync/ui/lib/utils';
import type { ComponentProps, ReactNode } from 'react';

export function StatCardShell({ className, children, ...props }: ComponentProps<typeof Card>) {
  return (
    <Card className={cn(cardSurface, 'gap-0 py-4', className)} {...props}>
      <CardContent className="flex flex-col gap-2.5 px-[18px]">{children}</CardContent>
    </Card>
  );
}

interface StatCardProps {
  label: string;
  value: ReactNode;
  trend?: { label: string; tone?: TrendTone };
  className?: string;
}

export function StatCard({ label, value, trend, className }: StatCardProps) {
  const { color, icon: TrendIcon } = TREND_TONE[trend?.tone ?? 'neutral'];

  return (
    <StatCardShell className={className}>
      <span className="text-meta text-muted-foreground">{label}</span>
      <span className="font-mono text-figure font-semibold tabular-nums text-foreground">
        {value}
      </span>
      {trend ? (
        <span className={cn('flex items-center gap-1.5 text-xs', color)}>
          {TrendIcon ? <TrendIcon aria-hidden="true" className="size-3.5" /> : null}
          {trend.label}
        </span>
      ) : null}
    </StatCardShell>
  );
}
