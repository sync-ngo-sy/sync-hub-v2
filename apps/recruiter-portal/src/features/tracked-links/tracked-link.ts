import type { components } from '@sync/api-client';
import type { StatusTone } from '@sync/ui/components/status-chip';
import { env } from '@/lib/env';

export type TrackedLink = components['schemas']['TrackedLink'];
export type NewTrackedLink = components['schemas']['NewTrackedLink'];
export type TrackedLinkChanges = components['schemas']['TrackedLinkChanges'];

export function trackedLinkAddress(token: string): string {
  return new URL(`/l/${token}`, env.candidatePortalUrl).toString();
}

export type LinkStateKind = 'live' | 'expired' | 'off';

interface TrackedLinkState {
  kind: LinkStateKind;
  label: string;
  tone: StatusTone;
}

export function trackedLinkState(link: TrackedLink, now: Date = new Date()): TrackedLinkState {
  if (!link.is_active) return { kind: 'off', label: 'Off', tone: 'neutral' };
  if (link.expires_at && new Date(link.expires_at) <= now) {
    return { kind: 'expired', label: 'Expired', tone: 'neutral' };
  }
  return { kind: 'live', label: 'Live', tone: 'positive' };
}

export interface LinkViews {
  id: string;
  name: string;
  views: number;
  fill: string;
}

const PALEST_STEP = 'var(--chart-4)';
const RAMP = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', PALEST_STEP];
const SPOKEN_AT_MOST = 8;

/** Anything countable, ranked and given the chart's ramp. Both charts draw the same bars — the
 * Job's own links here, the tenant's merged channels on the Dashboard — so the ordering and the
 * colours are decided once. */
export function viewsRanked(rows: Omit<LinkViews, 'fill'>[]): LinkViews[] {
  return [...rows]
    .sort((one, other) => other.views - one.views || one.name.localeCompare(other.name))
    .map((row, index) => ({ ...row, fill: RAMP[index] ?? PALEST_STEP }));
}

export function viewsPerLink(links: TrackedLink[]): LinkViews[] {
  return viewsRanked(
    links.map((link) => ({ id: link.id, name: link.name, views: link.view_count })),
  );
}

export function totalViews(links: TrackedLink[]): number {
  return links.reduce((total, link) => total + link.view_count, 0);
}

export function viewsSummary(bars: LinkViews[]): string {
  const spoken = bars.slice(0, SPOKEN_AT_MOST);
  const rows = spoken.map(
    (bar) => `${bar.name}: ${bar.views} ${bar.views === 1 ? 'view' : 'views'}`,
  );
  const rest = bars.length - spoken.length;
  const tail = rest > 0 ? ` And ${rest} more ${rest === 1 ? 'link' : 'links'}, further down.` : '';
  return `Views per tracked link. ${rows.join('. ')}.${tail}`;
}

export type TenantTrackedLink = components['schemas']['TenantTrackedLink'];

/** The four views of the tenant's links. `off` is a column the API can filter on; `live` and
 * `expired` are the same column plus a date, which the row already carries. */
export type LinkFilter = 'all' | 'live' | 'expired' | 'off';

export const LINK_FILTERS: { value: LinkFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'live', label: 'Live' },
  { value: 'expired', label: 'Expired' },
  { value: 'off', label: 'Off' },
];

/** What the endpoint can narrow. `live` and `expired` are both switched on, so both ask for the
 * same rows and are told apart here rather than costing the query a clock. */
export function activeFor(filter: LinkFilter): boolean | undefined {
  if (filter === 'all') return undefined;
  return filter !== 'off';
}

export function linksMatching(
  links: TenantTrackedLink[],
  filter: LinkFilter,
  now: Date = new Date(),
): TenantTrackedLink[] {
  if (filter === 'all' || filter === 'off') return links;
  return links.filter((link) => trackedLinkState(link, now).kind === filter);
}
