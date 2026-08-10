import { factLabel } from '@sync/ui/lib/fact-label';
import { cn } from '@sync/ui/lib/utils';
import type { ReactNode } from 'react';

export interface FactGridItem {
  label: string;
  value: ReactNode;
}

interface FactGridProps {
  label: string;
  facts: FactGridItem[];
}

export function FactGrid({ label, facts }: FactGridProps) {
  if (facts.length === 0) return null;

  return (
    <dl
      aria-label={label}
      className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-px overflow-hidden rounded-lg border border-border bg-border"
    >
      {facts.map((fact) => (
        <div key={fact.label} className="bg-card px-3 py-2.5">
          <dt className={cn(factLabel, 'text-muted-foreground')}>{fact.label}</dt>
          <dd className="mt-1 text-dense text-foreground">{fact.value ?? 'Not provided'}</dd>
        </div>
      ))}
    </dl>
  );
}
