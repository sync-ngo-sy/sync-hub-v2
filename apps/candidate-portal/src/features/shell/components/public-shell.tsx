import { buttonVariants } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
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
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 md:max-w-5xl md:px-6 md:py-10">
        {children}
      </main>
    </div>
  );
}
