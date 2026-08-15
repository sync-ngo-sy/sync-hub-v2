import { Badge } from '@sync/ui/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader } from '@sync/ui/components/ui/card';
import { type ReactNode, useId } from 'react';
import type { SectionId } from '../places';

export function ProfileSection({
  id,
  title,
  description,
  needed,
  unanswered = false,
  children,
}: {
  id: SectionId;
  title: string;
  description?: string;
  needed?: string;
  unanswered?: boolean;
  children: ReactNode;
}) {
  const headingId = useId();

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      tabIndex={-1}
      className="scroll-mt-24 outline-none"
    >
      <Card className={unanswered ? 'ring-2 ring-destructive/60' : undefined}>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 id={headingId} className="font-heading text-h3 text-card-foreground">
              {title}
            </h2>
            {needed ? (
              <Badge
                variant={unanswered ? 'destructive' : 'outline'}
                className="font-normal text-meta"
              >
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
