import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
} from '@sync/ui/components/ui/card';
import { cardSurface } from '@sync/ui/lib/card-surface';
import { cn } from '@sync/ui/lib/utils';
import type { ComponentProps, ReactNode } from 'react';

export function ChartCardShell({ className, ...props }: ComponentProps<typeof Card>) {
  return <Card className={cn(cardSurface, className)} {...props} />;
}

interface ChartCardProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ChartCard({ title, description, action, children, className }: ChartCardProps) {
  return (
    <ChartCardShell className={className}>
      <CardHeader>
        <h2 className="font-heading text-title text-foreground">{title}</h2>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </ChartCardShell>
  );
}
