import { z } from 'zod';
import type { CandidateSearchFilters } from '@/features/candidates/search';

export const candidateSearchParams = z.object({
  q: z.string().optional().catch(undefined),
  location: z.string().optional().catch(undefined),
  languages: z.array(z.string()).optional().catch(undefined),
  keywords: z.string().optional().catch(undefined),
});

export type CandidateSearchParams = z.infer<typeof candidateSearchParams>;

export function filtersFrom(params: CandidateSearchParams): CandidateSearchFilters {
  return {
    q: params.q ?? '',
    location: params.location,
    languages: params.languages,
    keywords: params.keywords,
  };
}
