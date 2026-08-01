import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Brand } from '@/features/shell/components/brand';
import { env } from '@/lib/env';
import { Wrap } from './editorial';

const LINK = 'block text-dense text-secondary-foreground hover:text-foreground';

/** Only destinations that exist: a footer full of pages nobody built is worse than a short one. */
export function LandingFooter() {
  return (
    <footer className="pt-14 pb-8">
      <Wrap>
        <div className="mb-10 grid gap-8 sm:grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Brand className="mb-3" />
            <p className="max-w-[34ch] text-dense text-muted-foreground">
              Connecting Syrian talent with employers who are hiring, built to be calm and clear.
            </p>
          </div>

          <Column title="Job seekers">
            <Link to="/jobs" className={LINK}>
              Browse jobs
            </Link>
            <Link to="/signup" className={LINK}>
              Create your profile
            </Link>
            <Link to="/login" className={LINK}>
              Sign in
            </Link>
          </Column>

          <Column title="Employers">
            <a href={env.recruiterPortalUrl} className={LINK}>
              For employers
            </a>
          </Column>
        </div>

        <p className="border-t border-border pt-6 text-meta text-muted-foreground">
          © {new Date().getFullYear()} Sync.
        </p>
      </Wrap>
    </footer>
  );
}

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="mb-3.5 text-meta font-semibold text-foreground">{title}</h2>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}
