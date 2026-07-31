import type { ReactNode } from 'react';
import { Brand } from './brand';
import { ThemeToggle } from './theme-toggle';

export function PublicHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3 md:max-w-5xl md:px-6">
        <Brand />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          {children}
        </div>
      </div>
    </header>
  );
}
