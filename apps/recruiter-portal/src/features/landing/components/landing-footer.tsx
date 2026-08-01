import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Brand } from '@/features/shell/components/brand';
import { ContactLinks } from './contact-links';
import { Wrap } from './page-parts';

const LINK = 'block text-dense text-secondary-foreground hover:text-foreground';

/** Only destinations that exist: a footer full of pages nobody built is worse than a short one. */
export function LandingFooter() {
  return (
    <footer className="border-t border-border pt-12 pb-8">
      <Wrap>
        <div className="mb-10 grid gap-8 sm:grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Brand className="mb-3" />
            <p className="max-w-[34ch] text-dense text-muted-foreground">
              Hiring software for companies in Syria — every applicant screened, every pipeline in
              one place.
            </p>
          </div>

          <Column title="Workspace">
            <Link to="/signup" className={LINK}>
              Create your workspace
            </Link>
            <Link to="/login" className={LINK}>
              Sign in
            </Link>
          </Column>

          <Column title="Contact">
            <ContactLinks className="gap-2.5" />
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
