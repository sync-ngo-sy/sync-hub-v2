import { describe, expect, it } from 'vitest';
import { draftToProfile, type ProfileDraft, skillNeedsYears } from './draft';

const BASE: ProfileDraft = {
  full_name: 'Amina Haddad',
  is_searchable: false,
  skills: [
    { name: 'Python', years_experience: 6 },
    { name: 'Rust', years_experience: null },
  ],
};

describe('skillNeedsYears', () => {
  it('flags a skill the CV newly named (no years) and leaves known ones alone', () => {
    expect(skillNeedsYears({ name: 'Rust', years_experience: null })).toBe(true);
    expect(skillNeedsYears({ name: 'Python', years_experience: 6 })).toBe(false);
  });
});

describe('draftToProfile', () => {
  it('keeps existing years and fills a newly-named skill from what the candidate typed', () => {
    const profile = draftToProfile(BASE, { Rust: 2 });
    expect(profile.skills).toEqual([
      { name: 'Python', years_experience: 6 },
      { name: 'Rust', years_experience: 2 },
    ]);
  });

  it('defaults a left-blank new skill to zero years so the profile can still save', () => {
    const profile = draftToProfile(BASE, {});
    expect(profile.skills).toEqual([
      { name: 'Python', years_experience: 6 },
      { name: 'Rust', years_experience: 0 },
    ]);
  });

  it('carries the rest of the draft through unchanged', () => {
    const profile = draftToProfile({ ...BASE, headline: 'Backend engineer' }, {});
    expect(profile.full_name).toBe('Amina Haddad');
    expect(profile.headline).toBe('Backend engineer');
  });
});
