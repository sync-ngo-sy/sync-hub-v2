import { buttonVariants } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { PublicHeader } from './public-header';

/** No tab bar: browsing is the only destination open to a visitor, and a one-tab bar is noise. */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader>
        {/* buttonVariants on a real Link, not `Button render=`: Base UI's button either warns
            about the non-native element or stamps role="button" over the link. */}
        <Link to="/login" className={buttonVariants({ size: 'sm' })}>
          Sign in
        </Link>
      </PublicHeader>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 md:max-w-5xl md:px-6 md:py-10">
        {children}
      </main>
    </div>
  );
}
