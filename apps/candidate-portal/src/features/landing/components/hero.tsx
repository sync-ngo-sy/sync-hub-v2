import { Button } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { usePrefersReducedMotion } from '../hooks/use-prefers-reduced-motion';
import { WRAP } from '../wrap';
import { StaticHeadline } from './static-headline';

const TypewriterHeadline = lazy(() => import('./typewriter-headline'));

export function Hero() {
  const reduced = usePrefersReducedMotion();

  return (
    <header className="py-[clamp(3.5rem,9vw,8rem)]">
      <div className={WRAP}>
        <div className="mb-[clamp(1.5rem,4vw,2.5rem)] flex items-center gap-4">
          <span className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Damascus — Aleppo — Homs — Latakia
          </span>
          <span aria-hidden className="h-px flex-1 bg-border" />
        </div>

        {reduced ? (
          <StaticHeadline />
        ) : (
          <Suspense fallback={<StaticHeadline />}>
            <TypewriterHeadline />
          </Suspense>
        )}

        <div className="mt-[clamp(2rem,6vw,3.5rem)]">
          <div className="ml-auto max-w-[380px] border-t border-border pt-6">
            <p className="mb-7 text-lg text-secondary-foreground">
              Create your profile once, upload your CV, and apply in minutes — then follow every
              application, from first look to offer.
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
              <Button size="lg" render={<Link to="/jobs">Browse jobs →</Link>} />
              <Link
                to="/signup"
                className="border-b border-border pb-0.5 text-[15px] font-medium text-accent-foreground hover:border-accent-foreground"
              >
                Create your profile
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
