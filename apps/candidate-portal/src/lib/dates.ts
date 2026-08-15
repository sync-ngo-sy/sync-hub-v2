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

const CALENDAR_DAY = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' });

export function calendarDay(iso: string): string {
  // Built from the parts rather than parsed: `new Date('2026-09-01')` is UTC midnight, which
  // renders as the day before anywhere west of Greenwich.
  const [year = 0, month = 1, day = 1] = iso.split('-').map(Number);
  return CALENDAR_DAY.format(new Date(year, month - 1, day));
}
