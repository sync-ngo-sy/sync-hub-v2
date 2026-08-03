const RELATIVE = new Intl.RelativeTimeFormat('en', { numeric: 'always' });
const ABSOLUTE = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });
const RELATIVE_UNITS: [limit: number, unit: Intl.RelativeTimeFormatUnit][] = [
  [60, 'second'],
  [60, 'minute'],
  [24, 'hour'],
  [30, 'day'],
  [12, 'month'],
  [Number.POSITIVE_INFINITY, 'year'],
];

export function relativeTime(value: string, now: Date = new Date()): string {
  let amount = (new Date(value).getTime() - now.getTime()) / 1_000;
  if (Math.abs(amount) < 60) return 'just now';

  const round = (part: number) => Math.sign(part) * Math.round(Math.abs(part));
  for (const [limit, unit] of RELATIVE_UNITS) {
    if (Math.abs(amount) < limit) return RELATIVE.format(round(amount), unit);
    amount /= limit;
  }
  return RELATIVE.format(round(amount), 'year');
}

export function absoluteDateTime(value: string): string {
  return ABSOLUTE.format(new Date(value));
}
