import { cn } from '@sync/ui/lib/utils';

export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <img src="/logo.png" alt="" className="size-6" />
      <span className="font-heading text-[0.9375rem] font-strong tracking-tight text-foreground">
        Sync
      </span>
    </span>
  );
}
