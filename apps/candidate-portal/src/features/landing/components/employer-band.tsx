import { cn } from '@sync/ui/lib/utils';
import { RECRUITER_PORTAL_URL, WRAP } from '../wrap';

export function EmployerBand() {
  return (
    <section id="employers" className="border-y border-border bg-secondary">
      <div className={cn(WRAP, 'py-14')}>
        <p className="max-w-[60ch] text-h3 font-medium text-foreground">
          Hiring in Syria? Screen every applicant automatically.{' '}
          <a
            href={RECRUITER_PORTAL_URL}
            className="border-b border-accent-foreground font-medium whitespace-nowrap text-accent-foreground"
          >
            Learn more →
          </a>
        </p>
      </div>
    </section>
  );
}
