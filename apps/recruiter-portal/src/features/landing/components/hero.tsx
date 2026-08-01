import { buttonVariants } from '@sync/ui/components/ui/button';
import { cn } from '@sync/ui/lib/utils';
import { Link } from '@tanstack/react-router';
import { HEADLINE } from '../headline';
import { Eyebrow, HERO_BUTTON, RISE, UNDERLINE_LINK, Wrap } from './page-parts';

export function Hero() {
  return (
    <section className="pt-[clamp(3.5rem,8vw,6.5rem)] pb-[clamp(3rem,6vw,5rem)]">
      <Wrap>
        <div>
          <Eyebrow className={cn(RISE, 'mb-6')}>Sync for employers</Eyebrow>

          <h1
            className={cn(
              RISE,
              'max-w-[42rem] font-heading text-h1 text-foreground motion-safe:delay-75',
            )}
          >
            {HEADLINE.before}
            <span className="text-primary">{HEADLINE.accent}</span>
            {HEADLINE.after}
          </h1>

          <p
            className={cn(
              RISE,
              'mt-6 max-w-[34rem] text-reading text-secondary-foreground motion-safe:delay-150',
            )}
          >
            Publish a job with the criteria that actually matter, and Sync measures every applicant
            against them the moment they apply. Your pipeline starts sorted, not stacked.
          </p>

          <div
            className={cn(
              RISE,
              'mt-9 flex flex-wrap items-center gap-x-6 gap-y-4 motion-safe:delay-200',
            )}
          >
            <Link to="/signup" className={cn(buttonVariants({ size: 'lg' }), HERO_BUTTON)}>
              Create your workspace <span aria-hidden="true">→</span>
            </Link>
            <Link to="/login" className={UNDERLINE_LINK}>
              Sign in
            </Link>
          </div>
        </div>
      </Wrap>
    </section>
  );
}
