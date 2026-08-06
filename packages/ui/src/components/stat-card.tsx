import { Card, CardContent } from '@sync/ui/components/ui/card';
import { cardSurface } from '@sync/ui/lib/card-surface';
import { cn } from '@sync/ui/lib/utils';
import { type LucideIcon, TrendingUp } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

type TrendTone = 'positive' | 'caution' | 'neutral';

const TREND_TONE: Record<TrendTone, { color: string; icon?: LucideIcon }> = {
  positive: { color: 'text-success-foreground', icon: TrendingUp },
  caution: { color: 'text-warning-foreground' },
  neutral: { color: 'text-muted-foreground' },
};

export function StatCardShell({ className, children, ...props }: ComponentProps<typeof Card>) {
  return (
    <Card className={cn(cardSurface, 'gap-0', className)} {...props}>
      <CardContent className="flex flex-col gap-2.5">{children}</CardContent>
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
      <span className="font-heading text-figure tabular-nums text-foreground">{value}</span>
      {trend ? (
        <span className={cn('flex items-center gap-1.5 text-xs', color)}>
          {TrendIcon ? <TrendIcon aria-hidden="true" className="size-3.5" /> : null}
          {trend.label}
        </span>
      ) : null}
    </StatCardShell>
  );
}
