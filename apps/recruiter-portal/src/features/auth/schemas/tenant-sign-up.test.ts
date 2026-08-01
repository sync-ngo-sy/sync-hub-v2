import { describe, expect, it } from 'vitest';
import { tenantSignUpSchema } from './tenant-sign-up';

const FILLED = {
  tenant_name: 'Damascus Talent',
  slug: 'damascus-talent',
  full_name: 'Rana Haddad',
  email: 'rana@example.test',
  password: 'correct-horse-battery',
};

function errorFor(field: keyof typeof FILLED, value: unknown): string | undefined {
  const result = tenantSignUpSchema.safeParse({ ...FILLED, [field]: value });
  return result.success
    ? undefined
    : result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe('the tenant sign-up schema', () => {
  it('accepts and trims a complete workspace registration', () => {
    expect(
      tenantSignUpSchema.parse({
        ...FILLED,
        tenant_name: '  Damascus Talent  ',
        full_name: '  Rana Haddad  ',
      }),
    ).toEqual(FILLED);
  });

  it('requires every value', () => {
    expect(errorFor('tenant_name', '   ')).toBe('Enter your workspace name.');
    expect(errorFor('slug', '')).toBe('Enter a workspace address.');
    expect(errorFor('full_name', '   ')).toBe('Enter your name.');
    expect(errorFor('email', '')).toBe('Enter your email.');
    expect(errorFor('password', '')).toBe('Use at least 8 characters.');
  });

  it('matches the API field limits', () => {
    expect(errorFor('tenant_name', 'x'.repeat(201))).toBe('Use 200 characters or fewer.');
    expect(errorFor('full_name', 'x'.repeat(201))).toBe('Use 200 characters or fewer.');
    expect(errorFor('slug', 'x')).toBe('Use at least 2 characters.');
    expect(errorFor('slug', 'x'.repeat(64))).toBe('Use 63 characters or fewer.');
    expect(errorFor('password', 'x'.repeat(73))).toBe('Use 72 characters or fewer.');
  });

  it('accepts only lowercase slug segments separated by single hyphens', () => {
    expect(errorFor('slug', 'damascus-talent')).toBeUndefined();
    expect(errorFor('slug', 'Damascus')).toBe(
      'Use lowercase letters, numbers and single hyphens only.',
    );
    expect(errorFor('slug', 'damascus--talent')).toBe(
      'Use lowercase letters, numbers and single hyphens only.',
    );
  });
});
