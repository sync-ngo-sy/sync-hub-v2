import { cn } from '@sync/ui/lib/utils';
import { Link, type LinkProps } from '@tanstack/react-router';

export function Brand({
  className,
  nameHidden,
  to = '/',
}: {
  className?: string;
  nameHidden?: boolean;
  to?: LinkProps['to'];
}) {
  return (
    <Link to={to} className={cn('flex items-center gap-2.5', className)}>
      <img src="/logo.png" alt="" className="h-6 w-auto" />
      <span
        className={cn(
          'font-heading text-[15px] font-semibold tracking-tight text-current',
          nameHidden && 'sr-only',
        )}
      >
        Sync Hub
      </span>
    </Link>
  );
}
