import { ChartCardShell } from '@sync/ui/components/chart-card';
import {
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from '@sync/ui/components/ui/card';
import { type ReactNode, useId } from 'react';

interface DashboardPanelProps {
  title: string;
  description?: string;
  action?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export function DashboardPanel({
  title,
  description,
  action,
  footer,
  children,
}: DashboardPanelProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId}>
      <ChartCardShell>
        <CardHeader>
          <h2 id={headingId} className="font-heading text-title text-foreground">
            {title}
          </h2>
          {description ? (
            <CardDescription className="text-meta">{description}</CardDescription>
          ) : null}
          {action ? <CardAction>{action}</CardAction> : null}
        </CardHeader>
        <CardContent>{children}</CardContent>
        {footer ? (
          <CardFooter className="text-meta text-muted-foreground">{footer}</CardFooter>
        ) : null}
      </ChartCardShell>
    </section>
  );
}
