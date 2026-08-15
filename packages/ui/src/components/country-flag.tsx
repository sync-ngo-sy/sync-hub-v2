import { cn } from '@sync/ui/lib/utils';
import * as flags from 'country-flag-icons/string/3x2';

const DRAWN: Record<string, string> = Object.fromEntries(
  Object.entries(flags as unknown as Record<string, string>).map(([country, svg]) => [
    country,
    `data:image/svg+xml,${encodeURIComponent(svg)}`,
  ]),
);

export function CountryFlag({ country, className }: { country: string; className?: string }) {
  const drawn = DRAWN[country];
  if (!drawn) return null;

  return (
    <img
      src={drawn}
      alt=""
      className={cn('h-3.5 w-5 shrink-0 rounded-xs object-cover', className)}
    />
  );
}
