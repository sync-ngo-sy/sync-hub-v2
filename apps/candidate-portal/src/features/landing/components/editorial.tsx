import { cn } from '@sync/ui/lib/utils';
import type { ReactNode } from 'react';

export function Wrap({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-[1120px] px-7', className)}>{children}</div>;
}

export const INDEX_ROW =
  'flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b border-border px-0.5 py-5 sm:py-6';
