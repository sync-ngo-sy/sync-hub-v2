import { cn } from '@sync/ui/lib/utils';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  /** Decorative lucide icon; the title carries the meaning, so it is hidden from AT. */
  icon?: ReactNode;
  title: string;
  description?: string;
  /** The single obvious next action, usually a Button. */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center',
        className,
      )}
    >
      {icon ? (
        <span aria-hidden className="text-muted-foreground [&_svg]:size-6">
          {icon}
        </span>
      ) : null}
      <div className="space-y-1">
        <p className="font-heading text-base font-medium text-foreground">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
