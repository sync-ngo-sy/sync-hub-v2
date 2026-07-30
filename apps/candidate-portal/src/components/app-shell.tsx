import { Button } from '@sync/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@sync/ui/components/ui/dropdown-menu';
import { Skeleton } from '@sync/ui/components/ui/skeleton';
import { Link } from '@tanstack/react-router';
import { LogOut, Moon, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
import { useLogout } from '../features/auth/hooks/use-logout';
import { useProfile } from '../features/auth/hooks/use-profile';
import { useTheme } from '../lib/theme';

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={toggleTheme}
    >
      {theme === 'dark' ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </Button>
  );
}

function AccountMenu() {
  const { data: profile, isPending } = useProfile();
  const logout = useLogout();

  if (isPending) return <Skeleton className="size-8 rounded-full" />;

  if (!profile) {
    return (
      <Button
        size="sm"
        render={
          <Link to="/login" search={{ returnTo: undefined }}>
            Log in
          </Link>
        }
      />
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" aria-label={`Account menu for ${profile.full_name}`}>
            {profile.full_name}
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => void logout()}>
          <LogOut aria-hidden />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border bg-background px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-heading font-medium">
          <img src="/logo.png" alt="" className="size-6" />
          Sync
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <AccountMenu />
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
