import type { components } from '@sync/api-client';
import { describe, expect, it } from 'vitest';
import {
  BLANK_EDUCATION,
  BLANK_EXPERIENCE,
  BLANK_PROJECT,
  MAX_ENTRIES,
  type ProfileFormValues,
  profileSchema,
  toFormValues,
  toProfile,
} from './profile';

const FILLED: ProfileFormValues = {
  full_name: 'Lina Khoury',
  phone: '+963 11 000 0000',
  headline: 'Field coordinator, 6 years',
  summary: 'Six years of coordination work across Idlib and Aleppo.',
  location_key: 'sy-aleppo',
  canonical_role_key: 'project-manager',
  is_searchable: false,
  total_experience_years: 6,
  experiences: [
    {
      job_title: 'Field Coordinator',
      company_name: 'Aman Relief',
      start_year: '2020',
      start_month: '3',
      end_year: '2024',
      end_month: '6',
      is_current: false,
      description: 'Ran distributions across three governorates.',
    },
  ],
  educations: [
    {
      institution: 'University of Aleppo',
      degree: 'BSc',
      field_of_study: 'Public Health',
      graduation_year: '2018',
      description: '',
    },
  ],
  skills: [{ name: 'Python', years_experience: '3.5' }],
  languages: [{ code: 'ar', proficiency: 'native' }],
  projects: [
    {
      name: 'Distribution tracker',
      description: '',
      project_url: 'https://tracker.example.test',
      repository_url: '',
      start_year: '2023',
      start_month: '',
      end_year: '',
      end_month: '',
    },
  ],
  unmapped_skills: [{ value: 'Kobo Toolbox' }],
};

function errorAt(path: string, values: ProfileFormValues): string | undefined {
  const result = profileSchema.safeParse(values);
  return result.success
    ? undefined
    : result.error.issues.find((issue) => issue.path.join('.') === path)?.message;
}

function parsed(values: ProfileFormValues) {
  return toProfile(values);
}

function withExperience(overrides: Partial<ProfileFormValues['experiences'][number]>) {
  return { ...FILLED, experiences: [{ ...BLANK_EXPERIENCE, job_title: 'Nurse', ...overrides }] };
}

describe('the profile schema', () => {
  it('accepts a filled-in profile', () => {
    expect(profileSchema.safeParse(FILLED).success).toBe(true);
  });

  it('accepts a profile with every section empty but a name', () => {
    expect(
      profileSchema.safeParse({
        ...FILLED,
        phone: '',
        headline: '',
        summary: '',
        location_key: '',
        experiences: [],
        educations: [],
        skills: [],
        languages: [],
        projects: [],
        unmapped_skills: [],
      }).success,
    ).toBe(true);
  });

  it('asks for a name', () => {
    expect(errorAt('full_name', { ...FILLED, full_name: '   ' })).toBe('Enter your name.');
  });

  it('holds a single line to the length the API accepts', () => {
    expect(errorAt('headline', { ...FILLED, headline: 'x'.repeat(201) })).toBe(
      'Use 200 characters or fewer.',
    );
  });

  it('holds a paragraph and a link to their own lengths', () => {
    expect(errorAt('summary', { ...FILLED, summary: 'x'.repeat(5001) })).toBe(
      'Use 5000 characters or fewer.',
    );
    expect(
      errorAt('projects.0.project_url', {
        ...FILLED,
        projects: [
          { ...BLANK_PROJECT, name: 'Tracker', project_url: `https://${'x'.repeat(2000)}` },
        ],
      }),
    ).toBe('Use 2000 characters or fewer.');
  });

  it('sends a blank optional line as "not set" rather than as nothing', () => {
    const body = parsed({ ...FILLED, phone: '   ', headline: '', location_key: '' });
    expect(body.phone).toBeNull();
    expect(body.headline).toBeNull();
    expect(body.location_key).toBeNull();
  });

  it('drops the spaces around everything it keeps', () => {
    const body = parsed({ ...FILLED, full_name: '  Lina Khoury  ' });
    expect(body.full_name).toBe('Lina Khoury');
  });

  it('holds a year to the range the API accepts', () => {
    expect(errorAt('experiences.0.start_year', withExperience({ start_year: '1899' }))).toBe(
      'Enter a year between 1900 and 2100.',
    );
    expect(errorAt('experiences.0.start_year', withExperience({ start_year: 'last year' }))).toBe(
      'Enter a year between 1900 and 2100.',
    );
    expect(
      errorAt('educations.0.graduation_year', { ...FILLED, educations: [BLANK_EDUCATION] }),
    ).toBe(undefined);
  });

  it('holds a month to 1 through 12', () => {
    expect(errorAt('experiences.0.start_month', withExperience({ start_month: '13' }))).toBe(
      'Enter a month between 1 and 12.',
    );
    expect(errorAt('experiences.0.start_month', withExperience({ start_month: '0' }))).toBe(
      'Enter a month between 1 and 12.',
    );
  });

  it('refuses a period that ends before it starts', () => {
    expect(
      errorAt(
        'experiences.0.end_year',
        withExperience({ start_year: '2024', start_month: '6', end_year: '2024', end_month: '1' }),
      ),
    ).toBe('The end cannot come before the start.');
  });

  it('leaves a project alone while either end of its period is unknown', () => {
    const undated = { ...FILLED, projects: [{ ...BLANK_PROJECT, name: 'Tracker' }] };

    expect(profileSchema.safeParse(undated).success).toBe(true);
  });

  it('asks a job for the year it started', () => {
    expect(
      errorAt('experiences.0.start_year', withExperience({ start_year: '', end_year: '2024' })),
    ).toBe('Enter the year.');
  });

  it('asks a job that has ended for the year it ended', () => {
    expect(
      errorAt('experiences.0.end_year', withExperience({ start_year: '2020', end_year: '' })),
    ).toBe('Enter the year it ended, or tick “I still work here”.');
  });

  it('asks a job still going for nothing but its start', () => {
    const current = withExperience({ start_year: '2020', end_year: '', is_current: true });

    expect(profileSchema.safeParse(current).success).toBe(true);
  });

  it('refuses an end date on a job that is still going, on the half that was filled', () => {
    expect(
      errorAt('experiences.0.end_year', withExperience({ is_current: true, end_year: '2024' })),
    ).toBe('A current job has no end date.');
    expect(
      errorAt('experiences.0.end_month', withExperience({ is_current: true, end_month: '6' })),
    ).toBe('A current job has no end date.');
  });

  it('asks how long a skill has been practised', () => {
    const years = (years_experience: string) =>
      errorAt('skills.0.years_experience', {
        ...FILLED,
        skills: [{ name: 'SQL', years_experience }],
      });

    expect(years('')).toBe('Enter years of experience.');
    expect(years('a while')).toBe('Enter years as a number.');
    expect(years('1000')).toBe('Enter 999.9 years or fewer.');
  });

  it('holds years to the one decimal place the column stores, and takes a bare half', () => {
    const skills = (years_experience: string) => ({
      ...FILLED,
      skills: [{ name: 'SQL', years_experience }],
    });

    expect(errorAt('skills.0.years_experience', skills('3.55'))).toBe(
      'Years go to one decimal place, like 3 or 3.5.',
    );
    expect(parsed(skills('.5')).skills).toEqual([{ name: 'SQL', years_experience: 0.5 }]);
    expect(parsed(skills('999.9')).skills).toEqual([{ name: 'SQL', years_experience: 999.9 }]);
  });

  it('refuses a second entry for the same skill, on the repeat', () => {
    const values = {
      ...FILLED,
      skills: [
        { name: 'Python', years_experience: '3' },
        { name: 'Python', years_experience: '5' },
      ],
    };
    expect(errorAt('skills.0.name', values)).toBeUndefined();
    expect(errorAt('skills.1.name', values)).toBe('This skill is already listed.');
  });

  it('refuses a second entry for the same language, on the repeat', () => {
    const values = {
      ...FILLED,
      languages: [
        { code: 'ar', proficiency: 'native' as const },
        { code: 'ar', proficiency: 'fluent' as const },
      ],
    };
    expect(errorAt('languages.1.code', values)).toBe('This language is already listed.');
  });

  it('refuses a repeated skill of its own, however it was cased — the API keeps only one', () => {
    const values = {
      ...FILLED,
      unmapped_skills: [{ value: 'Kobo Toolbox' }, { value: 'kobo toolbox' }],
    };
    expect(errorAt('unmapped_skills.1.value', values)).toBe('This skill is already listed.');
  });

  it('holds a language code to the width the API accepts', () => {
    expect(
      errorAt('languages.0.code', { ...FILLED, languages: [{ code: 'a', proficiency: 'native' }] }),
    ).toBe('A language code is 2 to 8 characters.');
  });

  it('caps a section at the number of entries the API stores', () => {
    const tooMany = Array.from({ length: MAX_ENTRIES + 1 }, (_, index) => ({
      ...BLANK_EXPERIENCE,
      job_title: `Job ${index}`,
    }));
    expect(errorAt('experiences', { ...FILLED, experiences: tooMany })).toBe(
      'List at most 50 jobs.',
    );
  });

  it('turns the form into a whole-profile body, sections in the order they are shown', () => {
    const body = parsed(FILLED);

    expect(body).toEqual({
      full_name: 'Lina Khoury',
      phone: '+963 11 000 0000',
      headline: 'Field coordinator, 6 years',
      summary: 'Six years of coordination work across Idlib and Aleppo.',
      location_key: 'sy-aleppo',
      canonical_role_key: 'project-manager',
      is_searchable: false,
      total_experience_years: 6,
      experiences: [
        {
          job_title: 'Field Coordinator',
          company_name: 'Aman Relief',
          start_year: 2020,
          start_month: 3,
          end_year: 2024,
          end_month: 6,
          is_current: false,
          description: 'Ran distributions across three governorates.',
        },
      ],
      educations: [
        {
          institution: 'University of Aleppo',
          degree: 'BSc',
          field_of_study: 'Public Health',
          graduation_year: 2018,
          description: null,
        },
      ],
      skills: [{ name: 'Python', years_experience: 3.5 }],
      languages: [{ code: 'ar', proficiency: 'native' }],
      projects: [
        {
          name: 'Distribution tracker',
          description: null,
          project_url: 'https://tracker.example.test',
          repository_url: null,
          start_year: 2023,
          start_month: null,
          end_year: null,
          end_month: null,
        },
      ],
      unmapped_skills: ['Kobo Toolbox'],
    });
  });
});

describe('the profile the API answers with', () => {
  const PROFILE: components['schemas']['CandidateProfile'] = {
    full_name: 'Lina Khoury',
    phone: null,
    headline: null,
    summary: null,
    location_key: null,
    canonical_role_key: null,
    is_searchable: true,
    total_experience_years: 4,
    experiences: [
      {
        job_title: 'Field Coordinator',
        company_name: null,
        start_year: 2020,
        start_month: null,
        end_year: null,
        end_month: null,
        is_current: true,
        description: null,
      },
    ],
    educations: [],
    skills: [{ name: 'Python', years_experience: 3 }],
    languages: [{ code: 'ar', proficiency: 'native' }],
    projects: [],
    unmapped_skills: ['Kobo Toolbox'],
  };

  it('becomes a form where every absent value is an empty field', () => {
    expect(toFormValues(PROFILE)).toEqual({
      full_name: 'Lina Khoury',
      canonical_role_key: '',
      total_experience_years: 4,
      phone: '',
      headline: '',
      summary: '',
      location_key: '',
      is_searchable: true,
      experiences: [
        {
          job_title: 'Field Coordinator',
          company_name: '',
          start_year: '2020',
          start_month: '',
          end_year: '',
          end_month: '',
          is_current: true,
          description: '',
        },
      ],
      educations: [],
      skills: [{ name: 'Python', years_experience: '3' }],
      languages: [{ code: 'ar', proficiency: 'native' }],
      projects: [],
      unmapped_skills: [{ value: 'Kobo Toolbox' }],
    });
  });

  it('survives a body whose optional sections are missing entirely', () => {
    const values = toFormValues({ full_name: 'Lina Khoury', is_searchable: false });

    expect(values.experiences).toEqual([]);
    expect(values.unmapped_skills).toEqual([]);
    expect(profileSchema.safeParse(values).success).toBe(true);
  });

  it('round-trips: what the form loads is what it would save back', () => {
    expect(toProfile(toFormValues(PROFILE))).toEqual(PROFILE);
  });
});
