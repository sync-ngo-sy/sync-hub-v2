import { describe, expect, it } from 'vitest';
import { jobFormSchema } from './job';

const A_BLANK_FORM = {
  title: '',
  description: '',
  locationKey: '',
  employmentType: '',
  workMode: '',
  expiresAt: '',
};

describe('a Job form', () => {
  it('requires a title and description after whitespace is removed', () => {
    const result = jobFormSchema.safeParse({ ...A_BLANK_FORM, title: '   ' });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.flatten().fieldErrors).toMatchObject({
      title: ['Enter a job title.'],
      description: ['Enter a job description.'],
    });
  });

  it('refuses an invalid closing date before it reaches the API', () => {
    const result = jobFormSchema.safeParse({
      ...A_BLANK_FORM,
      title: 'Field Coordinator',
      description: 'Coordinate field teams.',
      expiresAt: 'not-a-date',
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.flatten().fieldErrors.expiresAt).toEqual(['Enter a valid date and time.']);
  });

  it('takes both fixed sets and nothing else, and a blank employment type', () => {
    const filled = {
      ...A_BLANK_FORM,
      title: 'Field Coordinator',
      description: 'Coordinate field teams.',
      workMode: 'remote',
    };

    expect(jobFormSchema.safeParse(filled).success).toBe(true);
    expect(
      jobFormSchema.safeParse({
        ...filled,
        employmentType: 'volunteer',
        workMode: 'hybrid',
        locationKey: 'sy-aleppo',
      }).success,
    ).toBe(true);
    expect(jobFormSchema.safeParse({ ...filled, employmentType: 'Full time' }).success).toBe(false);
    expect(jobFormSchema.safeParse({ ...filled, workMode: 'field' }).success).toBe(false);
  });

  it('asks for a work mode, because a listing that will not say is one nobody can judge', () => {
    const result = jobFormSchema.safeParse({
      ...A_BLANK_FORM,
      title: 'Field Coordinator',
      description: 'Coordinate field teams.',
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.flatten().fieldErrors.workMode).toEqual([
      'Choose how much of this role happens where the team is.',
    ]);
  });

  it.each(['onsite', 'hybrid'])('asks where %s work happens', (workMode) => {
    const result = jobFormSchema.safeParse({
      ...A_BLANK_FORM,
      title: 'Field Coordinator',
      description: 'Coordinate field teams.',
      workMode,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.flatten().fieldErrors.locationKey).toEqual([
      'On-site and hybrid work happens somewhere. Name the Location, or make the role remote.',
    ]);
  });

  it('lets a remote role name no Location at all, which reads as Anywhere', () => {
    const result = jobFormSchema.safeParse({
      ...A_BLANK_FORM,
      title: 'Technical Writer',
      description: 'Write the guides from wherever you are.',
      workMode: 'remote',
    });

    expect(result.success).toBe(true);
  });
});
