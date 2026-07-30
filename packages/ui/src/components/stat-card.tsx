import { Card, CardContent } from '@sync/ui/components/ui/card';
import { cn } from '@sync/ui/lib/utils';
import type { ComponentProps, ReactNode } from 'react';

type TrendTone = 'positive' | 'caution' | 'neutral';

const TREND_COLOR: Record<TrendTone, string> = {
  positive: 'text-success-foreground',
  caution: 'text-warning-foreground',
  neutral: 'text-muted-foreground',
};

/** The card shell every stat (and its loading skeleton) shares, so their spacing stays in step. */
export function StatCardShell({ className, children, ...props }: ComponentProps<typeof Card>) {
  return (
    <Card className={cn('gap-0', className)} {...props}>
      <CardContent className="flex flex-col gap-2.5">{children}</CardContent>
    </Card>
  );
}

interface StatCardProps {
  label: string;
  value: ReactNode;
  /** Optional supporting line (e.g. "+2 since last week"); its color follows `tone`. */
  trend?: { label: string; tone?: TrendTone; icon?: ReactNode };
  className?: string;
}

export function StatCard({ label, value, trend, className }: StatCardProps) {
  return (
    <StatCardShell className={className}>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="font-heading text-3xl font-semibold leading-none tracking-tight tabular-nums text-foreground">
        {value}
      </span>
      {trend ? (
        <span
          className={cn(
            'flex items-center gap-1.5 text-xs [&_svg]:size-3.5',
            TREND_COLOR[trend.tone ?? 'neutral'],
          )}
        >
          {trend.icon ? <span aria-hidden>{trend.icon}</span> : null}
          {trend.label}
        </span>
      ) : null}
    </StatCardShell>
  );
}
