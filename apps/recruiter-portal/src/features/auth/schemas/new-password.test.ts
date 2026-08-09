import { describe, expect, it } from 'vitest';
import { newPasswordSchema } from './new-password';

const CONFORMING = 'CorrectHorse9';

function errorFor(password: string): string | undefined {
  const result = newPasswordSchema.safeParse({ password });
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe('the new-password schema', () => {
  it('accepts a password the API will take', () => {
    expect(errorFor(CONFORMING)).toBeUndefined();
  });

  it('holds the password to the API limits', () => {
    expect(errorFor('short')).toBe('Use at least 8 characters.');
    expect(errorFor(`${CONFORMING}${'x'.repeat(73)}`)).toBe('Use 72 characters or fewer.');
  });

  it('asks for each kind of character the policy wants', () => {
    expect(errorFor('correcthorse9')).toBe('Add an uppercase letter.');
    expect(errorFor('CORRECTHORSE9')).toBe('Add a lowercase letter.');
    expect(errorFor('CorrectHorse')).toBe('Add a digit.');
  });
});
