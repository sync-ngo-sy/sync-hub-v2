import { Button } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import { WRAP } from '../wrap';

// Deliberately static: the restrained-motion policy leaves this surface with nothing to animate.
export function Hero() {
  return (
    <header className="py-[clamp(3.5rem,9vw,8rem)]">
      <div className={WRAP}>
        <div className="mb-[clamp(1.5rem,4vw,2.5rem)] flex items-center gap-4">
          <span className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
            For employers hiring in Syria
          </span>
          <span aria-hidden className="h-px flex-1 bg-border" />
        </div>

        <h1 className="max-w-[18ch] text-display text-foreground">
          Post a role. Meet the{' '}
          <span className="border-b-4 border-primary pb-[0.03em] text-primary">shortlist</span>, not
          the pile.
        </h1>

        <div className="mt-[clamp(2rem,6vw,3.5rem)]">
          <div className="ml-auto max-w-[420px] border-t border-border pt-6">
            <p className="mb-7 text-lg text-secondary-foreground">
              Sync reads every CV, screens each applicant against your role, and hands your team a
              ranked pipeline — so hiring starts at the shortlist, not the inbox.
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
              <Button size="lg" render={<Link to="/signup">Create your workspace →</Link>} />
              <Link
                to="/login"
                search={{ returnTo: undefined }}
                className="border-b border-border pb-0.5 text-[15px] font-medium text-accent-foreground hover:border-accent-foreground"
              >
                Log in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
