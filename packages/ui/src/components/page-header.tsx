import { cn } from '@sync/ui/lib/utils';
import type { ComponentProps, ReactNode } from 'react';

export function PageHeaderShell({
  actions,
  className,
  children,
  ...props
}: ComponentProps<'div'> & { actions?: ReactNode }) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', className)} {...props}>
      <div className="space-y-1">{children}</div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <PageHeaderShell actions={actions} className={className}>
      <h1 className="font-heading text-page-title text-foreground">{title}</h1>
      {description ? (
        <p className="max-w-prose text-dense text-muted-foreground">{description}</p>
      ) : null}
    </PageHeaderShell>
  );
}
