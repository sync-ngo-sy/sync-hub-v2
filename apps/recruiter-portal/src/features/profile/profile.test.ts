import type { components } from '@sync/api-client';
import { describe, expect, it } from 'vitest';
import {
  linkLabel,
  period,
  profileIsBare,
  recordProfile,
  snapshotProfile,
  yearsOfExperience,
} from './profile';

const RECORD: components['schemas']['CandidateRecord'] = {
  candidate_id: '00000000-0000-4000-8000-000000000031',
  full_name: 'Amina Haddad',
  avatar_url: 'https://cdn.example.test/amina.webp',
  headline: 'Backend engineer, 8 years',
  summary: 'Builds payment systems for NGOs.',
  location_key: 'sy-aleppo',
  location_name: 'Aleppo',
  canonical_role_key: 'backend-engineer',
  canonical_role_name: 'Backend Engineer',
  total_experience_years: 8,
  in_talent_pool: false,
  phone: '+963 11 555 0142',
  email: 'amina@example.test',
  experiences: [],
  educations: [],
  skills: [],
  languages: [{ code: 'ar', proficiency: 'native' }],
  projects: [],
};

const SNAPSHOT: components['schemas']['ApplicationSnapshot'] = {
  full_name: 'Amal Haddad',
  phone: '+963 11 555 0101',
  headline: 'Field logistics lead',
  summary: 'Nine years moving relief cargo.',
  location: 'Aleppo',
  total_experience_years: 9,
  unmapped_skills: ['Convoy planning'],
  experiences: [],
  educations: [],
  skills: [],
  languages: [],
  projects: [],
};

describe('a Candidate read by id, as one profile', () => {
  it('carries the contact details only this read hands over', () => {
    const profile = recordProfile(RECORD);

    expect(profile.email).toBe('amina@example.test');
    expect(profile.phone).toBe('+963 11 555 0142');
  });

  it('reads the Location by its name and the role by the platform’s name for it', () => {
    const profile = recordProfile(RECORD);

    expect(profile.location).toBe('Aleppo');
    expect(profile.role).toBe('Backend Engineer');
  });

  it('names an unnamed person rather than showing a blank', () => {
    expect(recordProfile({ ...RECORD, full_name: null }).name).toBe('Unnamed candidate');
    expect(recordProfile({ ...RECORD, full_name: '  ' }).name).toBe('Unnamed candidate');
  });

  it('has nothing the platform has no Canonical name for, because a read is not an Application', () => {
    expect(recordProfile(RECORD).unmappedSkills).toEqual([]);
  });
});

describe('an Application’s frozen profile, as the same profile', () => {
  it('carries the phone the candidate sent, and no email, because none was sent', () => {
    const profile = snapshotProfile(SNAPSHOT);

    expect(profile.phone).toBe('+963 11 555 0101');
    expect(profile.email).toBeNull();
  });

  it('has no canonical role and no photo, because a Snapshot froze neither', () => {
    const profile = snapshotProfile(SNAPSHOT);

    expect(profile.role).toBeNull();
    expect(profile.avatarUrl).toBeNull();
  });

  it('keeps the skills Screening could not read', () => {
    expect(snapshotProfile(SNAPSHOT).unmappedSkills).toEqual(['Convoy planning']);
  });
});

describe('a profile with nothing in its body', () => {
  it('is bare when only the facts on the card were given', () => {
    expect(
      profileIsBare(
        snapshotProfile({ full_name: 'Amal Haddad', phone: '+963 1', total_experience_years: 9 }),
      ),
    ).toBe(true);
  });

  it('is not bare once anything below the card was said', () => {
    expect(profileIsBare(snapshotProfile(SNAPSHOT))).toBe(false);
    expect(profileIsBare(recordProfile(RECORD))).toBe(false);
  });
});

describe('how a profile entry dates itself', () => {
  it('reads a month and year at both ends', () => {
    expect(
      period({ start_year: 2018, start_month: 1, end_year: 2022, end_month: 2, is_current: false }),
    ).toBe('Jan 2018 – Feb 2022');
  });

  it('says Present for a job the candidate still holds', () => {
    expect(
      period({
        start_year: 2022,
        start_month: 3,
        end_year: null,
        end_month: null,
        is_current: true,
      }),
    ).toBe('Mar 2022 – Present');
  });

  it('drops the month the candidate never gave', () => {
    expect(period({ start_year: 2019, start_month: null, end_year: 2021, end_month: null })).toBe(
      '2019 – 2021',
    );
  });

  it('reads an open end as the start alone rather than inventing one', () => {
    expect(
      period({
        start_year: 2020,
        start_month: 5,
        end_year: null,
        end_month: null,
        is_current: false,
      }),
    ).toBe('May 2020');
  });

  it('has nothing to say when the candidate gave no years at all', () => {
    expect(
      period({ start_year: null, start_month: null, end_year: null, end_month: null }),
    ).toBeNull();
  });

  it('ignores a month it cannot name', () => {
    expect(period({ start_year: 2020, start_month: 13, end_year: null, end_month: null })).toBe(
      '2020',
    );
  });
});

describe('how long a candidate says they have done a skill', () => {
  it('counts whole and part years', () => {
    expect(yearsOfExperience(1)).toBe('1 year');
    expect(yearsOfExperience(3)).toBe('3 years');
    expect(yearsOfExperience(2.5)).toBe('2.5 years');
  });

  it('does not round a few months up to a year', () => {
    expect(yearsOfExperience(0.5)).toBe('Under a year');
    expect(yearsOfExperience(0)).toBe('Under a year');
  });
});

describe('how a link a candidate gave reads on screen', () => {
  it('drops the scheme, which no reader needs', () => {
    expect(linkLabel('https://example.test/cold-chain-repo')).toBe('example.test/cold-chain-repo');
    expect(linkLabel('http://example.test/x')).toBe('example.test/x');
  });

  it('drops a trailing slash, so two spellings of one address read alike', () => {
    expect(linkLabel('https://example.test/')).toBe('example.test');
  });

  it('leaves an address it does not recognise exactly as the candidate typed it', () => {
    expect(linkLabel('example.test/x')).toBe('example.test/x');
  });
});
