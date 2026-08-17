import { describe, expect, it } from 'vitest';
import { changePasswordSchema } from './change-password';

const CONFORMING = 'CorrectHorse9';

function errorFor(values: {
  current_password?: string;
  new_password?: string;
}): string | undefined {
  const result = changePasswordSchema.safeParse({
    current_password: 'Whatever-It-Was1',
    new_password: CONFORMING,
    ...values,
  });
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe('the change-password schema', () => {
  it('accepts a current password and a new one the API will take', () => {
    expect(errorFor({})).toBeUndefined();
  });

  it('asks for the current password before anything else', () => {
    expect(errorFor({ current_password: '' })).toBe('Enter your current password.');
  });

  it('holds the new password to the same policy as every other password form', () => {
    expect(errorFor({ new_password: 'short' })).toBe('Use at least 8 characters.');
    expect(errorFor({ new_password: 'correcthorse9' })).toBe('Add an uppercase letter.');
    expect(errorFor({ new_password: 'CORRECTHORSE9' })).toBe('Add a lowercase letter.');
    expect(errorFor({ new_password: 'CorrectHorse' })).toBe('Add a digit.');
  });

  it('leaves the current password unpoliced, because the policy may have changed since', () => {
    expect(errorFor({ current_password: 'old' })).toBeUndefined();
  });
});
