import { Card, CardContent, CardHeader, CardTitle } from '@sync/ui/components/ui/card';
import type { LucideIcon } from 'lucide-react';
import { type ReactNode, useId } from 'react';

interface ReviewCardProps {
  title: string;
  hint?: string;
  icon?: LucideIcon;
  children: ReactNode;
}

export function ReviewCard({ title, hint, icon: Icon, children }: ReviewCardProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {Icon ? <Icon aria-hidden="true" className="size-4 text-muted-foreground" /> : null}
            <h2 id={headingId}>{title}</h2>
          </CardTitle>
          {hint ? <p className="text-meta text-muted-foreground">{hint}</p> : null}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </section>
  );
}
