import type { components } from '@sync/api-client';
import { said } from '@/lib/said';

export type LanguageProficiency = components['schemas']['LanguageProficiency'];

export type DirectoryOrder = components['schemas']['DirectoryOrder'];

/** Which of the two ways of finding people is on screen. They read the same filters and answer
 * from different seams: the directory states facts, Global search ranks against words. */
export type CandidateTab = 'filter' | 'search';

/** A language a Candidate has to speak, and how well at the least. Blank means any level. */
export interface SpokenLanguage {
  code: string;
  level: LanguageProficiency | '';
}

export interface CandidateSearchFilters {
  q: string;
  location?: string;
  languages?: string[];
  skills?: string[];
  role?: string;
  experience?: number;
  keywords?: string;
}

export const MIN_QUERY_LENGTH = 2;

export const SEARCH_LIMIT = 20;

export const DIRECTORY_LIMIT = 20;

export const MAX_LANGUAGE_FILTERS = 20;

export const MAX_SKILL_FILTERS = 20;

export const MAX_EXPERIENCE_FILTER = 100;

export const DEFAULT_ORDER: DirectoryOrder = 'newest';

export const PROFICIENCY_ORDER: LanguageProficiency[] = [
  'beginner',
  'intermediate',
  'advanced',
  'fluent',
  'native',
];

const LEVEL_SEPARATOR = ':';

const ORDERS: DirectoryOrder[] = [
  'newest',
  'oldest',
  'name',
  'name_reversed',
  'most_experience',
  'least_experience',
];

function set(value: string | undefined): string | undefined {
  return said(value)?.trim();
}

function listed(tokens: string[] | undefined): string[] | undefined {
  const kept = (tokens ?? []).map((token) => token.trim()).filter(Boolean);
  return kept.length > 0 ? kept : undefined;
}

function counted(years: number | undefined): number | undefined {
  if (years === undefined || !Number.isFinite(years)) return undefined;
  const whole = Math.trunc(years);
  return whole > 0 && whole <= MAX_EXPERIENCE_FILTER ? whole : undefined;
}

export function orderFrom(value: string | undefined): DirectoryOrder {
  return ORDERS.find((order) => order === value) ?? DEFAULT_ORDER;
}

export function tabFrom(value: string | undefined, filters: { q?: string }): CandidateTab {
  if (value === 'search' || value === 'filter') return value;
  /** A link written before the tabs existed carried words and nothing else; it still means the
   * search it was copied from rather than the directory. */
  return set(filters.q) ? 'search' : 'filter';
}

export function languagesFrom(tokens: string[] | undefined): SpokenLanguage[] {
  return (listed(tokens) ?? []).map((token) => {
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
    language: listed(filters.languages),
    skill: listed(filters.skills),
    role: set(filters.role),
    min_total_experience: counted(filters.experience),
    keywords: set(filters.keywords),
    limit: SEARCH_LIMIT,
  };
}

/** The directory takes no words and no `keywords`: everything it answers on is a yes or a no. */
export function directoryQuery(filters: CandidateSearchFilters, order: DirectoryOrder) {
  return {
    location_key: set(filters.location),
    language: listed(filters.languages),
    skill: listed(filters.skills),
    role: set(filters.role),
    min_total_experience: counted(filters.experience),
    sort: order,
    limit: DIRECTORY_LIMIT,
  };
}

export function searchAddress(filters: CandidateSearchFilters) {
  return {
    q: set(filters.q),
    location: set(filters.location),
    languages: listed(filters.languages),
    skills: listed(filters.skills),
    role: set(filters.role),
    experience: counted(filters.experience),
    keywords: set(filters.keywords),
  };
}

export function hardFilterCount(filters: CandidateSearchFilters): number {
  return [
    set(filters.location),
    set(filters.keywords),
    set(filters.role),
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
