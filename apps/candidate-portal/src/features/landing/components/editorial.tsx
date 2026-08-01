import { cn } from '@sync/ui/lib/utils';
import type { ReactNode } from 'react';

export function Wrap({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-[1120px] px-7', className)}>{children}</div>;
}

export function Eyebrow({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <p
      className={cn(
        'text-[0.75rem] font-medium tracking-[0.14em] text-muted-foreground uppercase',
        className,
      )}
    >
      {children}
    </p>
  );
}

export const HERO_BUTTON = 'h-11 px-5.5 text-[0.9375rem]';

export const NAV_BUTTON = 'h-10 px-4 text-dense';

export const UNDERLINE_LINK =
  'border-b border-border pb-0.5 text-[0.9375rem] font-medium text-accent-foreground hover:border-accent-foreground';

export const INDEX_ROW =
  'flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b border-border px-0.5 py-5 sm:py-6';
