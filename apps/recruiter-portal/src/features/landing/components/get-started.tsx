import { buttonVariants } from '@sync/ui/components/ui/button';
import { cn } from '@sync/ui/lib/utils';
import { Link } from '@tanstack/react-router';
import { ContactLinks } from './contact-links';
import { HERO_BUTTON, UNDERLINE_LINK, Wrap } from './page-parts';

export function GetStarted() {
  return (
    <section
      id="contact"
      aria-labelledby="get-started-heading"
      className="scroll-mt-20 border-t border-border bg-secondary"
    >
      <Wrap className="py-[clamp(3rem,6vw,4.5rem)]">
        <div className="flex flex-col gap-10 lg:flex-row lg:justify-between lg:gap-16">
          <div className="max-w-[46ch]">
            <h2 id="get-started-heading" className="font-heading text-h2 text-foreground">
              Start hiring on Sync.
            </h2>
            <p className="mt-3 text-reading text-secondary-foreground">
              Create your workspace, publish your first job, and see the difference on the first
              application that arrives.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Link to="/signup" className={cn(buttonVariants({ size: 'lg' }), HERO_BUTTON)}>
                Create your workspace <span aria-hidden="true">→</span>
              </Link>
              <Link to="/login" className={UNDERLINE_LINK}>
                Sign in
              </Link>
            </div>
          </div>

          <div className="lg:w-[300px] lg:shrink-0">
            <h3 className="text-title text-foreground">Talk to the Sync team</h3>
            <p className="mt-2 mb-5 max-w-[38ch] text-dense text-muted-foreground">
              Questions about screening, or want a walkthrough before you sign up? Reach us
              directly.
            </p>
            <ContactLinks />
          </div>
        </div>
      </Wrap>
    </section>
  );
}
