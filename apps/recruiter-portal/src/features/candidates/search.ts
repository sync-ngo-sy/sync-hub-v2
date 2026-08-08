import type { components } from '@sync/api-client';
import { said } from '@/lib/said';

export type LanguageProficiency = components['schemas']['LanguageProficiency'];

/** A language a Candidate has to speak, and how well at the least. Blank means any level. */
export interface SpokenLanguage {
  code: string;
  level: LanguageProficiency | '';
}

export interface CandidateSearchFilters {
  q: string;
  location?: string;
  languages?: string[];
  keywords?: string;
}

export const MIN_QUERY_LENGTH = 2;

export const SEARCH_LIMIT = 20;

export const MAX_LANGUAGE_FILTERS = 20;

export const PROFICIENCY_ORDER: LanguageProficiency[] = [
  'beginner',
  'intermediate',
  'advanced',
  'fluent',
  'native',
];

const LEVEL_SEPARATOR = ':';

function set(value: string | undefined): string | undefined {
  return said(value)?.trim();
}

function spoken(tokens: string[] | undefined): string[] | undefined {
  const kept = (tokens ?? []).map((token) => token.trim()).filter(Boolean);
  return kept.length > 0 ? kept : undefined;
}

export function languagesFrom(tokens: string[] | undefined): SpokenLanguage[] {
  return (spoken(tokens) ?? []).map((token) => {
    const at = token.lastIndexOf(LEVEL_SEPARATOR);
    if (at < 0) return { code: token, level: '' };
    return { code: token.slice(0, at), level: token.slice(at + 1) as LanguageProficiency };
  });
}

export function languageTokens(languages: SpokenLanguage[]): string[] {
  return languages
    .filter((language) => language.code !== '')
    .map((language) =>
      language.level === '' ? language.code : `${language.code}${LEVEL_SEPARATOR}${language.level}`,
    );
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
  return [set(filters.location), set(filters.keywords), spoken(filters.languages)].filter(Boolean)
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
