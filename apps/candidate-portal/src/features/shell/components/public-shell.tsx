import { buttonVariants } from '@sync/ui/components/ui/button';
import { cn } from '@sync/ui/lib/utils';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { MEASURE } from '../measure';
import { PublicHeader } from './public-header';

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader>
        <Link to="/login" className={buttonVariants({ size: 'sm', variant: 'ghost' })}>
          Sign in
        </Link>
        <Link to="/signup" className={buttonVariants({ size: 'sm' })}>
          Create account
        </Link>
      </PublicHeader>
      <main className={cn('mx-auto w-full flex-1 px-4 py-8 md:px-6 md:py-10', MEASURE)}>
        {children}
      </main>
    </div>
  );
}
