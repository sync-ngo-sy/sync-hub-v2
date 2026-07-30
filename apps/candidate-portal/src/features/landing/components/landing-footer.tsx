import { Link } from '@tanstack/react-router';
import { RECRUITER_PORTAL_URL, WRAP } from '../wrap';
import { BrandMark } from './brand-mark';

// Only destinations that resolve in v1 are linked; the marketing pages the mockup also lists
// (help centre, pricing, about…) have no route yet, so they are left out rather than dead-linked.
export function LandingFooter() {
  return (
    <footer className="pt-14 pb-8">
      <div className={WRAP}>
        <div className="mb-10 grid grid-cols-1 gap-8 md:grid-cols-[1.6fr_1fr_1fr]">
          <div>
            <BrandMark className="mb-3" />
            <p className="max-w-[34ch] text-sm text-muted-foreground">
              Connecting Syrian talent with employers who are hiring, built to be calm and clear.
            </p>
          </div>

          <div>
            <h2 className="mb-3.5 text-[13px] font-semibold text-foreground">Job seekers</h2>
            <ul className="flex flex-col gap-2.5 text-sm text-secondary-foreground">
              <li>
                <Link to="/jobs">Browse jobs</Link>
              </li>
              <li>
                <Link to="/signup">Create your profile</Link>
              </li>
              <li>
                <Link to="/login" search={{ returnTo: undefined }}>
                  Log in
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="mb-3.5 text-[13px] font-semibold text-foreground">Employers</h2>
            <ul className="flex flex-col gap-2.5 text-sm text-secondary-foreground">
              <li>
                <a href={RECRUITER_PORTAL_URL}>For employers</a>
              </li>
              <li>
                <a href={RECRUITER_PORTAL_URL}>Post a job</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border pt-6 text-[13px] text-muted-foreground">
          © 2026 Sync.
        </div>
      </div>
    </footer>
  );
}
