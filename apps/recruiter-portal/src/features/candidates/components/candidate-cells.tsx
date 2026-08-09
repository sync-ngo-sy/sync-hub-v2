import type { CandidateCard } from '../candidate';
import { CandidateAvatar } from './candidate-avatar';

export const NOTHING = '—';

export function yearsOf(years: number): string {
  return years === 1 ? '1 year' : `${years} years`;
}

export function CandidateNameCell({ card }: { card: CandidateCard }) {
  return (
    <span className="flex min-w-52 items-center gap-3">
      <CandidateAvatar fullName={card.fullName} avatarUrl={card.avatarUrl} size="row" />
      <span className="flex min-w-0 flex-col gap-1">
        <span>{card.fullName}</span>
        {card.headline ? (
          <span className="text-meta font-normal text-muted-foreground">{card.headline}</span>
        ) : null}
      </span>
    </span>
  );
}
