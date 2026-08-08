import { z } from 'zod';
import { orderFrom, type PoolReading } from '@/features/talent-pool/pool';

export const talentPoolSearchParams = z.object({
  q: z.string().optional().catch(undefined),
  sort: z.string().optional().catch(undefined),
});

export type TalentPoolSearchParams = z.infer<typeof talentPoolSearchParams>;

export function readingFrom(params: TalentPoolSearchParams): PoolReading {
  return { q: params.q ?? '', order: orderFrom(params.sort) };
}
