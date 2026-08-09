import { Mail, Phone } from 'lucide-react';
import type { ReactNode } from 'react';
import { CandidateAvatar } from '@/features/candidates/components/candidate-avatar';
import type { FullProfile } from '../profile';

export interface CandidateIdentityFact {
  label: string;
  value: ReactNode;
}

interface CandidateIdentityHeaderProps {
  profile: FullProfile;
  breadcrumbs: ReactNode;
  actions?: ReactNode;
  contextLabel?: string;
  factsLabel?: string;
  facts: CandidateIdentityFact[];
}

export function CandidateIdentityHeader({
  profile,
  breadcrumbs,
  actions,
  contextLabel,
  factsLabel = 'Candidate facts',
  facts,
}: CandidateIdentityHeaderProps) {
  const title = profile.role ?? profile.headline;
  const subtitle = profile.role && profile.headline ? profile.headline : null;

  return (
    <header className="-mx-(--space-gutter) -mt-(--space-section) border-b border-border bg-card px-(--space-gutter) py-5 dark:border-sidebar-border dark:bg-sidebar">
      {breadcrumbs}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-5">
        <div className="flex min-w-0 items-center gap-4">
          <CandidateAvatar
            fullName={profile.name}
            avatarUrl={profile.avatarUrl}
            size="lg"
            className="size-14 sm:size-16"
            fallbackClassName="text-lg"
          />

          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="truncate font-heading text-page-title text-foreground">
                {profile.name}
              </h1>
              {contextLabel ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-meta font-medium text-muted-foreground">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
                  {contextLabel}
                </span>
              ) : null}
            </div>
            {title ? (
              <p className="truncate text-dense font-medium text-foreground">{title}</p>
            ) : null}
            {subtitle ? (
              <p className="truncate text-meta text-muted-foreground">{subtitle}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-muted-foreground">
              {profile.email ? (
                <a
                  href={`mailto:${profile.email}`}
                  className="inline-flex items-center gap-1.5 hover:text-foreground"
                >
                  <Mail aria-hidden="true" className="size-3.5" />
                  {profile.email}
                </a>
              ) : null}
              {profile.phone ? (
                <a
                  href={`tel:${profile.phone}`}
                  className="inline-flex items-center gap-1.5 hover:text-foreground"
                >
                  <Phone aria-hidden="true" className="size-3.5" />
                  {profile.phone}
                </a>
              ) : null}
            </div>
          </div>
        </div>

        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      {facts.length > 0 ? (
        <dl
          aria-label={factsLabel}
          className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-px overflow-hidden rounded-lg border border-border bg-border"
        >
          {facts.map((fact) => (
            <div key={fact.label} className="bg-card px-3 py-2.5">
              <dt className="text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground">
                {fact.label}
              </dt>
              <dd className="mt-1 text-dense text-foreground">{fact.value ?? 'Not provided'}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </header>
  );
}
