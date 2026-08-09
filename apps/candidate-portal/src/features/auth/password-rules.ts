export interface PasswordRule {
  name: string;
  requirement: string;
  holds: (password: string) => boolean;
}

export const MINIMUM_PASSWORD_LENGTH = 8;

export const MAXIMUM_PASSWORD_LENGTH = 72;

export const PASSWORD_POLICY_SUMMARY =
  'At least 8 characters, with an uppercase letter, a lowercase letter and a digit.';

export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    name: 'length',
    requirement: `At least ${MINIMUM_PASSWORD_LENGTH} characters`,
    holds: (password) => password.length >= MINIMUM_PASSWORD_LENGTH,
  },
  { name: 'uppercase', requirement: 'An uppercase letter', holds: (p) => /[A-Z]/.test(p) },
  { name: 'lowercase', requirement: 'A lowercase letter', holds: (p) => /[a-z]/.test(p) },
  { name: 'digit', requirement: 'A digit', holds: (p) => /[0-9]/.test(p) },
];
