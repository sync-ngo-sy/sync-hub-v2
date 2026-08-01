import { describe, expect, it } from 'vitest';
import { reviewSchema } from './review';

function errorFor(years: string): string | undefined {
  const result = reviewSchema.safeParse({ skills: [{ name: 'Kubernetes', years }] });
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe('the years a new skill needs before the profile will save', () => {
  it('accepts a whole number of years', () => {
    expect(errorFor('3')).toBeUndefined();
  });

  it('accepts the one decimal place the platform stores', () => {
    expect(errorFor('4.5')).toBeUndefined();
  });

  it('accepts none at all, which is not the same as leaving it blank', () => {
    expect(errorFor('0')).toBeUndefined();
  });

  it('asks for the years rather than assuming zero', () => {
    expect(errorFor('')).toBe('Enter the years.');
  });

  it('rejects something that is not a number', () => {
    expect(errorFor('a while')).toBe('Use a number of years, like 3 or 4.5.');
  });

  it('rejects a negative span', () => {
    expect(errorFor('-2')).toBe('Use a number of years, like 3 or 4.5.');
  });

  it('rejects a precision the platform would round away', () => {
    expect(errorFor('4.55')).toBe('Use a number of years, like 3 or 4.5.');
  });

  it('accepts a long career the platform can still record', () => {
    expect(errorFor('90')).toBeUndefined();
  });

  it('rejects more years than the profile column holds', () => {
    expect(errorFor('1000')).toBe('That is more years than the platform records.');
  });

  it('accepts a draft that introduced no new skills', () => {
    expect(reviewSchema.safeParse({ skills: [] }).success).toBe(true);
  });
});
