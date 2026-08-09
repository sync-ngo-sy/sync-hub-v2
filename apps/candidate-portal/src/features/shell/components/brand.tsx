import { cn } from '@sync/ui/lib/utils';
import { Link, type LinkProps } from '@tanstack/react-router';

export function Brand({ className, to = '/' }: { className?: string; to?: LinkProps['to'] }) {
  return (
    <Link to={to} className={cn('flex shrink-0 items-center gap-2.5', className)}>
      <img src="/logo.png" alt="" className="h-6 w-auto" />
      <span className="font-heading text-[15px] font-semibold tracking-tight text-foreground">
        Sync Hub
      </span>
    </Link>
  );
}
