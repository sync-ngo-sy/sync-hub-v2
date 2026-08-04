import type { components } from '@sync/api-client';

export type TenantStats = components['schemas']['TenantStats'];
export type TenantApplication = components['schemas']['TenantApplicationSummary'];

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

const EVERY_CHANNEL = 'Job views each channel brought, added up across your Jobs.';

/** What the card is showing, out of what there was — the endpoint caps the Sources it returns at
 * what fits here and says how many there were.
 *
 * It goes in the card's own subtitle rather than on the link beside it. The count is of Sources,
 * which are link names merged across Jobs, and the link leads to the Tracked links page, which
 * lists links one by one: eleven channels may be thirty links, and `Direct` is no link at all.
 * A number on that link would be describing something other than where it goes.
 */
export function sourcesSubtitle(stats: TenantStats | undefined): string {
  if (!stats || stats.sources_total <= stats.sources.length) return EVERY_CHANNEL;
  return `Your busiest ${stats.sources.length} of ${stats.sources_total} channels, by the Job views each brought.`;
}
