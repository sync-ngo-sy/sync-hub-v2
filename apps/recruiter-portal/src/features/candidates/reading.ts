import type { components } from '@sync/api-client';
import { z } from 'zod';
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

export const MAX_EXPERIENCE_FILTER = 100;

export const DEFAULT_ORDER: DirectoryOrder = 'newest';

export const PROFICIENCY_ORDER = [
  'beginner',
  'intermediate',
  'advanced',
  'fluent',
  'native',
] as const satisfies readonly LanguageProficiency[];

const DIRECTORY_ORDERS = [
  'newest',
  'oldest',
  'name',
  'name_reversed',
  'most_experience',
  'least_experience',
] as const satisfies readonly DirectoryOrder[];

const CANDIDATE_TABS = ['filter', 'search'] as const satisfies readonly CandidateTab[];

const LEVEL_SEPARATOR = ':';

export const candidatesReading = z.object({
  tab: z.enum(CANDIDATE_TABS).optional().catch(undefined),
  sort: z.enum(DIRECTORY_ORDERS).optional().catch(undefined),
  q: z.string().optional().catch(undefined),
  location: z.string().optional().catch(undefined),
  languages: z.array(z.string()).optional().catch(undefined),
  skills: z.array(z.string()).optional().catch(undefined),
  role: z.string().optional().catch(undefined),
  experience: z.number().optional().catch(undefined),
  keywords: z.string().optional().catch(undefined),
});

export type CandidatesReading = z.infer<typeof candidatesReading>;

export type CandidateSearchFilters = Omit<CandidatesReading, 'tab' | 'sort'>;

type Address<TReading> = { [K in keyof Required<TReading>]: TReading[K] };

export function written(value: string | undefined): string | undefined {
  return said(value)?.trim();
}

export function listed(tokens: string[] | undefined): string[] | undefined {
  const kept = (tokens ?? []).map((token) => token.trim()).filter(Boolean);
  return kept.length > 0 ? kept : undefined;
}

export function counted(years: number | undefined): number | undefined {
  if (years === undefined || !Number.isFinite(years)) return undefined;
  const whole = Math.trunc(years);
  return whole > 0 && whole <= MAX_EXPERIENCE_FILTER ? whole : undefined;
}

export function wordsIn(filters: CandidateSearchFilters): string {
  return written(filters.q) ?? '';
}

export function orderIn(reading: CandidatesReading): DirectoryOrder {
  return reading.sort ?? DEFAULT_ORDER;
}

/** A link written before the tabs existed carried words and nothing else; it still means the
 * search it was copied from rather than the directory. */
function impliedTab(reading: CandidatesReading): CandidateTab {
  return written(reading.q) ? 'search' : 'filter';
}

export function tabIn(reading: CandidatesReading): CandidateTab {
  return reading.tab ?? impliedTab(reading);
}

export function candidatesAddress(reading: CandidatesReading): Address<CandidatesReading> {
  const tab = tabIn(reading);
  const order = orderIn(reading);

  return {
    tab,
    sort: tab === 'search' || order === DEFAULT_ORDER ? undefined : order,
    q: written(reading.q),
    location: written(reading.location),
    languages: listed(reading.languages),
    skills: listed(reading.skills),
    role: written(reading.role),
    experience: counted(reading.experience),
    keywords: written(reading.keywords),
  };
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
