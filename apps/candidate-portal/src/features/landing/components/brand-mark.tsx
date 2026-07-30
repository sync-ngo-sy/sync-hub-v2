import { cn } from '@sync/ui/lib/utils';
import { Link } from '@tanstack/react-router';

export function BrandMark({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={cn(
        'flex items-center gap-2.5 font-heading text-base font-semibold text-foreground',
        className,
      )}
    >
      <img src="/logo.png" alt="" className="w-6" />
      Sync
    </Link>
  );
}
