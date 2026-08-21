import type { components } from '@sync/api-client';
import type { StatusTone } from '@sync/ui/components/status-mark';
import { absoluteDay } from '@/lib/dates';

export type HireClaim = components['schemas']['TenantHireClaim'];
export type HireConfirmation = components['schemas']['HireConfirmation'];

export const CLAIM_TABS = [
  'confirmed',
  'unanswered',
  'denied',
] as const satisfies readonly HireConfirmation[];

export const DEFAULT_TAB: HireConfirmation = 'confirmed';

const TAB_LABEL: Record<HireConfirmation, string> = {
  confirmed: 'Placements',
  unanswered: 'Waiting',
  denied: 'Denied',
};

export function tabLabel(tab: HireConfirmation): string {
  return TAB_LABEL[tab];
}

export function claimTab(chosen: HireConfirmation | undefined): HireConfirmation {
  return chosen ?? DEFAULT_TAB;
}

export function tabInAddress(tab: HireConfirmation | undefined): HireConfirmation | undefined {
  return tab === DEFAULT_TAB ? undefined : tab;
}

export type FilterableJob = components['schemas']['FilterableJob'];

/** What the Job filter reads while it is narrowing nothing. Never a Job id, so no Job can be
 * mistaken for it. */
export const EVERY_JOB = 'every';

export function jobSelection(chosen: string | undefined): string {
  return chosen ?? EVERY_JOB;
}

export function oneJob(chosen: string): string | undefined {
  return chosen === EVERY_JOB ? undefined : chosen;
}

export function jobChoices(jobs: FilterableJob[]): Record<string, string> {
  return {
    [EVERY_JOB]: 'Every Job',
    ...Object.fromEntries(jobs.map((job) => [job.id, job.title])),
  };
}

interface ClaimState {
  label: string;
  tone: StatusTone;
}

const ANSWERED: Record<Exclude<HireConfirmation, 'unanswered'>, ClaimState> = {
  confirmed: { label: 'Confirmed', tone: 'active' },
  denied: { label: 'Denied', tone: 'ended' },
};

export function claimState(claim: HireClaim): ClaimState {
  if (claim.confirmation === 'unanswered') {
    return { label: `Waiting since ${absoluteDay(claim.claimed_at)}`, tone: 'waiting' };
  }
  return ANSWERED[claim.confirmation];
}

export type ClaimCounts = Partial<Record<HireConfirmation, number>>;

export function claimCountsFrom(
  counted: { confirmation: HireConfirmation; count: number }[] | undefined,
): ClaimCounts {
  return Object.fromEntries(
    (counted ?? []).map((one) => [one.confirmation, one.count]),
  ) as ClaimCounts;
}
