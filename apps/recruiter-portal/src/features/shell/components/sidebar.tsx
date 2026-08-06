import { microLabel } from '@sync/ui/lib/micro-label';
import { cn } from '@sync/ui/lib/utils';
import { Link } from '@tanstack/react-router';
import { useId } from 'react';
import type { Profile } from '@/features/auth/current-profile';
import { DESTINATIONS } from '@/features/shell/nav';
import { AccountMenu } from './account-menu';
import { Brand } from './brand';
import { ThemeToggle } from './theme-toggle';

export function Sidebar({ profile, onNavigate }: { profile: Profile; onNavigate?: () => void }) {
  const labelId = useId();

  return (
    <div className="flex h-full flex-col bg-sidebar py-6 text-sidebar-foreground">
      <Brand className="mb-8 px-5" />

      <nav aria-labelledby={labelId} className="flex flex-1 flex-col gap-0.5 px-3">
        <p id={labelId} className={cn(microLabel, 'px-2 pb-1.5 font-section text-sidebar-label')}>
          Workspace
        </p>
        {DESTINATIONS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            activeProps={{ 'aria-current': 'page' }}
            className="group relative flex items-center gap-2.5 rounded-lg p-2.5 text-dense font-nav text-sidebar-foreground hover:bg-sidebar-accent/60 aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium aria-[current=page]:text-sidebar-accent-foreground aria-[current=page]:before:absolute aria-[current=page]:before:inset-y-2 aria-[current=page]:before:left-0 aria-[current=page]:before:w-0.75 aria-[current=page]:before:rounded-full aria-[current=page]:before:bg-sidebar-primary"
          >
            <Icon className="size-4.5 shrink-0 text-sidebar-foreground/90 group-aria-[current=page]:text-sidebar-accent-foreground" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="mx-3 mt-4 flex items-center gap-2 border-t border-sidebar-border pt-4">
        <AccountMenu profile={profile} />
        <ThemeToggle variant="sidebar" />
      </div>
    </div>
  );
}
