const RELATIVE = new Intl.RelativeTimeFormat(undefined, { numeric: 'always' });
const ABSOLUTE = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const UNITS: [limit: number, unit: Intl.RelativeTimeFormatUnit][] = [
  [60, 'second'],
  [60, 'minute'],
  [24, 'hour'],
  [30, 'day'],
  [12, 'month'],
  [Number.POSITIVE_INFINITY, 'year'],
];

export function relativeTime(iso: string, now: Date = new Date()): string {
  let amount = (new Date(iso).getTime() - now.getTime()) / 1000;
  if (Math.abs(amount) < 60) return 'just now';

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
