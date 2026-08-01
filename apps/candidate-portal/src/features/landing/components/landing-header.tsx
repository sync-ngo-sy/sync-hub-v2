import { Button, buttonVariants } from '@sync/ui/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@sync/ui/components/ui/sheet';
import { cn } from '@sync/ui/lib/utils';
import { Link } from '@tanstack/react-router';
import { Menu } from 'lucide-react';
import { useState } from 'react';
import { Brand } from '@/features/shell/components/brand';
import { ThemeToggle } from '@/features/shell/components/theme-toggle';
import { env } from '@/lib/env';
import { NAV_BUTTON, Wrap } from './editorial';

export function LandingHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background">
      <Wrap className="flex h-19 items-center justify-between gap-4">
        <Brand />

        <nav
          aria-label="Site"
          className="hidden items-center gap-8 text-dense font-medium text-secondary-foreground sm:flex"
        >
          <Link to="/jobs" className="hover:text-foreground">
            Browse jobs
          </Link>
          <a href={env.recruiterPortalUrl} className="hover:text-foreground">
            For employers
          </a>
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <Link to="/login" className={cn(buttonVariants({ variant: 'ghost' }), NAV_BUTTON)}>
            Sign in
          </Link>
          <Link to="/signup" className={cn(buttonVariants(), NAV_BUTTON, 'hidden sm:inline-flex')}>
            Create account
          </Link>

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" aria-label="Open menu" className="sm:hidden" />
              }
            >
              <Menu />
            </SheetTrigger>
            <SheetContent side="right" className="w-72 gap-6 p-6 pt-14">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <SheetDescription className="sr-only">
                Browse Sync, or create your profile.
              </SheetDescription>
              <div className="-mx-2 flex flex-col text-reading font-medium text-secondary-foreground">
                <Link
                  to="/jobs"
                  onClick={close}
                  className="rounded-lg px-2 py-2.5 hover:text-foreground"
                >
                  Browse jobs
                </Link>
                <a
                  href={env.recruiterPortalUrl}
                  onClick={close}
                  className="rounded-lg px-2 py-2.5 hover:text-foreground"
                >
                  For employers
                </a>
              </div>
              <Link to="/signup" onClick={close} className={cn(buttonVariants(), NAV_BUTTON)}>
                Create account
              </Link>
            </SheetContent>
          </Sheet>
        </div>
      </Wrap>
    </header>
  );
}
