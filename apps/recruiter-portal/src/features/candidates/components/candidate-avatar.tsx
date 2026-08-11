import { Avatar, AvatarFallback, AvatarImage } from '@sync/ui/components/ui/avatar';
import { cn } from '@sync/ui/lib/utils';

function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

interface CandidateAvatarProps {
  fullName: string;
  avatarUrl: string | null;
  size?: 'default' | 'sm' | 'lg' | 'row';
  className?: string;
  fallbackClassName?: string;
}

export function CandidateAvatar({
  fullName,
  avatarUrl,
  size = 'default',
  className,
  fallbackClassName,
}: CandidateAvatarProps) {
  return (
    <Avatar size={size} className={className}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
      <AvatarFallback
        className={cn('bg-accent font-semibold text-accent-foreground', fallbackClassName)}
      >
        {initials(fullName)}
      </AvatarFallback>
    </Avatar>
  );
}
