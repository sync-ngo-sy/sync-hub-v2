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
    <Card role="article" aria-labelledby={nameId} className={cn(cardSurface, className)}>
      <CardContent className="space-y-(--space-card-gap)">
        <div className="flex items-center gap-4">
          <Avatar size="lg">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
            <AvatarFallback className="bg-accent font-semibold text-accent-foreground">
              {initials(name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p id={nameId} className="truncate text-title text-foreground">
              {name}
            </p>
            {role ? <p className="truncate text-meta text-secondary-foreground">{role}</p> : null}
          </div>
        </div>

        {facts.length > 0 ? (
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
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
  );
}
