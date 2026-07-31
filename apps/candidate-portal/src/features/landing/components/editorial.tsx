import { cn } from '@sync/ui/lib/utils';
import type { ReactNode } from 'react';

/** The mockup's 1120px measure and its 28px gutters. Every band on the landing sits in one. */
export function Wrap({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-[1120px] px-7', className)}>{children}</div>;
}

/** The uppercase hairline label standing over the hero and the steps. */
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

/** A marketing CTA has to invite; the app chrome's dense buttons read as controls. */
export const HERO_BUTTON = 'h-11 px-5.5 text-[0.9375rem]';

export const NAV_BUTTON = 'h-9 px-4 text-dense';

/** The quiet second CTA: teal on a hairline that darkens under the pointer. */
export const UNDERLINE_LINK =
  'border-b border-border pb-0.5 text-[0.9375rem] font-medium text-accent-foreground hover:border-accent-foreground';

export const ROW =
  'flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b border-border px-0.5 py-5 sm:py-6';
