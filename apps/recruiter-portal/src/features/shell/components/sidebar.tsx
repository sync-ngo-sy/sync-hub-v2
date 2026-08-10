import { Button } from '@sync/ui/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@sync/ui/components/ui/tooltip';
import { microLabel } from '@sync/ui/lib/micro-label';
import { cn } from '@sync/ui/lib/utils';
import { Link } from '@tanstack/react-router';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useId } from 'react';
import type { Profile } from '@/features/auth/current-profile';
import { DESTINATIONS, type Destination } from '@/features/shell/nav';
import { AccountMenu } from './account-menu';
import { Brand } from './brand';
import { ThemeToggle } from './theme-toggle';

interface SidebarProps {
  profile: Profile;
  collapsed?: boolean;
  onNavigate?: () => void;
  onToggleRail?: () => void;
}

export function Sidebar({ profile, collapsed = false, onNavigate, onToggleRail }: SidebarProps) {
  const labelId = useId();

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col bg-sidebar py-6 text-sidebar-foreground">
        <div
          className={cn(
            'mb-8 flex items-center gap-2',
            collapsed ? 'flex-col px-2' : 'justify-between px-5',
          )}
        >
          <Brand to="/dashboard" nameHidden={collapsed} />
          {onToggleRail ? (
            <Button
              variant="sidebar"
              size="icon"
              aria-label={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'}
              onClick={onToggleRail}
            >
              {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>
          ) : null}
        </div>

        <nav
          aria-labelledby={labelId}
          className={cn('flex flex-1 flex-col gap-0.5', collapsed ? 'px-2' : 'px-3')}
        >
          <p
            id={labelId}
            className={cn(
              microLabel,
              'pb-1.5 font-section text-sidebar-label',
              collapsed ? 'sr-only' : 'px-2',
            )}
          >
            Workspace
          </p>
          {DESTINATIONS.map((destination) => (
            <NavLink
              key={destination.to}
              destination={destination}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ))}
        </nav>

        <div
          className={cn(
            'mt-4 flex items-center gap-2 border-t border-sidebar-border pt-4',
            collapsed ? 'mx-2 flex-col' : 'mx-3',
          )}
        >
          <AccountMenu profile={profile} collapsed={collapsed} />
          <ThemeToggle variant="sidebar" />
        </div>
      </div>
    </TooltipProvider>
  );
}

interface NavLinkProps {
  destination: Destination;
  collapsed: boolean;
  onNavigate?: () => void;
}

function NavLink({ destination: { to, label, icon: Icon }, collapsed, onNavigate }: NavLinkProps) {
  const link = (
    <Link
      to={to}
      onClick={onNavigate}
      activeProps={{ 'aria-current': 'page' }}
      className={cn(
        'group relative flex items-center rounded-lg p-2.5 text-dense font-nav text-sidebar-foreground hover:bg-sidebar-accent/60 aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium aria-[current=page]:text-sidebar-accent-foreground aria-[current=page]:before:absolute aria-[current=page]:before:inset-y-2 aria-[current=page]:before:left-0 aria-[current=page]:before:w-0.75 aria-[current=page]:before:rounded-full aria-[current=page]:before:bg-sidebar-primary',
        collapsed ? 'justify-center' : 'gap-2.5',
      )}
    >
      <Icon className="size-4.5 shrink-0 text-sidebar-foreground/90 group-aria-[current=page]:text-sidebar-accent-foreground" />
      <span className={collapsed ? 'sr-only' : undefined}>{label}</span>
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
