import {
  type CandidateSearchFilters,
  type CandidatesReading,
  counted,
  listed,
  orderIn,
  wordsIn,
  written,
} from './reading';

export const MIN_QUERY_LENGTH = 2;

export const SEARCH_LIMIT = 20;

export const DIRECTORY_LIMIT = 20;

export function isAsked(filters: CandidateSearchFilters): boolean {
  return wordsIn(filters).length >= MIN_QUERY_LENGTH;
}

export function searchQuery(filters: CandidateSearchFilters) {
  return {
    q: wordsIn(filters),
    location_key: written(filters.location),
    language: listed(filters.languages),
    skill: listed(filters.skills),
    role: written(filters.role),
    min_total_experience: counted(filters.experience),
    keywords: written(filters.keywords),
    limit: SEARCH_LIMIT,
  };
}

/** The directory takes no words and no `keywords`: everything it answers on is a yes or a no. */
export function directoryQuery(reading: CandidatesReading) {
  return {
    location_key: written(reading.location),
    language: listed(reading.languages),
    skill: listed(reading.skills),
    role: written(reading.role),
    min_total_experience: counted(reading.experience),
    sort: orderIn(reading),
    limit: DIRECTORY_LIMIT,
  };
}

export function hardFilterCount(filters: CandidateSearchFilters): number {
  return [
    written(filters.location),
    written(filters.keywords),
    written(filters.role),
    listed(filters.languages),
    listed(filters.skills),
    counted(filters.experience),
  ].filter(Boolean).length;
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

export function noCandidatesMessage(filters: CandidateSearchFilters): string {
  const narrowing = hardFilterCount(filters);
  if (narrowing === 0) {
    return 'No Candidate on the platform has opted into being found yet.';
  }
  return narrowing === 1
    ? 'No Searchable Candidate matches that filter.'
    : 'No Searchable Candidate matches all of those filters.';
}
