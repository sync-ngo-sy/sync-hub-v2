import { Button } from '@sync/ui/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@sync/ui/components/ui/sheet';
import { useSidebarRail } from '@sync/ui/hooks/use-sidebar-rail';
import { Menu } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import type { Profile } from '@/features/auth/current-profile';
import { Brand } from './brand';
import { Sidebar } from './sidebar';

const RAIL_STORAGE_KEY = 'sync-recruiter-sidebar';

export function AppShell({ profile, children }: { profile: Profile; children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { collapsed, toggle } = useSidebarRail(RAIL_STORAGE_KEY);

  return (
    <div
      className={
        collapsed
          ? 'min-h-dvh lg:grid lg:grid-cols-[4rem_minmax(0,1fr)]'
          : 'min-h-dvh lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]'
      }
    >
      <aside className="sticky top-0 hidden h-dvh border-r border-sidebar-border lg:block">
        <Sidebar profile={profile} collapsed={collapsed} onToggleRail={toggle} />
      </aside>

      <header className="flex items-center gap-3 border-b border-border px-(--space-gutter) py-3 lg:hidden">
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

      <main className="min-w-0 px-(--space-gutter) py-(--space-section) lg:pb-16">{children}</main>
    </div>
  );
}
