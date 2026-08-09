import { Avatar, AvatarFallback, AvatarImage } from '@sync/ui/components/ui/avatar';
import type { CandidateCard } from '../candidate';

function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

interface CandidateAvatarProps {
  card: CandidateCard;
  size?: 'default' | 'sm' | 'lg' | 'row';
}

export function CandidateAvatar({ card, size = 'default' }: CandidateAvatarProps) {
  return (
    <Avatar size={size}>
      {card.avatarUrl ? <AvatarImage src={card.avatarUrl} alt="" /> : null}
      <AvatarFallback className="bg-accent font-semibold text-accent-foreground">
        {initials(card.fullName)}
      </AvatarFallback>
    </Avatar>
  );
}
