import { describe, expect, it } from 'vitest';
import { BARE_PUBLIC_JOB, PUBLIC_JOB, PUBLIC_JOBS } from '@/testing/fixtures';
import { experienceLabel, jobMeta, languageName, proficiencyLabel, skillDemand } from './job';

describe('a Job meta line', () => {
  it('reads employer, place and shape, in that order', () => {
    expect(jobMeta(PUBLIC_JOB)).toBe('Levant Digital · Remote · Full-time');
  });

  it('carries only what the Job actually has', () => {
    expect(jobMeta(BARE_PUBLIC_JOB)).toBe('Sham Care');
  });

  it('reads the same for a summary as for the whole Job', () => {
    expect(PUBLIC_JOBS.map(jobMeta)).toEqual([
      'Levant Digital · Remote · Full-time',
      'Aman Relief · Aleppo · Contract',
      'Sham Care',
    ]);
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
