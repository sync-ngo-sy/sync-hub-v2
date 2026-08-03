import { Card, CardContent, CardHeader, CardTitle } from '@sync/ui/components/ui/card';
import { type ReactNode, useId } from 'react';

interface ReviewCardProps {
  title: string;
  hint?: string;
  children: ReactNode;
}

export function ReviewCard({ title, hint, children }: ReviewCardProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId}>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 id={headingId}>{title}</h2>
          </CardTitle>
          {hint ? <p className="text-meta text-muted-foreground">{hint}</p> : null}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </section>
  );
}
