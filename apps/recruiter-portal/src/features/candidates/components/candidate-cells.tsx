import { TruncatedText } from '@sync/ui/components/truncated-text';
import type { ReactNode } from 'react';
import type { CandidateCard } from '../candidate';
import { CandidateAvatar } from './candidate-avatar';

export const NOTHING = '—';

export function yearsOf(years: number): string {
  return years === 1 ? '1 year' : `${years} years`;
}

interface CandidateIdentityProps {
  name: string;
  avatar?: ReactNode;
  role?: string | null;
  years?: number | null;
}

export function CandidateIdentity({ name, avatar, role, years }: CandidateIdentityProps) {
  const facts = [role, typeof years === 'number' ? yearsOf(years) : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <span className="flex items-center gap-3">
      {avatar}
      <span className="flex min-w-0 flex-col gap-1">
        <TruncatedText>{name}</TruncatedText>
        {facts ? (
          <TruncatedText className="text-meta font-normal text-muted-foreground">
            {facts}
          </TruncatedText>
        ) : null}
      </span>
    </span>
  );
}

export function CandidateNameCell({ card }: { card: CandidateCard }) {
  return (
    <CandidateIdentity
      name={card.fullName}
      avatar={<CandidateAvatar fullName={card.fullName} avatarUrl={card.avatarUrl} size="row" />}
    />
  );
}
