import { Button } from '@sync/ui/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@sync/ui/components/ui/sheet';
import { Menu } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import type { Profile } from '@/features/auth/current-profile';
import { Brand } from './brand';
import { Sidebar } from './sidebar';

export function AppShell({ profile, children }: { profile: Profile; children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 hidden h-dvh border-r border-sidebar-border lg:block">
        <Sidebar profile={profile} />
      </aside>

      <header className="flex items-center gap-3 border-b border-border px-4 py-3 lg:hidden">
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger
            render={<Button variant="outline" size="icon" aria-label="Open navigation" />}
          >
            <Menu />
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0" showCloseButton={false}>
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SheetDescription className="sr-only">
              Move between the workspace's sections.
            </SheetDescription>
            <Sidebar profile={profile} onNavigate={() => setDrawerOpen(false)} />
          </SheetContent>
        </Sheet>
        <Brand />
      </header>

      <main className="min-w-0 px-5 py-8 lg:max-w-[1440px] lg:px-12 lg:py-10 lg:pb-16">
        {children}
      </main>
    </div>
  );
}
