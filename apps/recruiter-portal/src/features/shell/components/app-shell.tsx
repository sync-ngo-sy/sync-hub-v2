import { Button } from '@sync/ui/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@sync/ui/components/ui/sheet';
import { Menu } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import type { Profile } from '@/features/auth/current-profile';
import { AppSidebar } from './app-sidebar';
import { Brand } from './brand';

export function AppShell({ profile, children }: { profile: Profile; children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      <AppSidebar profile={profile} className="sticky top-0 hidden h-dvh lg:flex" />

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-40 flex items-center gap-2 border-b border-border bg-background/90 px-4 py-2.5 backdrop-blur lg:hidden">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger
              render={<Button variant="ghost" size="icon" aria-label="Open navigation" />}
            >
              <Menu />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 max-w-[85vw] bg-sidebar p-0 sm:max-w-72">
              <SheetTitle className="sr-only">Workspace navigation</SheetTitle>
              <AppSidebar
                profile={profile}
                className="border-e-0"
                onNavigate={() => setDrawerOpen(false)}
              />
            </SheetContent>
          </Sheet>
          <Brand />
        </header>

        <main className="mx-auto w-full max-w-[90rem] flex-1 px-5 py-6 lg:px-12 lg:pt-10 lg:pb-16">
          {children}
        </main>
      </div>
    </div>
  );
}
