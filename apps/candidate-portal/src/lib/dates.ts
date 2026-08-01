const RELATIVE = new Intl.RelativeTimeFormat(undefined, { numeric: 'always' });
const ABSOLUTE = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** Days run to 30 rather than to a week, so a fortnight-old posting still reads in days. */
const UNITS: [limit: number, unit: Intl.RelativeTimeFormatUnit][] = [
  [60, 'second'],
  [60, 'minute'],
  [24, 'hour'],
  [30, 'day'],
  [12, 'month'],
  [Number.POSITIVE_INFINITY, 'year'],
];

/** Lists carry these, with {@link absoluteDateTime} as the hover title (§7.7). */
export function relativeTime(iso: string, now: Date = new Date()): string {
  let amount = (new Date(iso).getTime() - now.getTime()) / 1000;
  if (Math.abs(amount) < 60) return 'just now';

  // Rounded away from zero, or Math.round would read 1.5 days back as one day and 1.5 ahead as two.
  const round = (value: number) => Math.sign(value) * Math.round(Math.abs(value));

  for (const [limit, unit] of UNITS) {
    if (Math.abs(amount) < limit) return RELATIVE.format(round(amount), unit);
    amount /= limit;
  }
  return RELATIVE.format(round(amount), 'year');
}

export function absoluteDateTime(iso: string): string {
  return ABSOLUTE.format(new Date(iso));
}
