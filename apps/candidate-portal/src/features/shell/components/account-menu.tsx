import { Avatar, AvatarFallback, AvatarImage } from '@sync/ui/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@sync/ui/components/ui/dropdown-menu';
import { Link } from '@tanstack/react-router';
import { Bell, LogOut, Settings } from 'lucide-react';
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
        className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label={`Account: ${profile.full_name}`}
      >
        <Avatar>
          {profile.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
          <AvatarFallback className="bg-accent text-xs font-semibold text-accent-foreground">
            {initials(profile.full_name)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-1.5 py-1">
          <p className="truncate text-dense font-medium text-foreground">{profile.full_name}</p>
          <p className="truncate text-xs text-muted-foreground">{profile.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link to="/notifications" />}>
          <Bell />
          Notifications
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link to="/settings" />}>
          <Settings />
          Account settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
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
