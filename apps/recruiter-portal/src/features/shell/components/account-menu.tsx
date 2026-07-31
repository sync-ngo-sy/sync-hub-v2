import { Avatar, AvatarFallback, AvatarImage } from '@sync/ui/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@sync/ui/components/ui/dropdown-menu';
import { ChevronsUpDown, LogOut } from 'lucide-react';
import type { Profile } from '@/features/auth/current-profile';
import { useLogOut } from '@/features/auth/hooks/use-log-out';

function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function AccountMenu({ profile }: { profile: Profile }) {
  const logOut = useLogOut();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1 text-left outline-none hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label={`Account: ${profile.full_name}`}
      >
        <Avatar>
          {profile.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
          <AvatarFallback className="bg-accent text-xs font-semibold text-accent-foreground">
            {initials(profile.full_name)}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-foreground">
            {profile.full_name}
          </span>
          <span className="block truncate text-xs text-muted-foreground">{profile.email}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuItem
          disabled={logOut.isPending}
          onClick={() => {
            logOut.mutate({});
          }}
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
