import { describe, expect, it } from 'vitest';
import { type ProfileDraft, updatedFromCv } from './cv-update';
import { type ProfileFormValues, toFormValues } from './schemas/profile';

function aForm(over: Partial<ProfileFormValues> = {}): ProfileFormValues {
  return { ...toFormValues({ full_name: 'Lina Khoury', is_searchable: false }), ...over };
}

function aDraft(over: Partial<ProfileDraft> = {}): ProfileDraft {
  return { full_name: 'Lina Khoury', is_searchable: false, ...over };
}

describe('updating the form from a CV', () => {
  it('brings what the CV says into the fields, as the fields hold values', () => {
    const updated = updatedFromCv(
      aForm(),
      aDraft({
        full_name: 'Lina H. Khoury',
        headline: 'Backend engineer, 8 years',
        phone: null,
        experiences: [
          {
            job_title: 'Backend engineer',
            company_name: 'Levant Digital',
            start_year: 2019,
            is_current: false,
          },
        ],
      }),
    );

    expect(updated.full_name).toBe('Lina H. Khoury');
    expect(updated.headline).toBe('Backend engineer, 8 years');
    expect(updated.phone).toBe('');
    expect(updated.experiences).toEqual([
      {
        job_title: 'Backend engineer',
        company_name: 'Levant Digital',
        start_year: '2019',
        start_month: '',
        end_year: '',
        end_month: '',
        is_current: false,
        description: '',
      },
    ]);
  });

  it('replaces a section the candidate had written by hand', () => {
    const current = aForm({
      educations: [
        {
          institution: 'University of Aleppo',
          degree: 'BSc',
          field_of_study: '',
          graduation_year: '',
          description: '',
        },
      ],
    });
    const updated = updatedFromCv(
      current,
      aDraft({ educations: [{ institution: 'Damascus University' }] }),
    );

    expect(updated.educations.map((entry) => entry.institution)).toEqual(['Damascus University']);
  });

  it('empties a section the CV is silent about', () => {
    const current = aForm({
      projects: [
        {
          name: 'Distribution tracker',
          description: '',
          project_url: '',
          repository_url: '',
          start_year: '',
          start_month: '',
          end_year: '',
          end_month: '',
        },
      ],
    });

    expect(updatedFromCv(current, aDraft()).projects).toEqual([]);
  });

  it('keeps the skills already in the form, with the years typed into them', () => {
    const current = aForm({ skills: [{ name: 'Python', years_experience: '3.5' }] });
    const updated = updatedFromCv(
      current,
      aDraft({ skills: [{ name: 'Python', years_experience: 3 }] }),
    );

    expect(updated.skills).toEqual([{ name: 'Python', years_experience: '3.5' }]);
  });

  it('adds a skill the CV names with its years left for the candidate to type', () => {
    const current = aForm({ skills: [{ name: 'Python', years_experience: '3.5' }] });
    const updated = updatedFromCv(
      current,
      aDraft({
        skills: [
          { name: 'Python', years_experience: 3 },
          { name: 'Kubernetes', years_experience: null },
        ],
      }),
    );

    expect(updated.skills).toEqual([
      { name: 'Python', years_experience: '3.5' },
      { name: 'Kubernetes', years_experience: '' },
    ]);
  });

  it('never drops a skill the form holds that the CV does not mention', () => {
    const current = aForm({ skills: [{ name: 'PostgreSQL', years_experience: '2' }] });
    const updated = updatedFromCv(current, aDraft({ skills: [{ name: 'Python' }] }));

    expect(updated.skills.map((skill) => skill.name)).toEqual(['PostgreSQL', 'Python']);
  });

  it('surfaces the skills the platform has no name for instead of dropping them', () => {
    const updated = updatedFromCv(aForm(), aDraft({ unmapped_skills: ['Kobo Toolbox'] }));

    expect(updated.unmapped_skills).toEqual([{ value: 'Kobo Toolbox' }]);
  });

  it('brings the links a CV carries, and empties the ones it is silent about', () => {
    const current = aForm({
      linkedin_url: 'https://www.linkedin.com/in/lina-khoury',
      portfolio_url: 'https://lina-khoury.dev',
    });
    const updated = updatedFromCv(
      current,
      aDraft({ linkedin_url: 'https://www.linkedin.com/in/lina-from-the-cv' }),
    );

    expect(updated.linkedin_url).toBe('https://www.linkedin.com/in/lina-from-the-cv');
    expect(updated.portfolio_url).toBe('');
  });

  it('leaves the settings a CV cannot speak for exactly as the form holds them', () => {
    const current = aForm({ location_key: 'sy-rif-dimashq', is_searchable: true });
    const updated = updatedFromCv(
      current,
      aDraft({ location_key: 'sy-aleppo', is_searchable: false }),
    );

    expect(updated.location_key).toBe('sy-rif-dimashq');
    expect(updated.is_searchable).toBe(true);
  });
});
