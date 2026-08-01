import { buttonVariants } from '@sync/ui/components/ui/button';
import { cn } from '@sync/ui/lib/utils';
import { Link } from '@tanstack/react-router';
import { usePrefersReducedMotion } from '../hooks/use-prefers-reduced-motion';
import { Eyebrow, HERO_BUTTON, UNDERLINE_LINK, Wrap } from './editorial';
import { StaticHeadline } from './headline';
import TypewriterHeadline from './typewriter-headline';

export function Hero() {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <section className="pt-[clamp(3.5rem,9vw,8rem)] pb-[clamp(3rem,7vw,6rem)]">
      <Wrap>
        <div className="mb-[clamp(1.5rem,4vw,2.5rem)] flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <Eyebrow>Damascus — Aleppo — Homs — Latakia</Eyebrow>
          <span aria-hidden="true" className="hidden h-px flex-1 bg-border sm:block" />
        </div>

        {reducedMotion ? <StaticHeadline /> : <TypewriterHeadline />}

        <div className="mt-[clamp(2rem,6vw,3.5rem)]">
          <div className="border-t border-border pt-6 sm:ml-auto sm:max-w-[380px]">
            <p className="mb-7 text-[1.125rem] text-secondary-foreground">
              Create your profile once, upload your CV, and apply in minutes — then follow every
              application, from first look to offer.
            </p>
            <div className="flex flex-wrap items-center gap-x-[22px] gap-y-4">
              <Link to="/jobs" className={cn(buttonVariants({ size: 'lg' }), HERO_BUTTON)}>
                Browse jobs <span aria-hidden="true">→</span>
              </Link>
              <Link to="/signup" className={UNDERLINE_LINK}>
                Create your profile
              </Link>
            </div>
          </div>
        </div>
      </Wrap>
    </section>
  );
}
