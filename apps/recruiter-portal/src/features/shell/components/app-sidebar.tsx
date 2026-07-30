import { cn } from '@sync/ui/lib/utils';
import { Link } from '@tanstack/react-router';
import type { Profile } from '@/features/auth/current-profile';
import { NAV_ITEMS } from '../nav-items';
import { Brand } from './brand';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';

const NAV_LINK =
  'relative flex items-center gap-2.5 rounded-lg py-2.5 pr-3 pl-4 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none before:absolute before:inset-y-2 before:start-0 before:w-[3px] before:rounded-full before:bg-primary before:opacity-0 [&_svg]:size-[1.125rem] [&_svg]:shrink-0 [&_svg]:text-muted-foreground';

const NAV_LINK_ACTIVE =
  'bg-sidebar-accent font-medium text-accent-foreground before:opacity-100 [&_svg]:text-accent-foreground';

interface AppSidebarProps {
  profile: Profile;
  className?: string;
  /** Lets the drawer close itself when a destination is chosen. */
  onNavigate?: () => void;
}

export function AppSidebar({ profile, className, onNavigate }: AppSidebarProps) {
  return (
    <div className={cn('flex h-full flex-col border-e border-border bg-sidebar py-6', className)}>
      <Brand className="mb-8 px-5" />

      <nav aria-label="Workspace" className="flex flex-1 flex-col gap-0.5 px-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={NAV_LINK}
            activeProps={{ className: NAV_LINK_ACTIVE }}
            onClick={onNavigate}
          >
            <Icon aria-hidden />
            {label}
          </Link>
        ))}
      </nav>

      <div className="mt-4 flex items-center gap-1 border-t border-border px-3 pt-4">
        <UserMenu profile={profile} />
        <ThemeToggle />
      </div>
    </div>
  );
}
