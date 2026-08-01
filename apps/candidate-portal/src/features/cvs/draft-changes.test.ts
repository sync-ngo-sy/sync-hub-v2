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
      aProfile({ location: 'Damascus, Syria' }),
      aDraft({ location: 'Aleppo, Syria' }),
    );

    expect(changes).toEqual([
      { label: 'Location', before: 'Damascus, Syria', after: 'Aleppo, Syria' },
    ]);
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
      location: 'Aleppo',
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
      'Location',
      'Experience',
      'Education',
      'Languages',
      'Projects',
      'Skills',
      'Other skills',
    ]);
  });

  it('counts skills in skills, not entries', () => {
    const draft = aDraft({ skills: [{ name: 'Python', years_experience: 3 }] });

    expect(draftChanges(aProfile(), draft)).toEqual([
      { label: 'Skills', before: 'Nothing', after: '1 skill' },
    ]);
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
    const draft = aDraft({ location: 'Aleppo' });

    expect(profileFromDraft(draft, {})).toEqual(draft);
  });
});
