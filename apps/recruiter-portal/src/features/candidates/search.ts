import { said } from '@/lib/said';

export interface CandidateSearchFilters {
  q: string;
  location?: string;
  language?: string;
  keywords?: string;
}

export const MIN_QUERY_LENGTH = 2;

export const SEARCH_LIMIT = 20;

function set(value: string | undefined): string | undefined {
  return said(value)?.trim();
}

export function isAsked(filters: CandidateSearchFilters): boolean {
  return filters.q.trim().length >= MIN_QUERY_LENGTH;
}

export function searchQuery(filters: CandidateSearchFilters) {
  return {
    q: filters.q.trim(),
    location_key: set(filters.location),
    language: set(filters.language),
    keywords: set(filters.keywords),
    limit: SEARCH_LIMIT,
  };
}

/** An unset filter is left off the address rather than left blank in it. */
export function searchAddress(filters: CandidateSearchFilters) {
  return {
    q: set(filters.q),
    location: set(filters.location),
    language: set(filters.language),
    keywords: set(filters.keywords),
  };
}

export function hardFilterCount(filters: CandidateSearchFilters): number {
  return [filters.location, filters.language, filters.keywords].filter((value) => set(value))
    .length;
}

export function noMatchesMessage(filters: CandidateSearchFilters): string {
  const narrowing = hardFilterCount(filters);
  if (narrowing === 0) {
    return 'No Searchable Candidate matches those words. Plainer words reach more people.';
  }
  return narrowing === 1
    ? 'No Searchable Candidate matches those words with that filter.'
    : 'No Searchable Candidate matches those words with those filters.';
}
