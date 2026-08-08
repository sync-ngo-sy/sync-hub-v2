import type { components } from '@sync/api-client';
import type { StatusTone } from '@sync/ui/components/status-mark';
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
  if (!link.is_active) return { kind: 'off', label: 'Off', tone: 'ended' };
  if (link.expires_at && new Date(link.expires_at) <= now) {
    return { kind: 'expired', label: 'Expired', tone: 'ended' };
  }
  return { kind: 'live', label: 'Live', tone: 'active' };
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

export function viewsRanked(rows: Omit<LinkViews, 'fill'>[]): LinkViews[] {
  return [...rows]
    .sort((one, other) => other.views - one.views || one.name.localeCompare(other.name))
    .map((row, index) => ({ ...row, fill: RAMP[index] ?? PALEST_STEP }));
}

export const DIRECT = 'Direct';

export function directViews(links: TrackedLink[], jobViews: number): number {
  return Math.max(0, jobViews - totalViews(links));
}

export function viewsPerSource(links: TrackedLink[], jobViews: number): LinkViews[] {
  const direct = directViews(links, jobViews);
  const rows = links.map((link) => ({ id: link.id, name: link.name, views: link.view_count }));
  return viewsRanked(direct > 0 ? [...rows, { id: DIRECT, name: DIRECT, views: direct }] : rows);
}

export function totalViews(links: TrackedLink[]): number {
  return links.reduce((total, link) => total + link.view_count, 0);
}

export function viewShare(views: number, jobViews: number): string {
  return jobViews === 0 ? '—' : `${Math.round((views / jobViews) * 100)}%`;
}

export function viewsSummary(bars: LinkViews[]): string {
  const spoken = bars.slice(0, SPOKEN_AT_MOST);
  const rows = spoken.map(
    (bar) => `${bar.name}: ${bar.views} ${bar.views === 1 ? 'view' : 'views'}`,
  );
  const rest = bars.length - spoken.length;
  const tail =
    rest > 0 ? ` And ${rest} more ${rest === 1 ? 'source' : 'sources'}, further down.` : '';
  return `Views per source. ${rows.join('. ')}.${tail}`;
}

export type TenantTrackedLink = components['schemas']['TenantTrackedLink'];

export type LinkFilter = 'all' | 'live' | 'expired' | 'off';

interface FilterRule {
  label: string;
  active?: boolean;
  kind?: LinkStateKind;
}

export const LINK_FILTERS: Record<LinkFilter, FilterRule> = {
  all: { label: 'All' },
  live: { label: 'Live', active: true, kind: 'live' },
  expired: { label: 'Expired', active: true, kind: 'expired' },
  off: { label: 'Off', active: false },
};

export const LINK_FILTER_ORDER: LinkFilter[] = ['all', 'live', 'expired', 'off'];

export function activeFor(filter: LinkFilter): boolean | undefined {
  return LINK_FILTERS[filter].active;
}

export function linksMatching(
  links: TenantTrackedLink[],
  filter: LinkFilter,
  now: Date = new Date(),
): TenantTrackedLink[] {
  const { kind } = LINK_FILTERS[filter];
  if (kind === undefined) return links;
  return links.filter((link) => trackedLinkState(link, now).kind === kind);
}

export function hiddenByDate(links: TenantTrackedLink[], filter: LinkFilter): boolean {
  return links.length > 0 && linksMatching(links, filter).length === 0;
}
