import { Avatar, AvatarFallback, AvatarImage } from '@sync/ui/components/ui/avatar';
import { factLabel } from '@sync/ui/lib/fact-label';
import { cn } from '@sync/ui/lib/utils';
import { Mail, Phone } from 'lucide-react';
import { type ReactNode, useId } from 'react';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export interface CandidateFact {
  label: string;
  value: ReactNode;
}

interface CandidateCardProps {
  name: string;
  avatarUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  canonicalRole?: string | null;
  headline?: string | null;
  facts?: CandidateFact[];
  factsLabel?: string;
  headingLevel?: 1 | 2;
  className?: string;
}

export function CandidateCard({
  name,
  avatarUrl,
  email,
  phone,
  canonicalRole,
  headline,
  facts = [],
  factsLabel = 'Candidate facts',
  headingLevel = 1,
  className,
}: CandidateCardProps) {
  const nameId = useId();
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  const shown = facts.filter((fact) => fact.value !== null && fact.value !== undefined);

  return (
    <article
      aria-labelledby={nameId}
      className={cn(
        'rounded-xl border border-border bg-card p-(--space-card) shadow-card',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-4">
        <Avatar className="size-14 shrink-0 ring-2 ring-primary/25 sm:size-16">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
          <AvatarFallback className="bg-accent text-title font-semibold text-accent-foreground">
            {initials(name)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 space-y-1">
          <Heading id={nameId} className="truncate font-heading text-title text-foreground">
            {name}
          </Heading>

          {canonicalRole || headline ? (
            <p className="truncate text-dense text-muted-foreground">
              {canonicalRole ? (
                <span className="font-medium text-foreground">{canonicalRole}</span>
              ) : null}
              {canonicalRole && headline ? <span aria-hidden="true"> · </span> : null}
              {headline}
            </p>
          ) : null}

          {email || phone ? (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pt-0.5 text-meta text-muted-foreground">
              {email ? (
                <a
                  href={`mailto:${email}`}
                  className="inline-flex min-w-0 items-center gap-2 hover:text-foreground"
                >
                  <Mail aria-hidden="true" className="size-4 shrink-0 opacity-70" />
                  <span className="truncate">{email}</span>
                </a>
              ) : null}
              {phone ? (
                <a
                  href={`tel:${phone}`}
                  className="inline-flex min-w-0 items-center gap-2 hover:text-foreground"
                >
                  <Phone aria-hidden="true" className="size-4 shrink-0 opacity-70" />
                  <span className="truncate">{phone}</span>
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {shown.length > 0 ? (
        <dl
          aria-label={factsLabel}
          className="mt-(--space-card-gap) grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-x-6 gap-y-3 border-t border-border pt-(--space-card-gap)"
        >
          {shown.map((fact) => (
            <div key={fact.label} className="min-w-0">
              <dt className={cn(factLabel, 'text-muted-foreground')}>{fact.label}</dt>
              <dd className="mt-1 truncate text-dense text-foreground">{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </article>
  );
}
