import { cn } from '@sync/ui/lib/utils';

/** The mark is decorative: the "Sync" wordmark beside it already carries the name. */
export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <img src="/logo.png" alt="" className="size-6" />
      <span className="font-heading text-[0.9375rem] font-semibold tracking-tight text-foreground">
        Sync
      </span>
    </span>
  );
}
