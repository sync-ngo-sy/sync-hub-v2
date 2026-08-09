import { cn } from '@sync/ui/lib/utils';
import type { ComponentProps } from 'react';

interface WorkspaceHeaderProps extends ComponentProps<'header'> {
  withTabs?: boolean;
}

export function WorkspaceHeader({
  withTabs = false,
  className,
  ...props
}: WorkspaceHeaderProps) {
  return (
    <header
      className={cn(
        '-mx-(--space-gutter) -mt-(--space-section) border-b border-border bg-card px-(--space-gutter) dark:border-sidebar-border dark:bg-sidebar',
        withTabs ? 'pt-5' : 'py-5',
        className,
      )}
      {...props}
    />
  );
}
