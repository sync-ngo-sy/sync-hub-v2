import { Badge } from '@sync/ui/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader } from '@sync/ui/components/ui/card';
import { type ReactNode, useId } from 'react';

export function ProfileSection({
  title,
  description,
  needed,
  children,
}: {
  title: string;
  description?: string;
  needed?: string;
  children: ReactNode;
}) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId}>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 id={headingId} className="font-heading text-h3 text-card-foreground">
              {title}
            </h2>
            {needed ? (
              <Badge variant="outline" className="font-normal text-meta">
                {needed}
              </Badge>
            ) : null}
          </div>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent className="space-y-5">{children}</CardContent>
      </Card>
    </section>
  );
}
