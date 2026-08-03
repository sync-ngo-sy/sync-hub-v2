import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from '@sync/ui/components/ui/card';
import { cardSurface } from '@sync/ui/lib/card-surface';
import { type ReactNode, useId } from 'react';

interface DashboardPanelProps {
  title: string;
  description?: string;
  action?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

/** One card on the Dashboard, named so a reader — and a screen reader — can tell the panels
 * apart. Every panel on this page wears the same register, the slots included. */
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
      <Card className={cardSurface}>
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
      </Card>
    </section>
  );
}
