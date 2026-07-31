import { Button } from '@sync/ui/components/ui/button';
import { cn } from '@sync/ui/lib/utils';
import { Link } from '@tanstack/react-router';
import { ThemeToggle } from '@/features/shell/components/theme-toggle';
import { WRAP } from '../wrap';
import { BrandMark } from './brand-mark';

export function LandingNav() {
  return (
    <nav className="sticky top-0 z-10 border-b border-border bg-background">
      <div className={cn(WRAP, 'flex h-[76px] items-center justify-between')}>
        <BrandMark />
        <div className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
          <a href="#how-it-works" className="hover:text-foreground">
            How it works
          </a>
          <a href="#contact" className="hover:text-foreground">
            Contact
          </a>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            render={
              <Link to="/login" search={{ returnTo: undefined }}>
                Log in
              </Link>
            }
          />
          <Button size="sm" render={<Link to="/signup">Create workspace</Link>} />
        </div>
      </div>
    </nav>
  );
}
