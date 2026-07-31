import { Link } from '@tanstack/react-router';
import { contact } from '@/lib/contact';
import { WRAP } from '../wrap';
import { BrandMark } from './brand-mark';

export function LandingFooter() {
  return (
    <footer className="pt-14 pb-8">
      <div className={WRAP}>
        <div className="mb-10 grid grid-cols-1 gap-8 md:grid-cols-[1.6fr_1fr_1fr]">
          <div>
            <BrandMark className="mb-3" />
            <p className="max-w-[34ch] text-sm text-muted-foreground">
              Screening built in, so hiring in Syria starts at the shortlist. Calm and clear, by
              design.
            </p>
          </div>

          <div>
            <h2 className="mb-3.5 text-[13px] font-semibold text-foreground">Get started</h2>
            <ul className="flex flex-col gap-2.5 text-sm text-secondary-foreground">
              <li>
                <Link to="/signup">Create your workspace</Link>
              </li>
              <li>
                <Link to="/login" search={{ returnTo: undefined }}>
                  Log in
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="mb-3.5 text-[13px] font-semibold text-foreground">Learn more</h2>
            <ul className="flex flex-col gap-2.5 text-sm text-secondary-foreground">
              <li>
                <a href="#how-it-works">How it works</a>
              </li>
              <li>
                <a href={contact.whatsappUrl} target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
              </li>
              <li>
                <a href={contact.emailUrl}>Email us</a>
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
