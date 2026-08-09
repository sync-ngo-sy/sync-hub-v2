import type { components } from '@sync/api-client';
import type { PooledCandidate } from '@/features/talent-pool/pool';
import { said } from '@/lib/said';

export type MatchedCandidate = components['schemas']['MatchedCandidate'];
export type SearchableCandidate = components['schemas']['SearchableCandidate'];
export type MatchedSection = components['schemas']['ChunkType'];

export interface CandidateCard {
  id: string;
  fullName: string;
  headline: string | null;
  summary: string | null;
  locationName: string | null;
  languageNames: string[];
  avatarUrl: string | null;
}

const UNNAMED = 'Unnamed candidate';

const SECTION_WORDS: Record<MatchedSection, string> = {
  identity: 'their profile',
  experience: 'their experience',
  education: 'their education',
  skills: 'their skills',
  languages: 'their languages',
  project: 'their projects',
};

export function matchedCard(match: MatchedCandidate): CandidateCard {
  return {
    id: match.candidate_id,
    fullName: said(match.full_name) ?? UNNAMED,
    headline: said(match.headline),
    summary: said(match.summary),
    locationName: said(match.location_name),
    languageNames: match.language_names ?? [],
    avatarUrl: said(match.avatar_url),
  };
}

export function listedCard(person: SearchableCandidate): CandidateCard {
  return {
    id: person.candidate_id,
    fullName: said(person.full_name) ?? UNNAMED,
    headline: said(person.headline),
    summary: said(person.summary),
    locationName: said(person.location_name),
    languageNames: person.language_names ?? [],
    avatarUrl: said(person.avatar_url),
  };
}

export function pooledCard(pooled: PooledCandidate): CandidateCard {
  return {
    id: pooled.candidate_id,
    fullName: said(pooled.full_name) ?? UNNAMED,
    headline: said(pooled.headline),
    summary: null,
    locationName: said(pooled.location_name),
    languageNames: [],
    avatarUrl: said(pooled.avatar_url),
  };
}

export function candidateMeta(card: CandidateCard): string {
  const spoken = card.languageNames.length > 0 ? `Speaks ${card.languageNames.join(', ')}` : null;
  return [card.headline, card.locationName, spoken].filter(Boolean).join(' · ');
}

export interface MatchEvidence {
  where: string;
  text: string;
}

export function matchEvidence(match: MatchedCandidate): MatchEvidence | null {
  const text = match.matched_text.trim();
  if (text === '') return null;

  return { where: `Matched in ${SECTION_WORDS[match.matched_section ?? 'identity']}`, text };
}
