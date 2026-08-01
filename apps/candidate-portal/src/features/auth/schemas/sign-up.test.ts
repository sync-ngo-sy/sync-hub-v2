import { describe, expect, it } from 'vitest';
import { signUpSchema } from './sign-up';

const FILLED = {
  full_name: 'Lina Khoury',
  email: 'lina@example.test',
  password: 'correct-horse-battery',
};

function errorFor(field: keyof typeof FILLED, input: Record<string, unknown>): string | undefined {
  const result = signUpSchema.safeParse(input);
  return result.success
    ? undefined
    : result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe('the sign-up schema', () => {
  it('accepts a filled-in form', () => {
    expect(signUpSchema.safeParse(FILLED).success).toBe(true);
  });

  it('asks for a name', () => {
    expect(errorFor('full_name', { ...FILLED, full_name: '   ' })).toBe('Enter your name.');
  });

  it('keeps the name without its surrounding spaces', () => {
    const result = signUpSchema.parse({ ...FILLED, full_name: '  Lina Khoury  ' });
    expect(result.full_name).toBe('Lina Khoury');
  });

  it('asks for an email before complaining about its shape', () => {
    expect(errorFor('email', { ...FILLED, email: '' })).toBe('Enter your email.');
  });

  it('rejects something that is not an email address', () => {
    expect(errorFor('email', { ...FILLED, email: 'lina' })).toBe('Enter a valid email address.');
  });

  it('holds the password to the length the API accepts', () => {
    expect(errorFor('password', { ...FILLED, password: 'short' })).toBe(
      'Use at least 8 characters.',
    );
    expect(errorFor('password', { ...FILLED, password: 'x'.repeat(73) })).toBe(
      'Use 72 characters or fewer.',
    );
  });
});
