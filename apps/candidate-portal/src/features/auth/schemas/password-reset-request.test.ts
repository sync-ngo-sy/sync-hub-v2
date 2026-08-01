import { describe, expect, it } from 'vitest';
import { passwordResetRequestSchema } from './password-reset-request';

function errorFor(email: string): string | undefined {
  const result = passwordResetRequestSchema.safeParse({ email });
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe('the password-reset request schema', () => {
  it('accepts an email address', () => {
    expect(errorFor('lina@example.test')).toBeUndefined();
  });

  it('asks for an email before complaining about its shape', () => {
    expect(errorFor('')).toBe('Enter your email.');
  });

  it('rejects something that is not an email address', () => {
    expect(errorFor('lina')).toBe('Enter a valid email address.');
  });
});
