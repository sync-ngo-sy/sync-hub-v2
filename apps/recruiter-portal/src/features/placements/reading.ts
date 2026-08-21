import { z } from 'zod';
import { CLAIM_TABS, tabInAddress } from './placement';

export const placementsReading = z.object({
  tab: z.enum(CLAIM_TABS).optional().catch(undefined),
});

export type PlacementsReading = z.infer<typeof placementsReading>;

type Address<TReading> = { [K in keyof Required<TReading>]: TReading[K] };

export function placementsAddress(reading: PlacementsReading): Address<PlacementsReading> {
  return { tab: tabInAddress(reading.tab) };
}
