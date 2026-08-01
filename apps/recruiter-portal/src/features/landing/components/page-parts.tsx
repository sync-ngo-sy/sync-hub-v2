import { cn } from '@sync/ui/lib/utils';
import type { ReactNode } from 'react';

export function Wrap({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('mx-auto w-full max-w-[1120px] px-6 sm:px-8 lg:px-10', className)}>
      {children}
    </div>
  );
}

/** The landing's whole motion budget: one entrance, and the browser sits it out for a reader who
 * asked for less. */
export const RISE =
  'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 motion-safe:fill-mode-both';
