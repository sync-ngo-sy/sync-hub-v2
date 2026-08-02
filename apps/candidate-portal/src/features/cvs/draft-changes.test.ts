import { describe, expect, it } from 'vitest';
import {
  type CandidateProfile,
  draftChanges,
  type ProfileDraft,
  profileFromDraft,
  skillsNeedingYears,
} from './draft-changes';

function aProfile(over: Partial<CandidateProfile> = {}): CandidateProfile {
  return { full_name: 'Lina Khoury', is_searchable: false, ...over };
}

function aDraft(over: Partial<ProfileDraft> = {}): ProfileDraft {
  return { full_name: 'Lina Khoury', is_searchable: false, ...over };
}

function labels(current: CandidateProfile, draft: ProfileDraft): string[] {
  return draftChanges(current, draft).map((change) => change.label);
}

describe('what applying a draft would change', () => {
  it('finds nothing to report when the CV says what the profile already says', () => {
    expect(draftChanges(aProfile(), aDraft())).toEqual([]);
  });

  it('reports a field the CV fills in that the profile has empty', () => {
    const changes = draftChanges(aProfile(), aDraft({ headline: 'Backend engineer, 8 years' }));

    expect(changes).toEqual([
      { label: 'Headline', before: '—', after: 'Backend engineer, 8 years' },
    ]);
  });

  it('reports a field the CV would overwrite, showing both sides', () => {
    const changes = draftChanges(
      aProfile({ headline: 'Nurse' }),
      aDraft({ headline: 'Backend engineer, 8 years' }),
    );

    expect(changes).toEqual([
      { label: 'Headline', before: 'Nurse', after: 'Backend engineer, 8 years' },
    ]);
  });

  // A CV names a place in prose; the profile holds a Location the Candidate picked from a list.
  it('never proposes a move, whatever the CV said about where they are', () => {
    const changes = draftChanges(
      aProfile({ location_key: 'sy-damascus' }),
      aDraft({ location_key: 'sy-damascus' }),
    );

    expect(changes).toEqual([]);
  });

  // The API replaces rather than merges every section but skills, so a CV that mentions no
  // jobs empties the ones already there — the loudest thing this review has to say.
  it('reports a section the CV would empty', () => {
    const current = aProfile({ experiences: [{ job_title: 'Nurse', is_current: true }] });

    expect(draftChanges(current, aDraft())).toEqual([
      { label: 'Experience', before: '1 entry', after: 'Nothing' },
    ]);
  });

  it('counts entries rather than listing them', () => {
    const current = aProfile({ educations: [{ institution: 'Damascus University' }] });
    const draft = aDraft({
      educations: [{ institution: 'Damascus University' }, { institution: 'Aleppo University' }],
    });

    expect(draftChanges(current, draft)).toEqual([
      { label: 'Education', before: '1 entry', after: '2 entries' },
    ]);
  });

  it('leaves a section alone when the CV repeats it exactly', () => {
    const entries = [{ institution: 'Damascus University' }];

    expect(labels(aProfile({ educations: entries }), aDraft({ educations: entries }))).toEqual([]);
  });

  it('keeps the profile’s own reading order', () => {
    const draft = aDraft({
      full_name: 'Lina H. Khoury',
      phone: '+963 11 000 0000',
      headline: 'Backend engineer',
      summary: 'Eight years on payments systems.',
      experiences: [{ job_title: 'Nurse', is_current: false }],
      educations: [{ institution: 'Damascus University' }],
      languages: [{ code: 'ar', proficiency: 'native' }],
      projects: [{ name: 'Rota' }],
      skills: [{ name: 'Python', years_experience: 3 }],
      unmapped_skills: ['Triage'],
    });

    expect(labels(aProfile(), draft)).toEqual([
      'Name',
      'Phone',
      'Headline',
      'Summary',
      'Experience',
      'Education',
      'Languages',
      'Projects',
      'Skills',
      'Other skills',
    ]);
  });

  it('counts skills in skills, not entries, and marks the row as merging', () => {
    const draft = aDraft({ skills: [{ name: 'Python', years_experience: 3 }] });

    expect(draftChanges(aProfile(), draft)).toEqual([
      { label: 'Skills', before: 'Nothing', after: '1 skill', merges: true },
    ]);
  });

  // The API merges skills alone — `_merged_skills` hands back every saved skill with the years
  // the candidate typed, then adds the CV's. Nothing on the profile is lost, and the review
  // must not claim otherwise.
  it('keeps the saved skill and adds the CV’s, rather than replacing', () => {
    const current = aProfile({ skills: [{ name: 'Python', years_experience: 3 }] });
    const draft = aDraft({
      skills: [
        { name: 'Python', years_experience: 3 },
        { name: 'Kubernetes', years_experience: null },
      ],
    });

    expect(draftChanges(current, draft)).toEqual([
      { label: 'Skills', before: '1 skill', after: '2 skills', merges: true },
    ]);
  });

  it('marks no other section as merging, because none of them do', () => {
    const current = aProfile({ educations: [{ institution: 'Damascus University' }] });
    const draft = aDraft({ headline: 'Nurse', unmapped_skills: ['Triage'] });

    expect(draftChanges(current, draft).every((change) => !change.merges)).toBe(true);
  });

  it('treats an empty string on the CV as nothing to say', () => {
    expect(labels(aProfile(), aDraft({ headline: '', summary: null }))).toEqual([]);
  });
});

describe('the skills a draft cannot be applied without', () => {
  it('names the ones this CV introduced, which carry no years yet', () => {
    const draft = aDraft({
      skills: [
        { name: 'Python', years_experience: 3 },
        { name: 'Kubernetes', years_experience: null },
        { name: 'Go' },
      ],
    });

    expect(skillsNeedingYears(draft)).toEqual(['Kubernetes', 'Go']);
  });

  it('finds none when every skill already has the years the candidate typed', () => {
    const draft = aDraft({ skills: [{ name: 'Python', years_experience: 3 }] });

    expect(skillsNeedingYears(draft)).toEqual([]);
  });

  it('finds none when the CV named no skills at all', () => {
    expect(skillsNeedingYears(aDraft())).toEqual([]);
  });
});

describe('turning a reviewed draft into the profile to save', () => {
  it('fills the missing years in from what the candidate typed', () => {
    const draft = aDraft({
      headline: 'Backend engineer',
      skills: [
        { name: 'Python', years_experience: 3 },
        { name: 'Kubernetes', years_experience: null },
      ],
    });

    expect(profileFromDraft(draft, { Kubernetes: 2 })).toEqual({
      full_name: 'Lina Khoury',
      is_searchable: false,
      headline: 'Backend engineer',
      skills: [
        { name: 'Python', years_experience: 3 },
        { name: 'Kubernetes', years_experience: 2 },
      ],
    });
  });

  it('leaves a draft with no skills exactly as it came', () => {
    const draft = aDraft({ location_key: 'sy-aleppo' });

    expect(profileFromDraft(draft, {})).toEqual(draft);
  });

  // Zero is an answer, not a default — recording it for a skill nobody spoke for would put a
  // claim on the profile the candidate never made.
  it('refuses to invent zero years for a skill left unanswered', () => {
    const draft = aDraft({ skills: [{ name: 'Kubernetes', years_experience: null }] });

    expect(() => profileFromDraft(draft, {})).toThrow(/Kubernetes/);
  });
});
