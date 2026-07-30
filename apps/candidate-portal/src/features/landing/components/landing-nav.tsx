import { Button } from '@sync/ui/components/ui/button';
import { cn } from '@sync/ui/lib/utils';
import { Link } from '@tanstack/react-router';
import { WRAP } from '../wrap';
import { BrandMark } from './brand-mark';

export function LandingNav() {
  return (
    <nav className="sticky top-0 z-10 border-b border-border bg-background">
      <div className={cn(WRAP, 'flex h-[76px] items-center justify-between')}>
        <BrandMark />
        <div className="hidden items-center gap-8 text-sm font-medium text-muted-foreground sm:flex">
          <Link to="/jobs" className="hover:text-foreground">
            Browse jobs
          </Link>
          <a href="#employers" className="hover:text-foreground">
            For employers
          </a>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            render={
              <Link to="/login" search={{ returnTo: undefined }}>
                Log in
              </Link>
            }
          />
          <Button size="sm" render={<Link to="/signup">Create account</Link>} />
        </div>
      </div>
    </nav>
  );
}
