import { buttonVariants } from '@sync/ui/components/ui/button';
import { cn } from '@sync/ui/lib/utils';
import { Link } from '@tanstack/react-router';
import { Brand } from '@/features/shell/components/brand';
import { ThemeToggle } from '@/features/shell/components/theme-toggle';
import { env } from '@/lib/env';
import { NAV_BUTTON, Wrap } from './editorial';

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background">
      <Wrap className="flex h-19 items-center justify-between gap-4">
        <Brand />

        <nav
          aria-label="Site"
          className="hidden items-center gap-8 text-dense font-medium text-secondary-foreground sm:flex"
        >
          <Link to="/jobs" className="hover:text-foreground">
            Browse jobs
          </Link>
          <a href={env.recruiterPortalUrl} className="hover:text-foreground">
            For employers
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link to="/login" className={cn(buttonVariants({ variant: 'ghost' }), NAV_BUTTON)}>
            Sign in
          </Link>
          {/* Below `sm` the hero's own CTA carries sign-up: two buttons plus the brand do not
              fit a 360px header. */}
          <Link to="/signup" className={cn(buttonVariants(), NAV_BUTTON, 'hidden sm:inline-flex')}>
            Create account
          </Link>
        </div>
      </Wrap>
    </header>
  );
}
