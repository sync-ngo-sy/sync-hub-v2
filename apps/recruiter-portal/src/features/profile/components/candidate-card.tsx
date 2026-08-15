import { Avatar, AvatarFallback, AvatarImage } from '@sync/ui/components/ui/avatar';
import { factLabel } from '@sync/ui/lib/fact-label';
import { cn } from '@sync/ui/lib/utils';
import { Globe, Mail, Phone } from 'lucide-react';
import { type ReactNode, useId } from 'react';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export interface ProfileLinks {
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  portfolioUrl?: string | null;
}

// The two brand marks are drawn here because lucide dropped every brand icon at v1, and a
// LinkedIn drawn as a generic chain link is a link to nowhere a reader recognises.
function LinkedInMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

interface Destination {
  name: string;
  url: string;
  Mark: (props: { className?: string }) => ReactNode;
}

const SCHEME_AND_WWW = /^https?:\/\/(www\.)?/;

/** A portfolio is named by where it goes, because "Portfolio" says nothing LinkedIn does not.
 * Each mark carries that name, because an icon on its own says nothing to a screen reader. */
function destinations(links: ProfileLinks): Destination[] {
  const site = links.portfolioUrl ?? '';
  return [
    { name: 'LinkedIn', url: links.linkedinUrl ?? '', Mark: LinkedInMark },
    { name: 'GitHub', url: links.githubUrl ?? '', Mark: GitHubMark },
    { name: site.replace(SCHEME_AND_WWW, '').replace(/\/$/, ''), url: site, Mark: Globe },
  ].filter((destination) => destination.url !== '');
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
  links?: ProfileLinks;
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
  links = {},
  facts = [],
  factsLabel = 'Candidate facts',
  headingLevel = 1,
  className,
}: CandidateCardProps) {
  const nameId = useId();
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  const shown = facts.filter((fact) => fact.value !== null && fact.value !== undefined);
  const shownLinks = destinations(links);

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

          {shownLinks.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1 pt-1">
              {shownLinks.map(({ name, url, Mark }) => (
                <a
                  key={name}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={name}
                  title={name}
                  className="-m-1.5 inline-flex items-center justify-center p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Mark className="size-4.5" />
                </a>
              ))}
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
