import { Card, CardContent, CardDescription, CardHeader } from '@sync/ui/components/ui/card';
import type { ReactNode } from 'react';

interface SectionCardProps {
  title: string;
  description: string;
  className?: string;
  children: ReactNode;
}

export function SectionCard({ title, description, className, children }: SectionCardProps) {
  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-h3 text-card-foreground">{title}</h2>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className={className}>{children}</CardContent>
    </Card>
  );
}
