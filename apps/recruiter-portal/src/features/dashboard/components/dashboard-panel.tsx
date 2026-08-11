import { ChartCardShell } from '@sync/ui/components/chart-card';
import { CardContent, CardDescription, CardFooter, CardHeader } from '@sync/ui/components/ui/card';
import { type ReactNode, useId } from 'react';

interface DashboardPanelProps {
  title: string;
  description?: string;
  action?: ReactNode;
  footer?: ReactNode;
  flush?: boolean;
  children: ReactNode;
}

export function DashboardPanel({
  title,
  description,
  action,
  footer,
  flush = false,
  children,
}: DashboardPanelProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId}>
      <ChartCardShell>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <h2 id={headingId} className="font-heading text-title text-foreground">
              {title}
            </h2>
            {action ? <span className="shrink-0">{action}</span> : null}
          </div>
          {description ? (
            <CardDescription className="text-meta">{description}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className={flush ? 'px-0' : undefined}>{children}</CardContent>
        {footer ? (
          <CardFooter className="text-meta text-muted-foreground">{footer}</CardFooter>
        ) : null}
      </ChartCardShell>
    </section>
  );
}
