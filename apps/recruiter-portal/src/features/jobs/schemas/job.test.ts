import { describe, expect, it } from 'vitest';
import { jobFormSchema } from './job';

describe('a Job form', () => {
  it('requires a title and description after whitespace is removed', () => {
    const result = jobFormSchema.safeParse({
      title: '   ',
      description: '',
      location: '',
      employmentType: '',
      expiresAt: '',
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.flatten().fieldErrors).toMatchObject({
      title: ['Enter a job title.'],
      description: ['Enter a job description.'],
    });
  });

  it('refuses an invalid closing date before it reaches the API', () => {
    const result = jobFormSchema.safeParse({
      title: 'Field Coordinator',
      description: 'Coordinate field teams.',
      location: '',
      employmentType: '',
      expiresAt: 'not-a-date',
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.flatten().fieldErrors.expiresAt).toEqual(['Enter a valid date and time.']);
  });
});
