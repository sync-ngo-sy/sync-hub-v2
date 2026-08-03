import { Button } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import type { Profile } from '@/features/auth/current-profile';
import { useLogOut } from '@/features/auth/hooks';
import { useTheme } from '@/lib/theme';

const destinations = [
  { to: '/overview' as const, label: 'Overview' },
  { to: '/access-requests' as const, label: 'Access requests' },
  { to: '/tenants' as const, label: 'Tenants' },
];

export function AppShell({ profile, children }: { profile: Profile; children: ReactNode }) {
  const logOut = useLogOut();
  const { theme, toggle } = useTheme();
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[220px_1fr]">
      <aside className="border-r border-border bg-sidebar px-4 py-6">
        <Link to="/overview" className="mb-8 block font-heading text-lg font-semibold">
          Sync Platform
        </Link>
        <nav aria-label="Platform" className="space-y-1">
          {destinations.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              activeProps={{ 'aria-current': 'page' }}
              className="block rounded-md px-3 py-2 hover:bg-sidebar-accent aria-[current=page]:bg-sidebar-accent"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-8 border-t pt-4 text-sm text-muted-foreground">{profile.full_name}</div>
        <div className="mt-3 flex gap-2">
          <Button variant="outline" size="sm" onClick={toggle}>
            Use {theme === 'light' ? 'dark' : 'light'} theme
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={logOut.isPending}
            onClick={() => logOut.mutate({})}
          >
            Sign out
          </Button>
        </div>
      </aside>
      <main className="min-w-0 px-5 py-8 lg:px-12">{children}</main>
    </div>
  );
}
