const RELATIVE = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: 'second' },
  { amount: 60, unit: 'minute' },
  { amount: 24, unit: 'hour' },
  { amount: 7, unit: 'day' },
  { amount: 4.34524, unit: 'week' },
  { amount: 12, unit: 'month' },
  { amount: Number.POSITIVE_INFINITY, unit: 'year' },
];

export function formatRelativeDate(iso: string): string {
  let duration = (new Date(iso).getTime() - Date.now()) / 1000;
  for (const { amount, unit } of DIVISIONS) {
    if (Math.abs(duration) < amount) return RELATIVE.format(Math.round(duration), unit);
    duration /= amount;
  }
  return RELATIVE.format(Math.round(duration), 'year');
}

const ABSOLUTE = new Intl.DateTimeFormat('en', { dateStyle: 'long' });

export function formatAbsoluteDate(iso: string): string {
  return ABSOLUTE.format(new Date(iso));
}

export function humanizeEmploymentType(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}
