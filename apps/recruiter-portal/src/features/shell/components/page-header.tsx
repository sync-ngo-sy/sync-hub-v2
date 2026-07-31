import type { ReactNode } from 'react';

export function PageHeader({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="font-heading text-[26px] font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      {subtitle ? <p className="mt-1 text-dense text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}
