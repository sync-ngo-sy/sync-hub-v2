import { Link } from '@tanstack/react-router';
import type { Profile } from '@/features/auth/current-profile';
import { DESTINATIONS } from '@/features/shell/nav';
import { AccountMenu } from './account-menu';
import { Brand } from './brand';
import { ThemeToggle } from './theme-toggle';

export function Sidebar({ profile, onNavigate }: { profile: Profile; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-sidebar py-6">
      <Brand className="mb-8 px-5" />

      <nav aria-label="Workspace" className="flex flex-1 flex-col gap-0.5 px-3">
        {DESTINATIONS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            activeProps={{ 'aria-current': 'page' }}
            className="group relative flex items-center gap-2.5 rounded-lg py-2.5 pr-3 pl-4 text-dense text-sidebar-foreground hover:bg-sidebar-accent/60 aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium aria-[current=page]:text-sidebar-accent-foreground aria-[current=page]:before:absolute aria-[current=page]:before:inset-y-2 aria-[current=page]:before:left-0 aria-[current=page]:before:w-0.75 aria-[current=page]:before:rounded-full aria-[current=page]:before:bg-sidebar-primary"
          >
            <Icon className="size-4.5 shrink-0 text-muted-foreground group-aria-[current=page]:text-sidebar-accent-foreground" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="mx-3 mt-4 flex items-center gap-2 border-t border-sidebar-border pt-4">
        <AccountMenu profile={profile} />
        <ThemeToggle />
      </div>
    </div>
  );
}
