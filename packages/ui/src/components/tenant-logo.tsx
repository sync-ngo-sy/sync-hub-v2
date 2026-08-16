import { cn } from '@sync/ui/lib/utils';

const SIZES = {
  sm: 'size-8 text-[11px]',
  default: 'size-10 text-sm',
  lg: 'size-14 text-base',
} as const;

export type TenantLogoSize = keyof typeof SIZES;

interface TenantLogoProps {
  name: string;
  logoUrl?: string | null;
  size?: TenantLogoSize;
  className?: string;
}

/** A Tenant's mark wherever one of its Jobs appears. Square rather than round, so it is never
 * read as somebody's face, and lettered until the Tenant uploads one. */
export function TenantLogo({ name, logoUrl, size = 'default', className }: TenantLogoProps) {
  return (
    <span
      data-slot="tenant-logo"
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted',
        SIZES[size],
        className,
      )}
    >
      {logoUrl ? (
        <img src={logoUrl} alt="" className="size-full object-cover" />
      ) : (
        <span aria-hidden="true" className="font-semibold text-muted-foreground">
          {initials(name)}
        </span>
      )}
    </span>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
