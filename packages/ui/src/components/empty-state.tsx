import { cn } from '@sync/ui/lib/utils';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  message: string;
  action: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, message, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center',
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-6 text-muted-foreground" />
      <p className="max-w-sm text-dense text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}
