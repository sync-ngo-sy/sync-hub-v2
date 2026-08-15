import { cn } from '@sync/ui/lib/utils';
import type { ReactNode } from 'react';
import type { Profile } from '@/features/auth/current-profile';
import { NotificationBell } from '@/features/notifications/components/notification-bell';
import { MEASURE } from '../measure';
import { AccountMenu } from './account-menu';
import { Brand } from './brand';
import { PrimaryNav } from './primary-nav';
import { ThemeToggle } from './theme-toggle';

export function AppShell({ profile, children }: { profile: Profile; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-background">
        <div
          className={cn('mx-auto flex w-full items-center gap-3 px-(--space-gutter) py-3', MEASURE)}
        >
          <Brand to="/applications" />
          <PrimaryNav />
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell />
            <ThemeToggle />
            <AccountMenu profile={profile} />
          </div>
        </div>
      </header>

      <main
        className={cn(
          'mx-auto w-full flex-1 px-(--space-gutter) pt-(--space-section) pb-24 md:pb-16',
          MEASURE,
        )}
      >
        {children}
      </main>
    </div>
  );
}
