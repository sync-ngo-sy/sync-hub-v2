import { describe, expect, it } from 'vitest';
import { logInSchema } from './log-in';

function errorFor(field: 'email' | 'password', input: unknown): string | undefined {
  const result = logInSchema.safeParse(input);
  return result.success
    ? undefined
    : result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe('the log-in schema', () => {
  it('accepts a filled-in form', () => {
    expect(
      logInSchema.safeParse({ email: 'rana@aman.test', password: 'correct-horse' }).success,
    ).toBe(true);
  });

  it('asks for an email before complaining about its shape', () => {
    expect(errorFor('email', { email: '', password: 'correct-horse' })).toBe('Enter your email.');
  });

  it('rejects something that is not an email address', () => {
    expect(errorFor('email', { email: 'rana', password: 'correct-horse' })).toBe(
      'Enter a valid email address.',
    );
  });

  it('asks for a password', () => {
    expect(errorFor('password', { email: 'rana@aman.test', password: '' })).toBe(
      'Enter your password.',
    );
  });
});
