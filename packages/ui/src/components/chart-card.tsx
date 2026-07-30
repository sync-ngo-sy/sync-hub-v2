import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
} from '@sync/ui/components/ui/card';
import type { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  description?: string;
  action?: ReactNode;
  /** The chart itself — its data lives in the consuming feature, never here (ADR-0009). */
  children: ReactNode;
  className?: string;
}

export function ChartCard({ title, description, action, children, className }: ChartCardProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <h2 className="font-heading text-base font-medium leading-snug">{title}</h2>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
