import { cn } from '@sync/ui/lib/utils';
import type { ReactNode } from 'react';

export function Wrap({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('mx-auto w-full max-w-[1120px] px-6 sm:px-8 lg:px-10', className)}>
      {children}
    </div>
  );
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

export const NAV_BUTTON = 'h-10 px-4 text-dense';

export const HERO_BUTTON = 'h-11 px-5.5 text-[0.9375rem]';

export const UNDERLINE_LINK =
  'border-b border-border pb-0.5 text-[0.9375rem] font-medium text-accent-foreground hover:border-accent-foreground';

/** The landing's whole motion budget: one entrance, and the browser sits it out for a reader who
 * asked for less. */
export const RISE =
  'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 motion-safe:fill-mode-both';
