import { cn } from '@sync/ui/lib/utils';
import { Link } from '@tanstack/react-router';

export function Brand({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('flex items-center gap-2.5', className)}>
      <img src="/logo.png" alt="" className="h-6 w-auto" />
      <span className="font-heading text-[15px] font-semibold tracking-tight text-current">
        Sync
      </span>
    </Link>
  );
}
