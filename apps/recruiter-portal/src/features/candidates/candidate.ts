import type { components } from '@sync/api-client';
import type { PooledCandidate } from '@/features/talent-pool/pool';
import { said } from '@/lib/said';

export type MatchedCandidate = components['schemas']['MatchedCandidate'];
export type MatchedSection = components['schemas']['ChunkType'];

/**
 * What a Candidate view has to go on. No endpoint reads one Candidate's profile for a Recruiter,
 * so the person on screen is whatever the list that found them carried — a search hit knows the
 * most, a talent-pool row three fields, and neither carries an address or a phone number.
 */
export interface CandidateCard {
  id: string;
  fullName: string;
  headline: string | null;
  summary: string | null;
  locationName: string | null;
  preferredLanguageCode: string | null;
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
    preferredLanguageCode: said(match.preferred_language_code),
    avatarUrl: said(match.avatar_url),
  };
}

export function pooledCard(pooled: PooledCandidate): CandidateCard {
  return {
    id: pooled.candidate_id,
    fullName: said(pooled.full_name) ?? UNNAMED,
    headline: said(pooled.headline),
    summary: null,
    locationName: said(pooled.location_name),
    preferredLanguageCode: null,
    avatarUrl: null,
  };
}

export function candidateMeta(card: CandidateCard, languageName: string | null): string {
  return [card.headline, card.locationName, languageName ? `Prefers ${languageName}` : null]
    .filter(Boolean)
    .join(' · ');
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
