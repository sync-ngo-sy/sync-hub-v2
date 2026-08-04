import type { components } from '@sync/api-client';

export type TenantStats = components['schemas']['TenantStats'];
export type TenantApplication = components['schemas']['TenantApplicationSummary'];
export type Source = components['schemas']['Source'];

/** What the table has room for, and so what the API is asked for. */
export const RECENT_APPLICATIONS = 6;

/** What the overview list has room for, out of the first page of Jobs. */
export const OVERVIEW_JOBS = 5;

export interface Trend {
  label: string;
  tone?: 'positive' | 'caution' | 'neutral';
}

export function openedThisWeek(count: number): Trend {
  return count === 0
    ? { label: 'None opened this week' }
    : { label: `+${count} since last week`, tone: 'positive' };
}

/** This week against the one before it. Both windows come from the API, measured from one
 * clock — the difference is the only thing left to work out. */
export function weekOnWeek(thisWeek: number, lastWeek: number): Trend {
  const change = thisWeek - lastWeek;
  if (change === 0) return { label: 'Same as last week' };
  return {
    label: `${change > 0 ? '+' : ''}${change} vs last week`,
    tone: change > 0 ? 'positive' : 'neutral',
  };
}

export function awaitingReview(count: number): Trend {
  return count === 0 ? { label: 'Nothing waiting' } : { label: 'Needs attention', tone: 'caution' };
}

export function passRate(rate: number | null | undefined): Trend {
  return rate === null || rate === undefined
    ? { label: 'No verdict decided yet' }
    : { label: `${rate}% pass rate` };
}

export function applicants(count: number): string {
  return count === 1 ? '1 application' : `${count} applications`;
}

/** What the card is not showing. The endpoint ranks the Sources, caps them at what the card
 * holds, and says how many there were — so the card names the remainder rather than letting
 * six look like all of them. */
export function beyondTheCard(shown: number, all: number): string | null {
  const rest = all - shown;
  if (rest <= 0) return null;
  return `${rest} more ${rest === 1 ? 'channel' : 'channels'} on the Tracked links page.`;
}
