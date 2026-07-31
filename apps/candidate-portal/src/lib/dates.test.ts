import { describe, expect, it } from 'vitest';
import { absoluteDateTime, relativeTime } from './dates';

const NOW = new Date('2026-07-31T12:00:00Z');

function ago(milliseconds: number): string {
  return new Date(NOW.getTime() - milliseconds).toISOString();
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('a relative time', () => {
  it('says nothing more precise than "just now" inside the first minute', () => {
    expect(relativeTime(ago(2 * SECOND), NOW)).toBe('just now');
    expect(relativeTime(ago(59 * SECOND), NOW)).toBe('just now');
  });

  it('reads as a plain count of the largest unit that fits', () => {
    expect(relativeTime(ago(90 * MINUTE), NOW)).toBe('2 hours ago');
    expect(relativeTime(ago(3 * HOUR), NOW)).toBe('3 hours ago');
    expect(relativeTime(ago(DAY), NOW)).toBe('1 day ago');
    expect(relativeTime(ago(2 * DAY), NOW)).toBe('2 days ago');
  });

  it('keeps counting in days past a week, where a job posting is still read as recent', () => {
    expect(relativeTime(ago(9 * DAY), NOW)).toBe('9 days ago');
  });

  it('steps up to months and years once days stop being useful', () => {
    expect(relativeTime(ago(45 * DAY), NOW)).toBe('2 months ago');
    expect(relativeTime(ago(400 * DAY), NOW)).toBe('1 year ago');
  });

  it('reads a clock-skewed future timestamp as "just now" rather than a countdown', () => {
    expect(relativeTime(new Date(NOW.getTime() + 30 * SECOND).toISOString(), NOW)).toBe('just now');
  });
});

describe('an absolute date and time', () => {
  it('spells the date out for the hover title behind a relative one', () => {
    const title = absoluteDateTime('2026-07-29T09:00:00Z');

    expect(title).toMatch(/2026/);
    expect(title).not.toBe('2026-07-29T09:00:00Z');
  });
});
