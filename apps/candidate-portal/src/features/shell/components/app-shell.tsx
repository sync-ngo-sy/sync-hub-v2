import type { ReactNode } from 'react';
import type { Profile } from '@/features/auth/current-profile';
import { NotificationBell } from '@/features/notifications/components/notification-bell';
import { AccountMenu } from './account-menu';
import { Brand } from './brand';
import { PrimaryNav } from './primary-nav';
import { ThemeToggle } from './theme-toggle';

export function AppShell({ profile, children }: { profile: Profile; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3 md:max-w-5xl md:px-6">
          <Brand />
          <PrimaryNav />
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell />
            <ThemeToggle />
            <AccountMenu profile={profile} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-24 md:max-w-5xl md:px-6 md:pt-10 md:pb-16">
        {children}
      </main>
    </div>
  );
}
