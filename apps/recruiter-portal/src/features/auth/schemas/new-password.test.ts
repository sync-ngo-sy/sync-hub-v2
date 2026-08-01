import { describe, expect, it } from 'vitest';
import { newPasswordSchema } from './new-password';

function errorFor(password: string): string | undefined {
  const result = newPasswordSchema.safeParse({ password });
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe('the new-password schema', () => {
  it('accepts a password the API will take', () => {
    expect(errorFor('correct-horse-battery')).toBeUndefined();
  });

  it('holds the password to the API limits', () => {
    expect(errorFor('short')).toBe('Use at least 8 characters.');
    expect(errorFor('x'.repeat(73))).toBe('Use 72 characters or fewer.');
  });
});
