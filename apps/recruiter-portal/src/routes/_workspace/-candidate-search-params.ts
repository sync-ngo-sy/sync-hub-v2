import { z } from 'zod';
import {
  type CandidateSearchFilters,
  type CandidateTab,
  type DirectoryOrder,
  orderFrom,
  tabFrom,
} from '@/features/candidates/search';

export const candidateSearchParams = z.object({
  tab: z.string().optional().catch(undefined),
  sort: z.string().optional().catch(undefined),
  q: z.string().optional().catch(undefined),
  location: z.string().optional().catch(undefined),
  languages: z.array(z.string()).optional().catch(undefined),
  skills: z.array(z.string()).optional().catch(undefined),
  role: z.string().optional().catch(undefined),
  experience: z.number().optional().catch(undefined),
  keywords: z.string().optional().catch(undefined),
});

export const candidateRecordSearchParams = candidateSearchParams.extend({
  from: z.string().optional().catch(undefined),
});

export type CandidateSearchParams = z.infer<typeof candidateSearchParams>;

export function filtersFrom(params: CandidateSearchParams): CandidateSearchFilters {
  return {
    q: params.q ?? '',
    location: params.location,
    languages: params.languages,
    skills: params.skills,
    role: params.role,
    experience: params.experience,
    keywords: params.keywords,
  };
}

export function candidateTabFrom(params: CandidateSearchParams): CandidateTab {
  return tabFrom(params.tab, params);
}

export function candidateOrderFrom(params: CandidateSearchParams): DirectoryOrder {
  return orderFrom(params.sort);
}
