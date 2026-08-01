import { cn } from '@sync/ui/lib/utils';
import type { ReactNode } from 'react';

/** The small-caps label that opens a landing section. */
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

/** A landing CTA sits between the app's `lg` button and its own type scale. */
export const HERO_BUTTON = 'h-11 px-5.5 text-[0.9375rem]';

export const NAV_BUTTON = 'h-10 px-4 text-dense';

export const UNDERLINE_LINK =
  'border-b border-border pb-0.5 text-[0.9375rem] font-medium text-accent-foreground hover:border-accent-foreground';
