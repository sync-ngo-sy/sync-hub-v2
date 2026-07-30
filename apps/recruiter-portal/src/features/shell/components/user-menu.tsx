import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@sync/ui/components/ui/dropdown-menu';
import { LogOut } from 'lucide-react';
import type { Profile } from '@/features/auth/current-profile';
import { useLogOut } from '@/features/auth/hooks/use-log-out';
import { useMyTenant } from '../hooks/use-my-tenant';

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

export function UserMenu({ profile }: { profile: Profile }) {
  const logOut = useLogOut();
  const tenant = useMyTenant();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-lg p-1 text-start transition-colors hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        }
      >
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-strong text-accent-foreground"
        >
          {initials(profile.full_name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.8125rem] font-emphasis text-foreground">
            {profile.full_name}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {tenant.data?.name ?? profile.email}
          </span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="min-w-48">
        <DropdownMenuItem disabled={logOut.isPending} onClick={() => logOut.mutate({})}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
