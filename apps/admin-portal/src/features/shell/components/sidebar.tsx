import { Button } from '@sync/ui/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@sync/ui/components/ui/tooltip';
import { cn } from '@sync/ui/lib/utils';
import { Link } from '@tanstack/react-router';
import { LogOut, Moon, PanelLeftClose, PanelLeftOpen, Sun } from 'lucide-react';
import type { Profile } from '@/features/auth/current-profile';
import { useLogOut } from '@/features/auth/hooks';
import { DESTINATIONS, type Destination } from '@/features/shell/nav';
import { useTheme } from '@/lib/theme';

interface SidebarProps {
  profile: Profile;
  collapsed?: boolean;
  onNavigate?: () => void;
  onToggleRail?: () => void;
}

export function Sidebar({ profile, collapsed = false, onNavigate, onToggleRail }: SidebarProps) {
  const logOut = useLogOut();
  const { theme, toggle } = useTheme();

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col bg-sidebar py-6 text-sidebar-foreground">
        <div
          className={cn(
            'mb-8 flex items-center gap-2',
            collapsed ? 'flex-col px-2' : 'justify-between px-4',
          )}
        >
          <Link to="/overview" className="font-heading text-lg font-semibold">
            <span className={collapsed ? 'sr-only' : undefined}>Sync Platform</span>
            <span aria-hidden="true" className={collapsed ? undefined : 'hidden'}>
              S
            </span>
          </Link>
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

        <nav aria-label="Platform" className={cn('flex-1 space-y-1', collapsed ? 'px-2' : 'px-3')}>
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
            'mt-4 border-t border-sidebar-border pt-4',
            collapsed ? 'mx-2' : 'mx-3 text-sm',
          )}
        >
          {collapsed ? null : <p className="mb-3 truncate">{profile.full_name}</p>}
          <div className={cn('flex gap-2', collapsed ? 'flex-col items-center' : 'items-center')}>
            <Button
              variant="sidebar"
              size="icon"
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
              onClick={toggle}
            >
              {theme === 'dark' ? <Sun /> : <Moon />}
            </Button>
            <Button
              variant="sidebar"
              size="icon"
              aria-label="Sign out"
              disabled={logOut.isPending}
              onClick={() => logOut.mutate({})}
            >
              <LogOut />
            </Button>
          </div>
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
        'flex items-center rounded-md p-2.5 text-dense hover:bg-sidebar-accent aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-sidebar-accent-foreground',
        collapsed ? 'justify-center' : 'gap-2.5',
      )}
    >
      <Icon className="size-4.5 shrink-0" />
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
