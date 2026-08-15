import { cn } from '@sync/ui/lib/utils';
import type { ReactNode } from 'react';
import { MEASURE } from '../measure';
import { Brand } from './brand';
import { ThemeToggle } from './theme-toggle';

export function PublicHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="border-b border-border">
      <div
        className={cn(
          'mx-auto flex w-full items-center justify-between gap-3 px-4 py-3 md:px-6',
          MEASURE,
        )}
      >
        <Brand />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          {children}
        </div>
      </div>
    </header>
  );
}
