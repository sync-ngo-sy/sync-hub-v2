import { said } from '@/lib/said';

export interface CandidateSearchFilters {
  q: string;
  location?: string;
  languages?: string[];
  keywords?: string;
}

export const MIN_QUERY_LENGTH = 2;

export const SEARCH_LIMIT = 20;

export const MAX_LANGUAGE_FILTERS = 20;

function set(value: string | undefined): string | undefined {
  return said(value)?.trim();
}

function spoken(codes: string[] | undefined): string[] | undefined {
  const chosen = (codes ?? []).map((code) => code.trim()).filter(Boolean);
  return chosen.length > 0 ? chosen : undefined;
}

export function isAsked(filters: CandidateSearchFilters): boolean {
  return filters.q.trim().length >= MIN_QUERY_LENGTH;
}

export function searchQuery(filters: CandidateSearchFilters) {
  return {
    q: filters.q.trim(),
    location_key: set(filters.location),
    language: spoken(filters.languages),
    keywords: set(filters.keywords),
    limit: SEARCH_LIMIT,
  };
}

export function searchAddress(filters: CandidateSearchFilters) {
  return {
    q: set(filters.q),
    location: set(filters.location),
    languages: spoken(filters.languages),
    keywords: set(filters.keywords),
  };
}

export function hardFilterCount(filters: CandidateSearchFilters): number {
  const named = [filters.location, filters.keywords].filter((value) => set(value)).length;
  return spoken(filters.languages) ? named + 1 : named;
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
