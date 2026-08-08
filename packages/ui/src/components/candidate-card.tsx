import { Avatar, AvatarFallback, AvatarImage } from '@sync/ui/components/ui/avatar';
import { Card, CardContent } from '@sync/ui/components/ui/card';
import { cardSurface } from '@sync/ui/lib/card-surface';
import { cn } from '@sync/ui/lib/utils';
import { useId } from 'react';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function years(count: number): string {
  return `${count} ${count === 1 ? 'year' : 'years'}`;
}

interface CandidateCardProps {
  name: string;
  avatarUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  headline?: string | null;
  yearsOfExperience?: number | null;
  languages?: string[];
  className?: string;
}

export function CandidateCard({
  name,
  avatarUrl,
  email,
  phone,
  role,
  headline,
  yearsOfExperience,
  languages,
  className,
}: CandidateCardProps) {
  const nameId = useId();
  const facts = [
    { label: 'Email', value: email },
    { label: 'Phone', value: phone },
    {
      label: 'Total experience',
      value: yearsOfExperience == null ? null : years(yearsOfExperience),
    },
    { label: 'Languages', value: languages?.length ? languages.join(', ') : null },
  ].filter((fact): fact is { label: string; value: string } => Boolean(fact.value));

  return (
    <article aria-labelledby={nameId}>
      <Card
        className={cn(
          cardSurface,
          'border-transparent bg-accent/45 shadow-lg ring-2 ring-primary/25',
          className,
        )}
      >
        <CardContent className="space-y-(--space-card)">
          <div className="flex flex-wrap items-center gap-4 sm:gap-5">
            <Avatar size="lg" className="size-16 shrink-0 sm:size-20">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
              <AvatarFallback className="bg-primary-solid text-h3 font-semibold text-primary-solid-foreground">
                {initials(name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-1">
              <h1 id={nameId} className="truncate font-heading text-page-title text-foreground">
                {name}
              </h1>
              {role ? (
                <p className="truncate text-meta font-medium text-accent-foreground">{role}</p>
              ) : null}
              {headline ? (
                <p className="max-w-prose text-dense text-muted-foreground">{headline}</p>
              ) : null}
            </div>
          </div>

          {facts.length > 0 ? (
            <dl className="grid gap-x-6 gap-y-3 border-t border-primary/15 pt-(--space-card-gap) sm:grid-cols-2 lg:grid-cols-4">
              {facts.map((fact) => (
                <div key={fact.label} className="min-w-0">
                  <dt className="text-meta text-secondary-foreground">{fact.label}</dt>
                  <dd className="truncate text-dense text-foreground">{fact.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </CardContent>
      </Card>
    </article>
  );
}
