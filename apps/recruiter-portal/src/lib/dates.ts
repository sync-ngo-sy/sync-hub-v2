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

const CALENDAR_DAY = new Intl.DateTimeFormat('en', { dateStyle: 'long' });

export function absoluteDate(value: string): string {
  return CALENDAR_DAY.format(new Date(value));
}

export function calendarDay(value: string): string {
  // Built from the parts rather than parsed: `new Date('2026-09-01')` is UTC midnight, which
  // renders as the day before anywhere west of Greenwich.
  const [year = 0, month = 1, day = 1] = value.split('-').map(Number);
  return CALENDAR_DAY.format(new Date(year, month - 1, day));
}

export function absoluteDay(value: string): string {
  return CALENDAR_DAY.format(new Date(value));
}
