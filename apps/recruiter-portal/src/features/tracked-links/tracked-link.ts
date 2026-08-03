import type { components } from '@sync/api-client';
import type { StatusTone } from '@sync/ui/components/status-chip';
import { env } from '@/lib/env';

export type TrackedLink = components['schemas']['TrackedLink'];
export type NewTrackedLink = components['schemas']['NewTrackedLink'];
export type TrackedLinkChanges = components['schemas']['TrackedLinkChanges'];

export function trackedLinkAddress(token: string): string {
  return new URL(`/l/${token}`, env.candidatePortalUrl).toString();
}

interface TrackedLinkState {
  label: string;
  tone: StatusTone;
}

export function trackedLinkState(link: TrackedLink, now: Date = new Date()): TrackedLinkState {
  if (!link.is_active) return { label: 'Off', tone: 'neutral' };
  if (link.expires_at && new Date(link.expires_at) <= now) {
    return { label: 'Expired', tone: 'neutral' };
  }
  return { label: 'Live', tone: 'positive' };
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

export function viewsPerLink(links: TrackedLink[]): LinkViews[] {
  return [...links]
    .sort((one, other) => other.view_count - one.view_count || one.name.localeCompare(other.name))
    .map((link, index) => ({
      id: link.id,
      name: link.name,
      views: link.view_count,
      fill: RAMP[index] ?? PALEST_STEP,
    }));
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
