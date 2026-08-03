export interface CandidateSearchFilters {
  q: string;
  location?: string;
  language?: string;
  keywords?: string;
}

/** The API refuses anything shorter, so the portal does not ask. */
export const MIN_QUERY_LENGTH = 2;

export const SEARCH_LIMIT = 20;

function set(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
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

/** The address bar's own copy of the search: an unset filter is left off rather than left blank,
 * so a link reproduces the list it was copied from and says nothing more. */
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
