import { z } from 'zod';
import { CLAIM_TABS, claimTab, type HireConfirmation, tabInAddress } from './placement';

export const placementsReading = z.object({
  tab: z.enum(CLAIM_TABS).optional().catch(undefined),
  job: z.uuid().optional().catch(undefined),
});

export type PlacementsReading = z.infer<typeof placementsReading>;

type Address<TReading> = { [K in keyof Required<TReading>]: TReading[K] };

export function placementsAddress(reading: PlacementsReading): Address<PlacementsReading> {
  return { tab: tabInAddress(reading.tab), job: reading.job };
}

/** The Job is the only filter here that cuts the list down: a tab is which of the three is being
 * read, and one of them is always being read. */
export function narrowedBy(reading: PlacementsReading): number {
  return reading.job === undefined ? 0 : 1;
}

const NO_CLAIMS: Record<HireConfirmation, string> = {
  confirmed:
    'No Placements yet — a hire your team records becomes one when the Candidate confirms it.',
  unanswered: 'Nothing is waiting — every hire your team has claimed has an answer.',
  denied: 'Nobody has denied a hire your team claimed.',
};

const NO_CLAIMS_ON_THE_JOB: Record<HireConfirmation, string> = {
  confirmed:
    'No Placements on this Job — a hire your team records becomes one when the Candidate confirms it.',
  unanswered: 'Nothing on this Job is waiting — every hire your team claimed on it has an answer.',
  denied: 'Nobody has denied a hire your team claimed on this Job.',
};

export function noClaimsMessage(reading: PlacementsReading): string {
  return (narrowedBy(reading) > 0 ? NO_CLAIMS_ON_THE_JOB : NO_CLAIMS)[claimTab(reading.tab)];
}
