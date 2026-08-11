import { env } from '@/lib/env';
import { Wrap } from './editorial';

export function EmployerBand() {
  return (
    <section className="border-y border-border bg-secondary">
      <Wrap className="py-10 sm:py-14">
        <p className="max-w-[60ch] text-h3 font-medium text-foreground">
          Hiring in Syria? Screen every applicant automatically.{' '}
          <a
            href={env.recruiterPortalUrl}
            className="whitespace-nowrap border-b border-accent-foreground text-accent-foreground"
          >
            See Sync Hub for employers <span aria-hidden="true">→</span>
          </a>
        </p>
      </Wrap>
    </section>
  );
}
