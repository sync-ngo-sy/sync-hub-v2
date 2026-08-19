import { describe, expect, it } from 'vitest';
import { BARE_PUBLIC_JOB, PUBLIC_JOB, PUBLIC_JOBS } from '@/testing/fixtures';
import {
  experienceLabel,
  jobMeta,
  jobPlace,
  languageName,
  proficiencyLabel,
  questionShape,
  skillDemand,
  yearsAsked,
} from './job';

describe('a Job meta line', () => {
  it('reads employer, place, how the work happens and what the contract is', () => {
    expect(jobMeta(PUBLIC_JOB)).toBe('Levant Digital · Damascus · Remote · Full time');
  });

  it('names the place a remote Job wants a Candidate to be based, not instead of it', () => {
    expect(jobMeta(PUBLIC_JOB)).toContain('Damascus · Remote');
  });

  it('reads a remote Job that names no place as Anywhere', () => {
    expect(jobMeta(BARE_PUBLIC_JOB)).toBe('Sham Care · Anywhere · Remote');
  });

  it('carries only what the Job actually has', () => {
    expect(jobMeta(BARE_PUBLIC_JOB)).not.toContain('Full time');
  });

  it('reads the same for a summary as for the whole Job', () => {
    expect(PUBLIC_JOBS.map(jobMeta)).toEqual([
      'Levant Digital · Damascus · Remote · Full time',
      'Aman Relief · Aleppo · On-site · Contract',
      'Sham Care · Anywhere · Remote',
    ]);
  });
});

describe('where a Job is', () => {
  it('is the Location it names', () => {
    expect(jobPlace(PUBLIC_JOB)).toBe('Damascus');
  });

  it('is Anywhere when a remote Job names none', () => {
    expect(jobPlace(BARE_PUBLIC_JOB)).toBe('Anywhere');
  });

  it('is nowhere at all when the Job is neither', () => {
    expect(jobPlace({ ...BARE_PUBLIC_JOB, work_mode: null })).toBeNull();
  });
});

describe('what a Job asks for', () => {
  it('counts total experience from the floor up', () => {
    expect(experienceLabel(3)).toBe('3+ years total experience');
  });

  it('reads a skill as how much it matters, then how much of it is wanted', () => {
    expect(skillDemand({ name: 'TypeScript', importance: 'required', minimum_years: 3 })).toBe(
      'Required · 3+ years',
    );
  });

  it('leaves the depth out of a skill any depth satisfies', () => {
    expect(skillDemand({ name: 'React', importance: 'preferred', minimum_years: null })).toBe(
      'Preferred',
    );
    expect(skillDemand({ name: 'Figma', importance: 'optional' })).toBe('Optional');
  });

  it('treats a zero-year ask as no ask at all, rather than "0+ years"', () => {
    expect(yearsAsked(0)).toBeNull();
    expect(yearsAsked(null)).toBeNull();
    expect(yearsAsked(undefined)).toBeNull();
    expect(yearsAsked(3)).toBe(3);
    expect(skillDemand({ name: 'Excel', importance: 'required', minimum_years: 0 })).toBe(
      'Required',
    );
  });

  it('says what answering a question takes, and whether it can be skipped', () => {
    expect(PUBLIC_JOB.questions.map(questionShape)).toEqual([
      'Yes or no · Required',
      'Short answer · Optional',
    ]);
  });

  it('spells a language code out in English, whatever the reader’s own locale', () => {
    expect(languageName('en')).toBe('English');
    expect(languageName('ar')).toBe('Arabic');
  });

  it('shows a code Intl cannot name as the code itself', () => {
    expect(languageName('zz')).toBe('zz');
    expect(languageName('not a language')).toBe('not a language');
  });

  it('reads a proficiency as a floor, except at the top where there is nothing better', () => {
    expect(proficiencyLabel({ code: 'en', minimum_proficiency: 'fluent' })).toBe(
      'Fluent or better',
    );
    expect(proficiencyLabel({ code: 'ar', minimum_proficiency: 'beginner' })).toBe(
      'Beginner or better',
    );
    expect(proficiencyLabel({ code: 'ar', minimum_proficiency: 'native' })).toBe('Native');
  });
});
