const RELATIVE = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const ABSOLUTE = new Intl.DateTimeFormat('en', { dateStyle: 'long' });

const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: 'second' },
  { amount: 60, unit: 'minute' },
  { amount: 24, unit: 'hour' },
  { amount: 7, unit: 'day' },
  { amount: 4.34524, unit: 'week' },
  { amount: 12, unit: 'month' },
  { amount: Number.POSITIVE_INFINITY, unit: 'year' },
];

/**
 * A posted date as a list shows it: a relative label ("2 days ago") for the eye, and the absolute
 * date for the `title` on hover, per the UX conventions (§7.7). `Intl` only — no date library.
 */
export function formatPosted(iso: string): { relative: string; absolute: string } {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { relative: '', absolute: '' };

  let delta = (date.getTime() - Date.now()) / 1000;
  for (const { amount, unit } of DIVISIONS) {
    if (Math.abs(delta) < amount) {
      return {
        relative: RELATIVE.format(Math.round(delta), unit),
        absolute: ABSOLUTE.format(date),
      };
    }
    delta /= amount;
  }
  return { relative: RELATIVE.format(Math.round(delta), 'year'), absolute: ABSOLUTE.format(date) };
}
