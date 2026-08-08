import { describe, expect, it } from 'vitest';
import type { PooledCandidate } from '@/features/talent-pool/pool';
import {
  candidateMeta,
  type MatchedCandidate,
  matchEvidence,
  matchedCard,
  pooledCard,
} from './candidate';

const MATCH: MatchedCandidate = {
  candidate_id: '00000000-0000-4000-8000-000000000031',
  full_name: 'Amina Haddad',
  avatar_url: null,
  headline: 'Backend engineer, 8 years',
  summary: 'Builds payment systems.',
  location_key: 'sy-aleppo',
  location_name: 'Aleppo',
  language_names: ['Arabic', 'English'],
  canonical_role_key: 'backend-engineer',
  canonical_role_name: 'Backend Engineer',
  total_experience_years: 8,
  in_talent_pool: false,
  matched_section: 'experience',
  matched_text: 'Ran the payment platform at Hand in Hand.',
};

const POOLED: PooledCandidate = {
  candidate_id: '00000000-0000-4000-8000-000000000031',
  full_name: 'Amina Haddad',
  headline: 'Backend engineer, 8 years',
  location_name: 'Aleppo',
  added_at: '2026-07-30T09:00:00Z',
  is_imported_from_manatal: false,
  is_claimed: true,
};

describe('the card a search hit hands the Candidate view', () => {
  it('carries everything the hit knows about the person', () => {
    expect(matchedCard(MATCH)).toEqual({
      id: '00000000-0000-4000-8000-000000000031',
      fullName: 'Amina Haddad',
      headline: 'Backend engineer, 8 years',
      summary: 'Builds payment systems.',
      locationName: 'Aleppo',
      languageNames: ['Arabic', 'English'],
      avatarUrl: null,
    });
  });

  it('names a Candidate the search came back without a name for', () => {
    expect(matchedCard({ ...MATCH, full_name: null }).fullName).toBe('Unnamed candidate');
  });

  it('reads an absent field as absent rather than as an empty string', () => {
    const card = matchedCard({
      candidate_id: MATCH.candidate_id,
      full_name: 'Amina Haddad',
      total_experience_years: 0,
      in_talent_pool: false,
      matched_text: '',
    });

    expect(card.headline).toBeNull();
    expect(card.summary).toBeNull();
    expect(card.locationName).toBeNull();
    expect(card.languageNames).toEqual([]);
  });
});

describe('the card a talent-pool row hands the Candidate view', () => {
  it('carries the three things the pool lists, and claims nothing else', () => {
    expect(pooledCard(POOLED)).toEqual({
      id: '00000000-0000-4000-8000-000000000031',
      fullName: 'Amina Haddad',
      headline: 'Backend engineer, 8 years',
      summary: null,
      locationName: 'Aleppo',
      languageNames: [],
      avatarUrl: null,
    });
  });
});

describe('the line under a Candidate’s name', () => {
  it('reads the headline, where they are, and the languages they speak', () => {
    expect(candidateMeta(matchedCard(MATCH))).toBe(
      'Backend engineer, 8 years · Aleppo · Speaks Arabic, English',
    );
  });

  it('leaves the languages out for a Candidate who lists none', () => {
    expect(candidateMeta(matchedCard({ ...MATCH, language_names: [] }))).toBe(
      'Backend engineer, 8 years · Aleppo',
    );
  });

  it('says nothing at all when the profile says nothing', () => {
    expect(candidateMeta(pooledCard({ ...POOLED, headline: null, location_name: null }))).toBe('');
  });
});

describe('the evidence a search hit is shown with', () => {
  it('names the part of the profile the fragment came from', () => {
    expect(matchEvidence(MATCH)).toEqual({
      where: 'Matched in their experience',
      text: 'Ran the payment platform at Hand in Hand.',
    });
  });

  it('falls back to the profile at large when the search does not say which part', () => {
    expect(matchEvidence({ ...MATCH, matched_section: null })?.where).toBe(
      'Matched in their profile',
    );
  });

  it('shows nothing rather than an empty quotation', () => {
    expect(matchEvidence({ ...MATCH, matched_text: '   ' })).toBeNull();
  });
});
