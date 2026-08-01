import { Card, CardContent, CardDescription, CardHeader } from '@sync/ui/components/ui/card';
import type { ReactNode } from 'react';

export function ProfileSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-h3 text-card-foreground">{title}</h2>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  );
}
